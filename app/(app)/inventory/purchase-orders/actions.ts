"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { orgTagFor, maxNumberSequence, composeOrgNumber } from "@/lib/commercial/org-number";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { assertOrgCanMutate } from "@/lib/org-write";
import { notifyStockReceived } from "@/lib/notifications";

async function requireAdmin() {
  const ctx = await requireOrgSession();
  if (!can.manageInventory(ctx.user)) redirect("/inventory");
  assertOrgCanMutate({ access: ctx.org.access, userRole: ctx.user.role, userAccessMode: ctx.user.accessMode, kind: "GENERAL" });
  return ctx;
}

async function generateGrnNumber(orgId: string): Promise<string> {
  const inner = `GRN-${new Date().getFullYear()}-`;
  const [tag, rows] = await Promise.all([
    orgTagFor(orgId),
    prisma.goodsReceived.findMany({ where: { orgId, grnNumber: { contains: inner } }, select: { grnNumber: true } }),
  ]);
  const next = maxNumberSequence(inner, rows.map((r) => r.grnNumber)) + 1;
  return composeOrgNumber(tag, inner, next);
}

function parseOptionalDate(raw: FormDataEntryValue | null, label: string): { date: Date | null; error?: string } {
  const value = String(raw ?? "").trim();
  if (!value) return { date: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: null, error: `${label} is invalid` };
  return { date };
}

// ── Shared receipt logic ─────────────────────────────────────────────────────
// The stock-in transaction (GRN + per-line base-unit stock + weighted cost +
// PO status), shared by manual receiving and the one-click "Receive now" flow so
// the stock/cost/UOM math lives in exactly one place.
type ReceiptUpdate = { id: string; qtyReceived: number; partId: string | null; delta: number; description: string; unitCost: number; purchaseFactor: number };

async function performReceipt(
  orgId: string,
  userId: string,
  po: { id: string; supplierId: string; reference: string | null; receivedAt: Date | null },
  locationId: string,
  updates: ReceiptUpdate[],
): Promise<void> {
  const grnNumber = await generateGrnNumber(orgId);
  let grnId = "";

  await prisma.$transaction(async (tx) => {
    const grn = await tx.goodsReceived.create({
      data: {
        orgId,
        grnNumber,
        supplierId: po.supplierId,
        poId: po.id,
        locationId,
        createdById: userId,
        items: {
          create: updates.map((u) => ({
            poItemId: u.id,
            partId: u.partId,
            description: u.description,
            quantity: u.delta,
            unitCost: u.unitCost,
          })),
        },
      },
      select: { id: true },
    });
    grnId = grn.id;

    for (const u of updates) {
      await tx.purchaseOrderItem.update({ where: { id: u.id }, data: { qtyReceived: u.qtyReceived } });
      if (u.partId && u.delta > 0) {
        // Convert purchase units → base stock units; cost is per base unit.
        const baseDelta = u.delta * u.purchaseFactor;
        const baseUnitCost = u.purchaseFactor !== 1 ? u.unitCost / u.purchaseFactor : u.unitCost;
        await tx.partLocationStock.upsert({
          where: { partId_locationId: { partId: u.partId, locationId } },
          create: { orgId, partId: u.partId, locationId, qtyOnHand: baseDelta, qtyReserved: 0 },
          update: { qtyOnHand: { increment: baseDelta } },
        });
        await tx.partStockTransaction.create({
          data: { partId: u.partId, orgId, locationId, unitCost: baseUnitCost, sourceType: "GRN", sourceId: grnId, type: "IN", quantity: baseDelta, reason: `Received via ${grnNumber}`, createdById: userId },
        });
        const partBefore = await tx.part.findUnique({ where: { id: u.partId }, select: { qtyOnHand: true, unitCost: true } });
        const oldQty = partBefore?.qtyOnHand ?? 0;
        // Part.qtyOnHand is authoritative; weighted-average cost, never overwritten
        // with a zero/negative receipt price.
        let nextCost = partBefore?.unitCost ?? 0;
        if (baseUnitCost > 0) {
          const denom = oldQty + baseDelta;
          nextCost = denom > 0 ? (oldQty * nextCost + baseDelta * baseUnitCost) / denom : baseUnitCost;
        }
        await tx.part.update({ where: { id: u.partId }, data: { qtyOnHand: { increment: baseDelta }, unitCost: nextCost } });
      }
    }

    const allItems = await tx.purchaseOrderItem.findMany({ where: { poId: po.id } });
    const allReceived = allItems.every((i) => i.qtyReceived >= i.qtyOrdered);
    const anyReceived = allItems.some((i) => i.qtyReceived > 0);
    const newStatus = allReceived ? "RECEIVED" : anyReceived ? "PARTIAL" : "ORDERED";
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: newStatus as never, receivedAt: allReceived ? new Date() : po.receivedAt } });
  });

  await writeSystemAuditEvent({
    orgId,
    actorUserId: userId,
    entityType: "GoodsReceived",
    entityId: grnId,
    action: "GOODS_RECEIVED",
    summary: `${grnNumber} received against PO ${po.reference ?? po.id} (${updates.length} line${updates.length === 1 ? "" : "s"})`,
  });

  revalidatePath(`/inventory/purchase-orders/${po.id}`);
  revalidatePath("/inventory/purchase-orders");
  revalidatePath("/inventory/goods-received");
  revalidatePath("/inventory");

  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  notifyStockReceived({ orgId, grnNumber, poReference: po.reference ?? undefined, itemCount: updates.length, actorName: actor?.name ?? actor?.email ?? "Unknown" }).catch(() => {});
}

