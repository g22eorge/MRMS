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
    revalidatePath("/procurement");
    revalidatePath("/inventory/purchase-orders");
    return { id: po.id };
  } catch {
    return { error: "Failed to create purchase order" };
  }
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
  if (!po) return;
  if (po.status === "RECEIVED") return;
  if (status === "ORDERED" && po.items.some((item) => item.unitCost <= 0)) return;
  if (po.items.some((item) => item.qtyReceived > 0) && status !== "ORDERED") return;

  await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: status as never,
      orderedAt: status === "ORDERED" && !po.orderedAt ? new Date() : po.orderedAt,
      receivedAt: null,
    },
  });

  await writeSystemAuditEvent({ orgId, actorUserId: session.user.id, entityType: "PurchaseOrder", entityId: id, action: "PURCHASE_ORDER_STATUS_CHANGED", summary: `PO status set to ${status}` });

  revalidatePath("/procurement");
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

  revalidatePath("/procurement");
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
  const updates: Array<{ id: string; qtyReceived: number; partId: string | null; delta: number; description: string; unitCost: number }> = [];

  for (const item of po.items) {
    const val = parseInt(formData.get(`qtyReceived_${item.id}`) as string, 10);
    if (isNaN(val) || val < 0) continue;
    if (val > item.qtyOrdered) return { error: `Received quantity cannot exceed ordered quantity for ${item.description}` };
    if (val < item.qtyReceived) return { error: "Use adjustments or returns to reduce previously received stock" };
    const delta = val - item.qtyReceived;
    if (delta === 0) continue;
    updates.push({ id: item.id, qtyReceived: val, partId: item.partId, delta, description: item.description, unitCost: item.unitCost });
  }

  if (!updates.length) return { error: "No changes to save" };
  const grnNumber = await generateGrnNumber(orgId);
  let grnId = "";

  await prisma.$transaction(async (tx) => {
    const grn = await tx.goodsReceived.create({
      data: {
        orgId,
        grnNumber,
        supplierId: po.supplierId,
        poId,
        locationId,
        createdById: session.user.id,
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
      await tx.purchaseOrderItem.update({
        where: { id: u.id },
        data: { qtyReceived: u.qtyReceived },
      });
      if (u.partId && u.delta > 0) {
        await tx.partLocationStock.upsert({
          where: { partId_locationId: { partId: u.partId, locationId } },
          create: { orgId, partId: u.partId, locationId, qtyOnHand: u.delta, qtyReserved: 0 },
          update: { qtyOnHand: { increment: u.delta } },
        });
        await tx.partStockTransaction.create({
          data: {
            partId: u.partId,
            type: "IN",
            quantity: u.delta,
            reason: `Received via ${grnNumber}`,
            createdById: session.user.id,
          },
        });
        const partBefore = await tx.part.findUnique({
          where: { id: u.partId },
          select: { qtyOnHand: true, unitCost: true },
        });
        const oldQty = partBefore?.qtyOnHand ?? 0;
        // Part.qtyOnHand is authoritative: increment by the received delta rather
        // than recomputing from SUM(PartLocationStock), which would silently wipe
        // stock recorded via manual adjustments or POS (C2 corruption fix).
        // Weighted-average cost; never overwrite the cost basis with a zero/
        // negative receipt price (which would destroy valuation and margins).
        let nextCost = partBefore?.unitCost ?? 0;
        if (u.unitCost > 0) {
          const denom = oldQty + u.delta;
          nextCost = denom > 0 ? (oldQty * nextCost + u.delta * u.unitCost) / denom : u.unitCost;
        }
        await tx.part.update({
          where: { id: u.partId },
          data: { qtyOnHand: { increment: u.delta }, unitCost: nextCost },
        });
      }
    }

    // determine new PO status
    const allItems = await tx.purchaseOrderItem.findMany({ where: { poId } });
    const allReceived = allItems.every((i) => i.qtyReceived >= i.qtyOrdered);
    const anyReceived = allItems.some((i) => i.qtyReceived > 0);
    const newStatus = allReceived ? "RECEIVED" : anyReceived ? "PARTIAL" : "ORDERED";

    await tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: newStatus as never,
        receivedAt: allReceived ? new Date() : po.receivedAt,
      },
    });
  });

  await writeSystemAuditEvent({
    orgId,
    actorUserId: session.user.id,
    entityType: "GoodsReceived",
    entityId: grnId,
    action: "GOODS_RECEIVED",
    summary: `${grnNumber} received against PO ${po.reference ?? poId} (${updates.length} line${updates.length === 1 ? "" : "s"})`,
  });

  revalidatePath(`/inventory/purchase-orders/${poId}`);
  revalidatePath("/procurement");
  revalidatePath("/inventory/purchase-orders");
  revalidatePath("/inventory/goods-received");
  revalidatePath("/inventory");
  const actor = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } });
  notifyStockReceived({
    orgId,
    grnNumber,
    poReference: po.reference ?? undefined,
    itemCount: updates.length,
    actorName: actor?.name ?? actor?.email ?? "Unknown",
  }).catch(() => {});
  return {};
}
