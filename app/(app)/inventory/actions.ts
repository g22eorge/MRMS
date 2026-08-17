"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { can } from "@/lib/permissions";
import { checkPartLimit } from "@/lib/plan-limits";
import { notifyStockAlert } from "@/lib/notifications";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";

type StockTxnType = "IN" | "OUT" | "ADJUST";

/**
 * Generate a unique org-scoped SKU for items created without one — sequential
 * SKU-#### based on the org's current max, with a short retry to absorb races
 * (the @@unique([sku, orgId]) constraint still backstops it).
 */
async function generatePartSku(orgId: string): Promise<string> {
  const rows = await prisma.part.findMany({
    where: { orgId, sku: { startsWith: "SKU-" } },
    select: { sku: true },
  });
  let max = 0;
  for (const { sku } of rows) {
    const m = /^SKU-(\d+)$/.exec(sku);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  for (let i = 1; i <= 25; i += 1) {
    const candidate = `SKU-${String(max + i).padStart(4, "0")}`;
    const clash = await prisma.part.findFirst({ where: { orgId, sku: candidate }, select: { id: true } });
    if (!clash) return candidate;
  }
  return `SKU-${String(max + 1).padStart(4, "0")}-${orgId.slice(-4)}`;
}

export async function createPartAction(formData: FormData) {
  const { user, orgId, org } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!can.manageInventory(user)) redirect("/dashboard");

  let sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const unitCostRaw = String(formData.get("unitCost") ?? "").trim();
  const reorderRaw = String(formData.get("reorderLevel") ?? "").trim();
  const sellingRaw = String(formData.get("sellingPrice") ?? "").trim();
  const taxRateRaw = String(formData.get("taxRate") ?? "").trim();
  const qtyRaw = String(formData.get("qtyOnHand") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const taxable = String(formData.get("taxable") ?? "true") !== "false";
  const active = String(formData.get("active") ?? "true") !== "false";

  // Name is required; SKU is optional — auto-generate a unique one when blank.
  if (!name) redirect("/inventory?add=1&error=Item+name+is+required#add-part");
  if (!sku) sku = await generatePartSku(orgId);

  const unitCost = unitCostRaw ? Number(unitCostRaw) : null;
  const sellingPrice = sellingRaw ? Number(sellingRaw) : null;
  const taxRate = taxRateRaw ? Number(taxRateRaw) : null;
  const reorderLevel = reorderRaw ? Math.max(0, Math.floor(Number(reorderRaw))) : 0;
  const openingQty = qtyRaw ? Math.max(0, Math.floor(Number(qtyRaw))) : 0;

  // Full product profile — shared by create and reactivate-existing.
  const productFields = {
    name,
    manufacturer: manufacturer || null,
    unitCost: unitCost !== null && Number.isFinite(unitCost) ? unitCost : null,
    sellingPrice: sellingPrice !== null && Number.isFinite(sellingPrice) ? sellingPrice : null,
    category: category || null,
    description: description || null,
    taxable,
    taxRate: taxRate !== null && Number.isFinite(taxRate) ? taxRate : null,
    reorderLevel,
  };

  const existing = await prisma.part.findFirst({
    where: { orgId, sku },
    select: { id: true, isActive: true },
  });

  if (existing?.isActive) {
    redirect(`/inventory?add=1&error=${encodeURIComponent("SKU already exists")}#add-part`);
  }

  if (!existing) {
    const partLimit = await checkPartLimit(orgId);
    if (!partLimit.allowed) {
      redirect(`/inventory?error=${encodeURIComponent(partLimit.reason)}`);
    }
  }

  try {
    if (existing) {
      await prisma.part.updateMany({
        where: { id: existing.id, orgId },
        data: { ...productFields, isActive: true },
      });
    } else {
      await prisma.part.create({
        data: { orgId, sku, ...productFields, qtyOnHand: openingQty, isActive: active },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isUnique = message.includes("Unique constraint") || message.includes("P2002") || message.toLowerCase().includes("unique");
    const qs = new URLSearchParams({ error: isUnique ? "SKU already exists" : "Failed to add item" }).toString();
    redirect(`/inventory?${qs}#add-part`);
  }

  revalidatePath("/inventory");
  redirect(existing ? "/inventory?created=1&status=active#add-part" : "/inventory?created=1#add-part");
}

export async function adjustStockAction(formData: FormData) {
  const { session, user, orgId, org } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!can.manageInventory(user)) redirect("/dashboard");

  const partId = String(formData.get("partId") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim().toUpperCase() as StockTxnType;
  const qty = Math.floor(Number(String(formData.get("quantity") ?? "0").trim()));
  const reason = String(formData.get("reason") ?? "").trim();
  // Optional receipt price on a Receive → blends into the weighted-average cost.
  const receiptCostRaw = String(formData.get("unitCost") ?? "").trim();
  const receiptCost = receiptCostRaw ? Number(receiptCostRaw) : null;

  if (!partId) redirect("/inventory?error=Item+is+required");
  if (!(["IN", "OUT", "ADJUST"] as const).includes(type))
    redirect(`/inventory/${partId}?error=Invalid+stock+action`);

  // ADJUST supports a "correctTo" (set exact count) instead of a delta.
  const correctToRaw = String(formData.get("correctTo") ?? "").trim();
  const isCorrection = type === "ADJUST" && correctToRaw !== "";
  const correctTo = isCorrection ? Math.floor(Number(correctToRaw)) : null;

  if (isCorrection) {
    if (!Number.isFinite(correctTo!) || correctTo! < 0)
      redirect(`/inventory/${partId}?error=Enter+a+valid+target+quantity+%280+or+more%29`);
  } else {
    if (!Number.isFinite(qty) || qty === 0)
      redirect(`/inventory/${partId}?error=Enter+a+non-zero+quantity`);
  }

  let auditDelta: { before: number; delta: number; logQty: number; logReason: string | null } | null = null;
  try {
    auditDelta = await prisma.$transaction(async (tx) => {
      const part = await tx.part.findFirst({
        where: { id: partId, orgId },
        select: { id: true, qtyOnHand: true, unitCost: true },
      });
      if (!part) throw new Error("Inventory item not found");

      let delta: number;
      let logQty: number;
      let logReason: string | null;

      if (isCorrection) {
        delta = correctTo! - part.qtyOnHand;
        logQty = Math.abs(delta);
        logReason = reason || `Qty correction: ${part.qtyOnHand} → ${correctTo}`;
        if (delta === 0) redirect(`/inventory/${partId}?error=Quantity+is+already+${correctTo}`);
      } else {
        delta = type === "IN" ? Math.abs(qty) : type === "OUT" ? -Math.abs(qty) : qty;
        logQty = Math.abs(qty);
        logReason = reason || null;
        const nextQty = part.qtyOnHand + delta;
        if (nextQty < 0)
          throw new Error(`Cannot remove ${Math.abs(qty)} — only ${part.qtyOnHand} on hand`);
      }

      // Weighted-average cost — only on a Receive that carries a positive price.
      // (oldQty·oldCost + newQty·newPrice) / totalQty. Mirrors the PO/GRN receive.
      const applyCost = type === "IN" && receiptCost != null && receiptCost > 0;
      let nextCost: number | null = null;
      if (applyCost) {
        const denom = part.qtyOnHand + delta;
        nextCost = denom > 0 ? (part.qtyOnHand * (part.unitCost ?? 0) + delta * receiptCost!) / denom : receiptCost!;
      }

      await tx.part.update({
        where: { id: part.id },
        data: {
          qtyOnHand: { increment: delta },
          ...(nextCost != null ? { unitCost: nextCost } : {}),
        },
      });
      await tx.partStockTransaction.create({
        data: {
          partId: part.id,
          orgId,
          sourceType: "ADJUSTMENT",
          type,
          quantity: logQty,
          reason: logReason,
          createdById: session.user.id,
          ...(applyCost ? { unitCost: receiptCost } : {}),
        },
      });

      return { before: part.qtyOnHand, delta, logQty, logReason };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to adjust stock";
    redirect(`/inventory/${partId}?error=${encodeURIComponent(message)}`);
  }

  // Central audit trail for manual stock changes (the PartStockTransaction row is
  // domain data; this is the cross-module accountability record).
  if (auditDelta) {
    await writeSystemAuditEvent({
      orgId,
      actorUserId: user.id,
      entityType: "Part",
      entityId: partId,
      action: "STOCK_ADJUSTED",
      summary: `Stock ${type} ${auditDelta.logQty}${auditDelta.logReason ? ` — ${auditDelta.logReason}` : ""} (${auditDelta.before} → ${auditDelta.before + auditDelta.delta})`,
      before: { qtyOnHand: auditDelta.before },
      after: { qtyOnHand: auditDelta.before + auditDelta.delta },
    });
  }

  // Fire stock alert (out-of-stock or low-stock) if threshold crossed.
  // Runs after the transaction — non-blocking, failures don't affect the user action.
  try {
    const updated = await prisma.part.findFirst({
      where: { id: partId, orgId },
      select: { name: true, qtyOnHand: true, reorderLevel: true },
    });
    if (updated) {
      await notifyStockAlert({
        orgId,
        partId,
        partName: updated.name,
        qtyOnHand: updated.qtyOnHand,
        reorderLevel: updated.reorderLevel,
        actorName: user.name ?? user.email ?? "Unknown",
      });
    }
  } catch {
    // Notification failure must never block the stock action
  }

  revalidatePath(`/inventory/${partId}`);
  revalidatePath("/inventory");
  redirect(`/inventory/${partId}?saved=1`);
}

export async function togglePartActiveAction(formData: FormData) {
  const { user, orgId, org } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!can.manageInventory(user)) redirect("/dashboard");

  const partId = String(formData.get("partId") ?? "").trim();
  const next = String(formData.get("next") ?? "").trim();
  if (!partId) redirect("/inventory?error=Item+is+required");

  await prisma.part.updateMany({ where: { id: partId, orgId }, data: { isActive: next === "1" } });
  revalidatePath(`/inventory/${partId}`);
  revalidatePath("/inventory");
  redirect(`/inventory/${partId}`);
}

export async function updatePartAction(formData: FormData) {
  const { user, orgId, org } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!can.manageInventory(user)) redirect("/dashboard");

  const partId = String(formData.get("partId") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const unitCostRaw = String(formData.get("unitCost") ?? "").trim();
  const reorderRaw = String(formData.get("reorderLevel") ?? "").trim();
  const sellingRaw = String(formData.get("sellingPrice") ?? "").trim();
  const taxRateRaw = String(formData.get("taxRate") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const taxable = String(formData.get("taxable") ?? "true") !== "false";
  if (!partId || !name) redirect(`/inventory/${partId}?error=Item+name+is+required`);

  const unitCost = unitCostRaw ? Number(unitCostRaw) : null;
  const sellingPrice = sellingRaw ? Number(sellingRaw) : null;
  const taxRate = taxRateRaw ? Number(taxRateRaw) : null;
  const reorderLevel = reorderRaw ? Math.max(0, Math.floor(Number(reorderRaw))) : 0;
  // SKU is optional on edit — only validate/change it when a value is supplied;
  // blank keeps the item's existing (auto-generated) SKU untouched.
  if (sku) {
    const conflictingSku = await prisma.part.findFirst({
      where: { orgId, sku, id: { not: partId } },
      select: { id: true },
    });
    if (conflictingSku) redirect(`/inventory/${partId}?error=${encodeURIComponent("Another inventory item already uses that SKU")}`);
  }

  try {
    const updated = await prisma.part.updateMany({
      where: { id: partId, orgId },
      data: {
        ...(sku ? { sku } : {}),
        name,
        manufacturer: manufacturer || null,
        unitCost: unitCost !== null && Number.isFinite(unitCost) ? unitCost : null,
        sellingPrice: sellingPrice !== null && Number.isFinite(sellingPrice) ? sellingPrice : null,
        category: category || null,
        description: description || null,
        taxable,
        taxRate: taxRate !== null && Number.isFinite(taxRate) ? taxRate : null,
        reorderLevel,
      },
    });
    if (updated.count !== 1) throw new Error("Inventory item not found");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update item";
    redirect(`/inventory/${partId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/inventory/${partId}`);
  revalidatePath("/inventory");
  redirect(`/inventory/${partId}`);
}
