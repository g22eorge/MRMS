"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { generatePartSku } from "@/app/(app)/inventory/actions";
import { assertOrgCanMutate } from "@/lib/org-write";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { orgDb } from "@/lib/db";
import { mapColumns, parseAmount, parseCsv } from "@/lib/import/csv";
import { requireOrgSession } from "@/lib/org-context";
import { normalizePhoneForStorage, phoneLookupVariants } from "@/lib/phone";
import { checkPartLimit } from "@/lib/plan-limits";
import { prisma } from "@/lib/prisma";
import { sanitizeOptionalText, sanitizeText } from "@/lib/sanitize";

export type ImportResult = {
  kind?: "clients" | "products";
  created?: number;
  skipped?: Array<{ line: number; reason: string }>;
  error?: string;
};

const MAX_BYTES = 1_000_000;
const MAX_ROWS = 2000;

const CLIENT_COLUMNS = {
  fullName: ["name", "fullname", "client", "clientname", "customer", "customername", "contact", "contactname"],
  phone: ["phone", "phonenumber", "mobile", "tel", "telephone", "contactnumber", "whatsapp"],
  email: ["email", "emailaddress"],
  organization: ["organization", "organisation", "company", "business", "companyname"],
  address: ["address", "location"],
};

const PRODUCT_COLUMNS = {
  name: ["name", "item", "itemname", "product", "productname", "description"],
  sku: ["sku", "code", "itemcode", "productcode", "barcode"],
  unitCost: ["cost", "unitcost", "costprice", "buyingprice", "purchaseprice"],
  sellingPrice: ["price", "sellingprice", "saleprice", "unitprice", "retailprice"],
  qtyOnHand: ["quantity", "qty", "stock", "onhand", "qtyonhand", "instock"],
  category: ["category", "group", "type"],
};

async function readUpload(formData: FormData): Promise<{ rows: string[][] } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file first." };
  if (file.size > MAX_BYTES) return { error: "That file is over 1 MB. Split it and import in parts." };
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && file.type !== "text/csv") {
    return { error: "Save the spreadsheet as CSV and upload that." };
  }
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { error: "The file needs a header row and at least one line." };
  if (rows.length - 1 > MAX_ROWS) return { error: `That is ${rows.length - 1} lines. Import up to ${MAX_ROWS} at a time.` };
  return { rows };
}

async function requireImporter() {
  const { user, orgId, org } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (user.role !== "ADMIN") throw new Error("Only an administrator can import.");
  return { user, orgId };
}

export async function importClientsAction(_state: ImportResult, formData: FormData): Promise<ImportResult> {
  let who: Awaited<ReturnType<typeof requireImporter>>;
  try {
    who = await requireImporter();
  } catch (error) {
    return { kind: "clients", error: error instanceof Error ? error.message : "Not allowed." };
  }
  const upload = await readUpload(formData);
  if ("error" in upload) return { kind: "clients", error: upload.error };

  const [headers, ...lines] = upload.rows;
  const col = mapColumns(headers, CLIENT_COLUMNS);
  if (col.fullName < 0 || col.phone < 0) {
    return { kind: "clients", error: `Couldn't find a name and a phone column. Found: ${headers.map((h) => h.trim()).join(", ")}.` };
  }

  const db = orgDb(who.orgId);
  const existing = await db.client.findMany({ select: { phone: true } });
  const taken = new Set(existing.flatMap((c) => phoneLookupVariants(c.phone)));
  const skipped: ImportResult["skipped"] = [];
  const toCreate: Array<{ orgId: string; fullName: string; phone: string; email: string | null; organization: string | null; address: string | null }> = [];

  lines.forEach((cells, index) => {
    const line = index + 2; // the header is line 1
    const at = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
    const fullName = sanitizeText(at(col.fullName));
    const rawPhone = at(col.phone);
    if (fullName.length < 2) return void skipped.push({ line, reason: "No name" });
    if (rawPhone.replace(/\D/g, "").length < 3) return void skipped.push({ line, reason: "No phone number" });
    const phone = normalizePhoneForStorage(sanitizeText(rawPhone));
    const variants = phoneLookupVariants(phone);
    if (variants.some((v) => taken.has(v))) return void skipped.push({ line, reason: `Phone ${rawPhone} already exists` });
    const email = at(col.email);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return void skipped.push({ line, reason: `Email ${email} is not valid` });
    variants.forEach((v) => taken.add(v));
    toCreate.push({
      orgId: who.orgId,
      fullName,
      phone,
      email: sanitizeOptionalText(email),
      organization: sanitizeOptionalText(at(col.organization)),
      address: sanitizeOptionalText(at(col.address)),
    });
  });

  if (toCreate.length > 0) await prisma.client.createMany({ data: toCreate });
  await writeSystemAuditEvent({
    orgId: who.orgId,
    actorUserId: who.user.id,
    entityType: "Client",
    entityId: "import",
    action: "CLIENTS_IMPORTED",
    summary: `Imported ${toCreate.length} clients from a spreadsheet (${skipped.length} skipped)`,
  });
  revalidatePath("/clients");
  return { kind: "clients", created: toCreate.length, skipped };
}