// ── Create PO ──────────────────────────────────────────────────────────────

export async function createPurchaseOrderAction(
  formData: FormData,
): Promise<{ id?: string; error?: string }> {
  const { orgId, session } = await requireAdmin();

  const supplierId = String(formData.get("supplierId") ?? "").trim();
  if (!supplierId) return { error: "Supplier is required" };

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, orgId, isActive: true },
    select: { id: true },
  });
  if (!supplier) return { error: "Supplier not found or inactive" };

  const reference = String(formData.get("reference") ?? "").trim() || null;
  const orderedAtResult = parseOptionalDate(formData.get("orderedAt"), "Order date");
  const expectedAtResult = parseOptionalDate(formData.get("expectedAt"), "Expected delivery");
  if (orderedAtResult.error) return { error: orderedAtResult.error };
  if (expectedAtResult.error) return { error: expectedAtResult.error };
  const orderedAt = orderedAtResult.date;
  const expectedAt = expectedAtResult.date;
  if (orderedAt && expectedAt && expectedAt < orderedAt) return { error: "Expected delivery cannot be before the order date" };
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const issueNow = String(formData.get("issueNow") ?? "") === "1";

  // items encoded as JSON array of { description, qtyOrdered, unitCost, partId? }
  let rawItems: Array<{ description: string; qtyOrdered: number; unitCost: number; partId?: string }> = [];
  try {
    rawItems = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "Invalid items data" };
  }

  const items = rawItems.map((item) => ({
    description: String(item.description ?? "").trim(),
    qtyOrdered: Math.floor(Number(item.qtyOrdered)),
    unitCost: Number(item.unitCost),
    partId: item.partId ? String(item.partId).trim() : null,
  }));

  if (!items.length) return { error: "Add at least one item" };
  for (const item of items) {
    if (!item.description) return { error: "All items need a description" };
    if (!Number.isFinite(item.qtyOrdered) || item.qtyOrdered < 1) return { error: "Quantity must be at least 1" };
    if (!Number.isFinite(item.unitCost) || item.unitCost < 0) return { error: "Unit cost cannot be negative" };
  }
  if (issueNow && items.some((item) => item.unitCost <= 0)) return { error: "Issued purchase orders cannot contain zero-cost lines" };

  const partIds = [...new Set(items.map((item) => item.partId).filter((id): id is string => Boolean(id)))];
  if (partIds.length) {
    const validParts = await prisma.part.findMany({
      where: { id: { in: partIds }, orgId, isActive: true },
      select: { id: true },
    });
    if (validParts.length !== partIds.length) return { error: "One or more inventory items are inactive or not found" };
  }

  try {
    const po = await prisma.purchaseOrder.create({
      data: {
        orgId,
        supplierId,
        status: issueNow ? "ORDERED" : "DRAFT",
        reference,
        orderedAt: orderedAt ?? (issueNow ? new Date() : null),
        expectedAt,
        notes,
        items: {
          create: items.map((item) => ({
            description: item.description,
            qtyOrdered: item.qtyOrdered,
            unitCost: item.unitCost,
            partId: item.partId || null,
          })),
        },
      },
    });
    await writeSystemAuditEvent({ orgId, actorUserId: session.user.id, entityType: "PurchaseOrder", entityId: po.id, action: "PURCHASE_ORDER_CREATED", summary: `PO ${reference ?? po.id} created${issueNow ? " (issued)" : ""}` });
    revalidatePath("/inventory/purchase-orders");
    return { id: po.id };
  } catch {
    return { error: "Failed to create purchase order" };
  }
}

