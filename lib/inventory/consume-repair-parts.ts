import { prisma } from "@/lib/prisma";

/**
 * Consume stock for the parts on a completed repair.
 *
 * The structured "parts used" for a repair are the part-linked line items on the
 * job's accepted quotation (QuotationItem.partId + quantity). When the job reaches
 * COMPLETED we decrement those from inventory so repairs actually reduce stock
 * (previously they never did — parts were free-text only).
 *
 * - Idempotent: skips if REPAIR_CONSUME ledger rows already exist for the job, so
 *   re-entering COMPLETED never double-decrements.
 * - Atomic: all decrements happen in one transaction (all-or-nothing).
 * - Part.qtyOnHand is authoritative (consistent with POS/manual adjust); stock may
 *   go negative — a completed repair that used a part is a fait accompli, and the
 *   ledger row surfaces any discrepancy for reconciliation rather than blocking
 *   completion.
 */
export async function consumeRepairPartsForJob(params: {
  orgId: string;
  jobId: string;
  userId: string;
}): Promise<void> {
  const { orgId, jobId, userId } = params;

  await prisma.$transaction(async (tx) => {
    const already = await tx.partStockTransaction.findFirst({
      where: { jobId, reason: { startsWith: "REPAIR_CONSUME" } },
      select: { id: true },
    });
    if (already) return;

    const quotation = await tx.quotation.findFirst({
      where: { jobId, orgId, status: "ACCEPTED" },
      orderBy: { acceptedAt: "desc" },
      select: {
        quoteNumber: true,
        items: {
          where: { partId: { not: null }, quantity: { gt: 0 } },
          select: { partId: true, quantity: true, description: true },
        },
      },
    });
    if (!quotation || quotation.items.length === 0) return;

    for (const item of quotation.items) {
      if (!item.partId) continue;
      const part = await tx.part.findFirst({
        where: { id: item.partId, orgId, isActive: true },
        select: { id: true },
      });
      if (!part) continue;

      await tx.part.update({
        where: { id: part.id },
        data: { qtyOnHand: { decrement: item.quantity } },
      });
      await tx.partStockTransaction.create({
        data: {
          partId: part.id,
          orgId,
          jobId,
          type: "OUT",
          quantity: item.quantity,
          reason: `REPAIR_CONSUME ${quotation.quoteNumber}: ${item.description}`.slice(0, 500),
          createdById: userId,
        },
      });
    }
  });
}
