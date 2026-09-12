import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { can } from "@/lib/permissions";
import { checkPartLimit } from "@/lib/plan-limits";
import { generatePartSku } from "@/app/(app)/inventory/actions";

/**
 * Create an inventory item inline while composing a document.
 *
 * The standalone-invoice line editor has always offered "create <name>" when a
 * typed item matches nothing, and has always POSTed here — but this route was
 * never written, so the fetch hit the 404 handler and the editor showed
 * "Failed to create part" every time. The only way to add an item mid-invoice
 * was to abandon the invoice and go to Inventory.
 *
 * It applies the same three gates as createPartAction, because it is the same
 * privilege: org write access, manageInventory, and the plan's part limit. The
 * limit is checked only for a genuinely new SKU — reactivating one the org
 * already has does not consume a new slot.
 */
export async function POST(req: NextRequest) {
  const { user, orgId, org } = await requireOrgSession();
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
  if (!can.manageInventory(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { sku?: unknown; name?: unknown; unitCost?: unknown; qtyOnHand?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Item name is required" }, { status: 400 });

  let sku = String(body.sku ?? "").trim();
  if (!sku) sku = await generatePartSku(orgId);

  const unitCostRaw = Number(body.unitCost);
  const unitCost = Number.isFinite(unitCostRaw) ? unitCostRaw : null;
  const qtyRaw = Number(body.qtyOnHand);
  const qtyOnHand = Number.isFinite(qtyRaw) ? Math.max(0, Math.floor(qtyRaw)) : 0;

  const existing = await prisma.part.findFirst({
    where: { orgId, sku },
    select: { id: true, isActive: true },
  });
  if (existing?.isActive) {
    return NextResponse.json({ error: "SKU already exists" }, { status: 409 });
  }
  if (!existing) {
    const limit = await checkPartLimit(orgId);
    if (!limit.allowed) return NextResponse.json({ error: limit.reason }, { status: 403 });
  }

  try {
    const part = existing
      ? await prisma.part.update({
          where: { id: existing.id },
          data: { name, unitCost, qtyOnHand, isActive: true },
          select: { id: true, sku: true, name: true, unitCost: true, sellingPrice: true, taxable: true, taxRate: true, qtyOnHand: true },
        })
      : await prisma.part.create({
          data: { orgId, sku, name, unitCost, qtyOnHand, isActive: true },
          select: { id: true, sku: true, name: true, unitCost: true, sellingPrice: true, taxable: true, taxRate: true, qtyOnHand: true },
        });
    // The editor adds this straight to its options list, so the shape has to
    // match PartOption exactly — anything missing renders a blank row.
    return NextResponse.json(part);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isUnique = message.includes("P2002") || message.toLowerCase().includes("unique");
    return NextResponse.json(
      { error: isUnique ? "SKU already exists" : "Failed to add item" },
      { status: isUnique ? 409 : 500 },
    );
  }
}