// ── Quick-add supplier ───────────────────────────────────────────────────────
// Mirrors the inline stock-location create on the receive page so raising an
// order is never a dead-end: an inventory manager can add a supplier without
// leaving the New PO form.
export async function quickCreateSupplierAction(
  name: string,
): Promise<{ id?: string; name?: string; error?: string }> {
  const { orgId } = await requireAdmin();
  const clean = String(name ?? "").trim();
  if (clean.length < 2) return { error: "Enter a supplier name (at least 2 characters)" };
  try {
    const supplier = await prisma.supplier.create({
      data: { orgId, name: clean, isActive: true },
      select: { id: true, name: true },
    });
    revalidatePath("/inventory/suppliers");
    return { id: supplier.id, name: supplier.name };
  } catch {
    return { error: "Failed to add supplier" };
  }
}

// ── Create + receive in one action ───────────────────────────────────────────
// The realistic small-shop flow: bought stock over the counter, stock it in now.
// Creates the PO as ORDERED, ensures a stock location (creating a default one if
// the org has none — mirroring the inline location-create on the receive page),
// and receives every line in full, so buying and stocking is a single click.
export async function createAndReceivePurchaseOrderAction(
  formData: FormData,
): Promise<{ id?: string; error?: string }> {
  formData.set("issueNow", "1");
  const created = await createPurchaseOrderAction(formData);
  if (created.error || !created.id) return created;
  const poId = created.id;

  const { orgId, session } = await requireAdmin();

  // Ensure a stock location to receive into; create a default one if none exists.
  let location = await prisma.stockLocation.findFirst({
    where: { orgId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!location) {
    location = await prisma.stockLocation.create({ data: { orgId, name: "Main Store", isActive: true }, select: { id: true } });
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { items: { include: { part: true } } },
  });
  if (!po || po.orgId !== orgId) return { id: poId, error: "Order created, but receiving failed — open it and receive from there." };

  const updates: ReceiptUpdate[] = po.items
    .filter((item) => item.qtyOrdered > item.qtyReceived)
    .map((item) => ({
      id: item.id,
      qtyReceived: item.qtyOrdered,
      partId: item.partId,
      delta: item.qtyOrdered - item.qtyReceived,
      description: item.description,
      unitCost: item.unitCost,
      purchaseFactor: item.part?.purchaseUomFactor && item.part.purchaseUomFactor > 0 ? item.part.purchaseUomFactor : 1,
    }));

  if (updates.length) {
    await performReceipt(orgId, session.user.id, { id: po.id, supplierId: po.supplierId, reference: po.reference, receivedAt: po.receivedAt }, location.id, updates);
  }
  return { id: poId };
}

// ── Update PO status / meta ────────────────────────────────────────────────

export async function updatePurchaseOrderAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const { orgId } = await requireAdmin();

  const id = formData.get("id") as string;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { orgId: true, status: true, items: { select: { qtyReceived: true } } },
  });
  if (!po || po.orgId !== orgId) return { error: "Not found" };

  const requestedStatus = String(formData.get("status") ?? po.status).trim();
  const status = ["DRAFT", "ORDERED", "PARTIAL", "CANCELLED"].includes(requestedStatus) ? requestedStatus : po.status;
  if (status === "CANCELLED" && po.items.some((item) => item.qtyReceived > 0)) {
    return { error: "Cannot cancel a purchase order after receiving stock" };
  }
  const reference = (formData.get("reference") as string).trim() || null;
  const orderedAtResult = parseOptionalDate(formData.get("orderedAt"), "Order date");
  const expectedAtResult = parseOptionalDate(formData.get("expectedAt"), "Expected delivery");
  if (orderedAtResult.error) return { error: orderedAtResult.error };
  if (expectedAtResult.error) return { error: expectedAtResult.error };
  if (orderedAtResult.date && expectedAtResult.date && expectedAtResult.date < orderedAtResult.date) {
    return { error: "Expected delivery cannot be before the order date" };
  }
  const notes = (formData.get("notes") as string).trim() || null;

  await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: status as never,
      reference,
      orderedAt: orderedAtResult.date,
      expectedAt: expectedAtResult.date,
      notes,
    },
  });

  revalidatePath(`/inventory/purchase-orders/${id}`);
  return {};
}

