"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { orgTagFor, maxNumberSequence, composeOrgNumber } from "@/lib/commercial/org-number";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { assertOrgCanMutate } from "@/lib/org-write";
import { notifyStockCountApproved } from "@/lib/notifications";

async function requireInventoryManager() {
  const ctx = await requireOrgSession();
  if (!can.manageInventory(ctx.user)) redirect("/inventory");
  assertOrgCanMutate({ access: ctx.org.access, userRole: ctx.user.role, userAccessMode: ctx.user.accessMode, kind: "GENERAL" });
  return ctx;
}

async function generateCountNumber(orgId: string) {
  const inner = `SC-${new Date().getFullYear()}-`;
  const [tag, rows] = await Promise.all([
    orgTagFor(orgId),
    prisma.stockCount.findMany({ where: { orgId, countNumber: { contains: inner , mode: "insensitive" as const} }, select: { countNumber: true } }),
  ]);
  const next = maxNumberSequence(inner, rows.map((r) => r.countNumber)) + 1;
  return composeOrgNumber(tag, inner, next);
}

type CountLine = { partId: string; systemQty: number; countedQty: number; note?: string };

function parseLines(raw: FormDataEntryValue | null): CountLine[] | null {
  try {
    const parsed = JSON.parse(String(raw ?? "[]")) as CountLine[];
    if (!Array.isArray(parsed)) return null;
    return parsed.map((line) => ({
      partId: String(line.partId ?? "").trim(),
      systemQty: Math.floor(Number(line.systemQty)),
      countedQty: Math.max(0, Math.floor(Number(line.countedQty))),
      note: String(line.note ?? "").trim() || undefined,
    }));
  } catch {
    return null;
  }
}

export async function createStockCountAction(formData: FormData): Promise<{ id?: string; error?: string }> {
  const { orgId, session } = await requireInventoryManager();
  const locationId = String(formData.get("locationId") ?? "").trim();
  const countedAtRaw = String(formData.get("countedAt") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const lines = parseLines(formData.get("items"));

  if (!locationId) return { error: "Location is required" };
  if (!lines?.length) return { error: "Add at least one counted item" };
  if (lines.some((line) => !line.partId || line.systemQty < 0 || line.countedQty < 0)) return { error: "Invalid count line" };

  const location = await prisma.stockLocation.findFirst({ where: { id: locationId, orgId, isActive: true }, select: { id: true } });
  if (!location) return { error: "Location not found" };

  const partIds = Array.from(new Set(lines.map((line) => line.partId)));
  const parts = await prisma.part.findMany({ where: { id: { in: partIds }, orgId, isActive: true }, select: { id: true } });
  if (parts.length !== partIds.length) return { error: "One or more inventory items are invalid" };

  // Snapshot system quantity server-side from the location's live stock — never
  // trust the client-supplied systemQty (which could be stale or forged).
  const locationStock = await prisma.partLocationStock.findMany({
    where: { orgId, locationId, partId: { in: partIds } },
    select: { partId: true, qtyOnHand: true },
  });
  const systemQtyByPart = new Map(locationStock.map((row) => [row.partId, row.qtyOnHand]));

  const stockCount = await prisma.stockCount.create({
    data: {
      orgId,
      countNumber: await generateCountNumber(orgId),
      status: "SUBMITTED",
      locationId,
      countedAt: countedAtRaw ? new Date(countedAtRaw) : new Date(),
      submittedAt: new Date(),
      note,
      createdById: session.user.id,
      items: {
        create: lines.map((line) => {
          const systemQty = systemQtyByPart.get(line.partId) ?? 0;
          return {
            partId: line.partId,
            systemQty,
            countedQty: line.countedQty,
            varianceQty: line.countedQty - systemQty,
            note: line.note ?? null,
          };
        }),
      },
    },
    select: { id: true },
  });

  revalidatePath("/inventory/stock-counts");
  return { id: stockCount.id };
}

export async function cancelStockCountAction(formData: FormData): Promise<void> {
  const { orgId } = await requireInventoryManager();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await prisma.stockCount.updateMany({ where: { id, orgId, status: { in: ["DRAFT", "SUBMITTED"] } }, data: { status: "CANCELLED" } });
  revalidatePath("/inventory/stock-counts");
  revalidatePath(`/inventory/stock-counts/${id}`);
}

export async function approveStockCountAction(formData: FormData): Promise<void> {
  const { orgId, session } = await requireInventoryManager();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const approved = await prisma.$transaction(async (tx) => {
    const count = await tx.stockCount.findFirst({
      where: { id, orgId, status: "SUBMITTED" },
      include: { items: true },
    });
    if (!count) return null;

    for (const item of count.items) {
      if (item.varianceQty === 0) continue;
      const current = await tx.partLocationStock.findUnique({
        where: { partId_locationId: { partId: item.partId, locationId: count.locationId } },
        select: { qtyOnHand: true },
      });
      const currentQty = current?.qtyOnHand ?? 0;
      const nextQty = currentQty + item.varianceQty;
      if (nextQty < 0) throw new Error("Stock count approval would create negative stock");

      await tx.partLocationStock.upsert({
        where: { partId_locationId: { partId: item.partId, locationId: count.locationId } },
        create: { orgId, partId: item.partId, locationId: count.locationId, qtyOnHand: item.varianceQty, qtyReserved: 0 },
        update: { qtyOnHand: { increment: item.varianceQty } },
      });
      await tx.partStockTransaction.create({
        data: { partId: item.partId, orgId, locationId: count.locationId, sourceType: "STOCK_COUNT", sourceId: id, type: "ADJUST", quantity: item.varianceQty, reason: `STOCK_COUNT ${count.countNumber}: system=${item.systemQty} counted=${item.countedQty}`, createdById: session.user.id },
      });
      // Part.qtyOnHand is authoritative: apply the counted variance as a delta
      // rather than recomputing from SUM(location), which would wipe unlocated
      // stock recorded via manual adjustments or POS (C2 corruption fix).
      await tx.part.update({ where: { id: item.partId }, data: { qtyOnHand: { increment: item.varianceQty } } });
    }

    await tx.stockCount.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: session.user.id } });
    return { countNumber: count.countNumber, variances: count.items.filter((i) => i.varianceQty !== 0).length };
  });

  if (approved) {
    await writeSystemAuditEvent({
      orgId,
      actorUserId: session.user.id,
      entityType: "StockCount",
      entityId: id,
      action: "STOCK_COUNT_APPROVED",
      summary: `${approved.countNumber} approved (${approved.variances} variance line${approved.variances === 1 ? "" : "s"})`,
    });
  }

  revalidatePath("/inventory/stock-counts");
  revalidatePath(`/inventory/stock-counts/${id}`);
  revalidatePath("/inventory");
  // Fetch count details for notification (after transaction)
  const count = await prisma.stockCount.findUnique({
    where: { id },
    select: { countNumber: true, items: { select: { varianceQty: true } } },
  });
  if (count) {
    const varianceCount = count.items.filter((i) => i.varianceQty !== 0).length;
    const actor = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } });
    notifyStockCountApproved({
      orgId,
      countNumber: count.countNumber,
      varianceCount,
      actorName: actor?.name ?? actor?.email ?? "Unknown",
    }).catch(() => {});
  }
}
