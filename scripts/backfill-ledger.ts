// @ts-nocheck
/**
 * C5 ledger backfill: post historical money-events into the double-entry
 * ledger so the P&L / Balance Sheet / Trial Balance reflect past activity,
 * not just transactions recorded after C5 shipped.
 *
 * Every post is idempotent on the same per-event reference key the live code
 * uses (pay:/refund:/expense:/supplier-pay:), so this is safe to run more than
 * once and can never double-post against the auto-posting going forward.
 *
 *   bun run scripts/backfill-ledger.ts --dry-run
 *   bun run scripts/backfill-ledger.ts
 */
import { prisma } from "@/lib/prisma";
import { postSalePayment, postRefund, postExpensePayment, postSupplierPayment } from "@/lib/accounting/post";

const DRY = process.argv.includes("--dry-run");

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  const grand = { sale: 0, repairRefund: 0, refund: 0, expense: 0, supplier: 0, skipped: 0 };

  for (const org of orgs) {
    const orgId = org.id;
    // Fallback author for rows with a null createdById.
    const fallback = await prisma.user.findFirst({
      where: { orgId },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    const fallbackUser = fallback?.id ?? null;

    const [payments, refunds, expenses, supplierPayments] = await Promise.all([
      prisma.payment.findMany({ where: { orgId }, select: { id: true, amount: true, kind: true, receivedAt: true, createdById: true } }),
      prisma.refund.findMany({ where: { orgId }, select: { id: true, amount: true, refundedAt: true, createdById: true } }),
      prisma.expense.findMany({ where: { orgId }, select: { id: true, amount: true, paidAt: true, createdAt: true, createdById: true, expenseNumber: true } }),
      prisma.supplierPayment.findMany({ where: { orgId }, select: { id: true, amount: true, paidAt: true, createdById: true } }),
    ]);

    const c = { sale: 0, repairRefund: 0, refund: 0, expense: 0, supplier: 0, skipped: 0 };

    for (const p of payments) {
      const userId = p.createdById ?? fallbackUser;
      if (!userId) { c.skipped++; continue; }
      const isRefund = p.kind === "REFUND";
      if (DRY) { isRefund ? c.repairRefund++ : c.sale++; continue; }
      await prisma.$transaction((tx) =>
        isRefund
          ? postRefund(tx, { orgId, userId, amount: p.amount, date: p.receivedAt, reference: `pay:${p.id}`, description: "Refund (backfill)" })
          : postSalePayment(tx, { orgId, userId, amount: p.amount, date: p.receivedAt, reference: `pay:${p.id}`, description: "Payment received (backfill)" }),
      );
      isRefund ? c.repairRefund++ : c.sale++;
    }

    for (const r of refunds) {
      const userId = r.createdById ?? fallbackUser;
      if (!userId) { c.skipped++; continue; }
      if (!DRY) await prisma.$transaction((tx) => postRefund(tx, { orgId, userId, amount: r.amount, date: r.refundedAt, reference: `refund:${r.id}`, description: "Refund (backfill)" }));
      c.refund++;
    }

    for (const e of expenses) {
      const userId = e.createdById ?? fallbackUser;
      if (!userId) { c.skipped++; continue; }
      if (!DRY) await prisma.$transaction((tx) => postExpensePayment(tx, { orgId, userId, amount: e.amount, date: e.paidAt ?? e.createdAt, reference: `expense:${e.id}`, description: `Expense ${e.expenseNumber} (backfill)` }));
      c.expense++;
    }

    for (const s of supplierPayments) {
      const userId = s.createdById ?? fallbackUser;
      if (!userId) { c.skipped++; continue; }
      if (!DRY) await prisma.$transaction((tx) => postSupplierPayment(tx, { orgId, userId, amount: s.amount, date: s.paidAt, reference: `supplier-pay:${s.id}`, description: "Supplier payment (backfill)" }));
      c.supplier++;
    }

    const total = c.sale + c.repairRefund + c.refund + c.expense + c.supplier;
    if (total || c.skipped) {
      console.log(`${org.name}: sale=${c.sale} repairRefund=${c.repairRefund} refund=${c.refund} expense=${c.expense} supplier=${c.supplier} skipped=${c.skipped}`);
    }
    for (const k of Object.keys(grand) as (keyof typeof grand)[]) grand[k] += c[k];
  }

  console.log(`\n${DRY ? "[DRY RUN] would post" : "Posted"} — sale=${grand.sale} repairRefund=${grand.repairRefund} refund=${grand.refund} expense=${grand.expense} supplier=${grand.supplier} skipped(no author)=${grand.skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