export async function setPurchaseOrderStatusAction(formData: FormData): Promise<void> {
  const { orgId, session } = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !["DRAFT", "ORDERED", "CANCELLED"].includes(status)) return;

  const po = await prisma.purchaseOrder.findFirst({
    where: { id, orgId },
    include: { items: { select: { qtyReceived: true, unitCost: true } } },
  });
  // These were bare returns, so "Issue" on a draft with an unpriced line — the
  // ordinary case — did nothing at all and said nothing.
  // `redirect` throws, so these both narrow `po` and give the user a reason.
  const poError = (msg: string) => `/inventory/purchase-orders/${id}?error=${encodeURIComponent(msg)}`;
  if (!po) redirect(poError("That purchase order could not be found."));
  if (po.status === "RECEIVED") redirect(poError("This order is already fully received."));
  if (status === "ORDERED" && po.items.some((item) => item.unitCost <= 0)) {
    redirect(poError("Every line needs a unit cost before the order can be issued."));
  }
  if (po.items.some((item) => item.qtyReceived > 0) && status !== "ORDERED") {
    redirect(poError("Stock has already been received against this order, so its status cannot change."));
  }

  await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: status as never,
      orderedAt: status === "ORDERED" && !po.orderedAt ? new Date() : po.orderedAt,
      receivedAt: null,
    },
  });

  await writeSystemAuditEvent({ orgId, actorUserId: session.user.id, entityType: "PurchaseOrder", entityId: id, action: "PURCHASE_ORDER_STATUS_CHANGED", summary: `PO status set to ${status}` });

  revalidatePath("/inventory/purchase-orders");
  revalidatePath(`/inventory/purchase-orders/${id}`);
}

export async function deletePurchaseOrderAction(formData: FormData): Promise<void> {
  const { orgId, session } = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const po = await prisma.purchaseOrder.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      reference: true,
      items: { select: { qtyReceived: true } },
      _count: { select: { goodsReceivedNotes: true, supplierBills: true } },
    },
  });
  if (!po) return;

  // Never hard-delete a PO once stock was received or a GRN/bill is linked —
  // deletion would orphan those records and leave received stock unreversed.
  if (
    po.items.some((item) => item.qtyReceived > 0) ||
    po._count.goodsReceivedNotes > 0 ||
    po._count.supplierBills > 0
  ) {
    return;
  }

  await prisma.purchaseOrder.delete({ where: { id } });
  await writeSystemAuditEvent({ orgId, actorUserId: session.user.id, entityType: "PurchaseOrder", entityId: id, action: "PURCHASE_ORDER_DELETED", summary: `PO ${po.reference ?? id} deleted` });

  revalidatePath("/inventory/purchase-orders");
  revalidatePath("/inventory/goods-received");
  revalidatePath("/inventory/supplier-bills");
  redirect("/inventory/purchase-orders");
}

// ── Receive stock (mark items received, update Part qty) ───────────────────

export async function receiveStockAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const { orgId, session } = await requireAdmin();

  const poId = formData.get("poId") as string;
  const locationId = String(formData.get("locationId") ?? "").trim();
  if (!locationId) return { error: "Stock location is required" };

  const location = await prisma.stockLocation.findUnique({
    where: { id: locationId },
    select: { orgId: true, isActive: true },
  });
  if (!location || location.orgId !== orgId || !location.isActive) return { error: "Stock location not found" };

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { items: { include: { part: true } } },
  });
  if (!po || po.orgId !== orgId) return { error: "Not found" };
  if (!["ORDERED", "PARTIAL"].includes(po.status)) return { error: "This purchase order cannot receive stock" };

  // qtyReceived_<itemId> fields in formData
  const updates: Array<{ id: string; qtyReceived: number; partId: string | null; delta: number; description: string; unitCost: number; purchaseFactor: number }> = [];

  for (const item of po.items) {
    const val = parseInt(formData.get(`qtyReceived_${item.id}`) as string, 10);
    if (isNaN(val) || val < 0) continue;
    if (val > item.qtyOrdered) return { error: `Received quantity cannot exceed ordered quantity for ${item.description}` };
    if (val < item.qtyReceived) return { error: "Use adjustments or returns to reduce previously received stock" };
    const delta = val - item.qtyReceived;
    if (delta === 0) continue;
    // Base stock units per purchase unit (e.g. a box of 12). Received qty stays
    // in purchase units on the PO/GRN; stock moves in base units.
    const purchaseFactor = item.part?.purchaseUomFactor && item.part.purchaseUomFactor > 0 ? item.part.purchaseUomFactor : 1;
    updates.push({ id: item.id, qtyReceived: val, partId: item.partId, delta, description: item.description, unitCost: item.unitCost, purchaseFactor });
  }

  if (!updates.length) return { error: "No changes to save" };
  await performReceipt(orgId, session.user.id, po, locationId, updates);
  return {};
}