export async function importProductsAction(_state: ImportResult, formData: FormData): Promise<ImportResult> {
  let who: Awaited<ReturnType<typeof requireImporter>>;
  try {
    who = await requireImporter();
  } catch (error) {
    return { kind: "products", error: error instanceof Error ? error.message : "Not allowed." };
  }
  const upload = await readUpload(formData);
  if ("error" in upload) return { kind: "products", error: upload.error };

  const [headers, ...lines] = upload.rows;
  const col = mapColumns(headers, PRODUCT_COLUMNS);
  // "description" doubles as a name only when no real name column is present.
  if (col.name < 0) {
    return { kind: "products", error: `Couldn't find a name column. Found: ${headers.map((h) => h.trim()).join(", ")}.` };
  }

  const existing = await prisma.part.findMany({ where: { orgId: who.orgId }, select: { sku: true, name: true } });
  const takenSkus = new Set(existing.map((p) => p.sku.toLowerCase()));
  const takenNames = new Set(existing.map((p) => p.name.trim().toLowerCase()));
  const skipped: ImportResult["skipped"] = [];
  let created = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const cells = lines[index];
    const line = index + 2;
    const at = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
    const name = sanitizeText(at(col.name));
    if (!name) { skipped.push({ line, reason: "No name" }); continue; }
    let sku = sanitizeText(at(col.sku));
    if (sku && takenSkus.has(sku.toLowerCase())) { skipped.push({ line, reason: `Code ${sku} already exists` }); continue; }
    if (!sku && takenNames.has(name.toLowerCase())) { skipped.push({ line, reason: `${name} already exists` }); continue; }

    // The plan's item limit applies to an import exactly as it does to adding
    // one by hand; stop cleanly at the limit and say where.
    const limit = await checkPartLimit(who.orgId);
    if (!limit.allowed) {
      skipped.push({ line, reason: limit.reason ?? "Your plan's item limit is reached" });
      for (let rest = index + 1; rest < lines.length; rest += 1) skipped.push({ line: rest + 2, reason: "Not imported: item limit reached" });
      break;
    }

    if (!sku) sku = await generatePartSku(who.orgId);
    const qty = parseAmount(at(col.qtyOnHand));
    await prisma.part.create({
      data: {
        orgId: who.orgId,
        sku,
        name,
        unitCost: parseAmount(at(col.unitCost)),
        sellingPrice: parseAmount(at(col.sellingPrice)),
        qtyOnHand: qty !== null && qty > 0 ? Math.floor(qty) : 0,
        category: sanitizeOptionalText(at(col.category)),
        isActive: true,
      },
    });
    takenSkus.add(sku.toLowerCase());
    takenNames.add(name.toLowerCase());
    created += 1;
  }

  await writeSystemAuditEvent({
    orgId: who.orgId,
    actorUserId: who.user.id,
    entityType: "Part",
    entityId: "import",
    action: "PRODUCTS_IMPORTED",
    summary: `Imported ${created} products from a spreadsheet (${skipped.length} skipped)`,
  });
  revalidatePath("/inventory");
  return { kind: "products", created, skipped };
}

export type DeletionState = { error?: string };

/**
 * The business asks for its workspace to be deleted.
 *
 * Nothing is destroyed here. The workspace is switched off at once, so nobody
 * can sign in or add to it, and the request is dated. A platform admin removes
 * the data from the console, inside the 30 days the privacy policy gives, and
 * can cancel instead if the request was a mistake.
 */
export async function requestWorkspaceDeletionAction(_state: DeletionState, formData: FormData): Promise<DeletionState> {
  const { user, orgId, org } = await requireOrgSession();
  if (user.role !== "ADMIN") return { error: "Only an administrator can do this." };
  const { EIS_ORG_ID } = await import("@/lib/org");
  if (orgId === EIS_ORG_ID) return { error: "This workspace cannot be deleted from here." };

  const typed = String(formData.get("confirmName") ?? "").trim().toLowerCase();
  if (!org.name || typed !== org.name.trim().toLowerCase()) {
    return { error: "Type the business name exactly to confirm." };
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { isActive: false, deletionRequestedAt: new Date() },
  });
  await writeSystemAuditEvent({
    orgId,
    actorUserId: user.id,
    entityType: "Organization",
    entityId: orgId,
    action: "WORKSPACE_DELETION_REQUESTED",
    summary: `${user.email} asked for the workspace "${org.name}" to be deleted`,
  });

  // Sign everyone in the workspace out here, then go to the sign-in page.
  // Redirecting a server action to the force-logout route handler leaves the
  // browser sitting on that address instead of completing the sign-out.
  await prisma.session.deleteMany({ where: { user: { orgId } } });
  redirect("/login");
}