/**
 * M5: reverse (void) a posted goods-received note. Decrements the received
 * stock, writes reversal ledger rows, rolls the PO status back, and marks the
 * GRN CANCELLED. Blocked when the GRN is already billed, or when reversing
 * would drive stock negative (the goods have since moved out).
 */
export async function reverseGoodsReceivedAction(formData: FormData): Promise<{ error?: string }> {
  const { orgId, session } = await requireAdmin();
  const grnId = String(formData.get("grnId") ?? "").trim();
  if (!grnId) return { error: "Missing goods-received note" };

  const grn = await prisma.goodsReceived.findFirst({
    where: { id: grnId, orgId, status: "POSTED" },
    select: {
      id: true, grnNumber: true, poId: true, locationId: true,
      items: { select: { partId: true, poItemId: true, quantity: true } },
    },
  });
  if (!grn) return { error: "Goods-received note not found or already reversed" };

  const billed = await prisma.supplierBill.findFirst({
    where: { orgId, grnId, status: { not: "CANCELLED" } },
    select: { billNumber: true },
  });
  if (billed) return { error: `Cannot reverse — this GRN is billed on ${billed.billNumber}. Cancel the bill first.` };

  const result = await prisma.$transaction(async (tx) => {
    for (const item of grn.items) {
      if (!item.partId || item.quantity <= 0) continue;

      const part = await tx.part.findFirst({ where: { id: item.partId, orgId }, select: { qtyOnHand: true, purchaseUomFactor: true } });
      if (!part) continue;
      // GRN quantity is in purchase units; stock reverses in base units.
      const factor = part.purchaseUomFactor && part.purchaseUomFactor > 0 ? part.purchaseUomFactor : 1;
      const baseQty = item.quantity * factor;
      if (part.qtyOnHand - baseQty < 0) {
        return { error: "Cannot reverse — some received stock has already been sold or moved out." };
      }

      await tx.part.update({ where: { id: item.partId }, data: { qtyOnHand: { decrement: baseQty } } });
      const loc = await tx.partLocationStock.findUnique({
        where: { partId_locationId: { partId: item.partId, locationId: grn.locationId } },
        select: { qtyOnHand: true },
      });
      if (loc) {
        await tx.partLocationStock.update({
          where: { partId_locationId: { partId: item.partId, locationId: grn.locationId } },
          data: { qtyOnHand: { decrement: Math.min(loc.qtyOnHand, baseQty) } },
        });
      }
      if (item.poItemId) {
        await tx.purchaseOrderItem.update({
          where: { id: item.poItemId },
          data: { qtyReceived: { decrement: item.quantity } },
        });
      }
      await tx.partStockTransaction.create({
        data: {
          partId: item.partId,
          orgId,
          locationId: grn.locationId,
          sourceType: "GRN",
          sourceId: grn.id,
          type: "OUT",
          quantity: baseQty,
          reason: `Reversal of ${grn.grnNumber}`,
          createdById: session.user.id,
        },
      });
    }

    await tx.goodsReceived.update({ where: { id: grn.id }, data: { status: "CANCELLED" } });

    // Roll the PO status back to match the reduced received quantities.
    if (grn.poId) {
      const allItems = await tx.purchaseOrderItem.findMany({ where: { poId: grn.poId }, select: { qtyOrdered: true, qtyReceived: true } });
      const allReceived = allItems.length > 0 && allItems.every((i) => i.qtyReceived >= i.qtyOrdered);
      const anyReceived = allItems.some((i) => i.qtyReceived > 0);
      await tx.purchaseOrder.update({
        where: { id: grn.poId },
        data: { status: (allReceived ? "RECEIVED" : anyReceived ? "PARTIAL" : "ORDERED") as never },
      });
    }
    return { ok: true as const };
  });

  if ("error" in result) return { error: result.error };

  await writeSystemAuditEvent({
    orgId,
    actorUserId: session.user.id,
    entityType: "GoodsReceived",
    entityId: grnId,
    action: "GOODS_RECEIVED_REVERSED",
    summary: `${grn.grnNumber} reversed (${grn.items.length} line${grn.items.length === 1 ? "" : "s"})`,
  });

  revalidatePath("/inventory/goods-received");
  revalidatePath(`/inventory/goods-received/${grnId}`);
  if (grn.poId) revalidatePath(`/inventory/purchase-orders/${grn.poId}`);
  return {};
}
