// @ts-nocheck
/**
 * C5 verification: exercise the cash-basis posting engine against a real org
 * and confirm (a) core accounts seed, (b) entries balance, (c) the P&L
 * aggregation picks them up, (d) posting is idempotent. Cleans up after itself.
 *
 *   bun run scripts/verify-c5-posting.ts
 */
import { prisma } from "@/lib/prisma";
import { postSalePayment, postExpensePayment, postRefund, postSupplierPayment } from "@/lib/accounting/post";

const TEST_PREFIX = "c5-verify:";

async function main() {
  const org = await prisma.organization.findFirst({ select: { id: true, name: true } });
  if (!org) throw new Error("No organization found");
  const user = await prisma.user.findFirst({ where: { orgId: org.id }, select: { id: true } });
  if (!user) throw new Error("No user in org");
  const orgId = org.id;
  const userId = user.id;
  console.log(`Org: ${org.name} (${orgId})`);

  // Clean any leftovers from a prior run.
  await cleanup(orgId);

  const before = await ledgerSnapshot(orgId);

  // Run one of each money event.
  await prisma.$transaction((tx) => postSalePayment(tx, { orgId, userId, amount: 100000, reference: `${TEST_PREFIX}sale`, description: "verify sale payment" }));
  await prisma.$transaction((tx) => postExpensePayment(tx, { orgId, userId, amount: 30000, reference: `${TEST_PREFIX}expense`, description: "verify expense" }));
  await prisma.$transaction((tx) => postRefund(tx, { orgId, userId, amount: 20000, reference: `${TEST_PREFIX}refund`, description: "verify refund" }));
  await prisma.$transaction((tx) => postSupplierPayment(tx, { orgId, userId, amount: 40000, reference: `${TEST_PREFIX}supplier`, description: "verify supplier payment" }));

  // Idempotency: re-run the sale post; must NOT create a second entry.
  await prisma.$transaction((tx) => postSalePayment(tx, { orgId, userId, amount: 100000, reference: `${TEST_PREFIX}sale`, description: "verify sale payment (dup)" }));

  const entries = await prisma.journalEntry.findMany({
    where: { orgId, reference: { startsWith: TEST_PREFIX } },
    include: { lines: { include: { account: true } } },
    orderBy: { entryNumber: "asc" },
  });

  console.log(`\nEntries created: ${entries.length} (expect 4 — idempotent dup suppressed)`);
  let allBalanced = true;
  for (const e of entries) {
    const dr = e.lines.reduce((s, l) => s + l.debit, 0);
    const cr = e.lines.reduce((s, l) => s + l.credit, 0);
    const balanced = Math.abs(dr - cr) < 0.01;
    allBalanced &&= balanced;
    const legs = e.lines.map((l) => `${l.account.code}/${l.account.name} ${l.debit ? "Dr " + l.debit : "Cr " + l.credit}`).join("  |  ");
    console.log(`  ${e.entryNumber} POSTED dr=${dr} cr=${cr} ${balanced ? "OK" : "UNBALANCED"} :: ${legs}`);
  }

  // P&L aggregation (same shape as the report): revenue - expenses over POSTED lines.
  const after = await ledgerSnapshot(orgId);
  const dRevenue = after.revenue - before.revenue;
  const dExpense = after.expense - before.expense;

  console.log(`\nP&L delta from this run:`);
  console.log(`  Revenue (4000, net of refund contra): +${dRevenue}  (expect 80000 = 100000 sale - 20000 refund)`);
  console.log(`  Expense (5000+6000): +${dExpense}  (expect 70000 = 30000 opex + 40000 cost of sales)`);

  // All 6 core codes must resolve (some may pre-exist un-flagged from prior test data).
  const coreCodes = ["1000", "2100", "3000", "4000", "5000", "6000"];
  const present = await prisma.chartOfAccount.count({ where: { orgId, code: { in: coreCodes } } });
  console.log(`\nCore account codes present: ${present}/6`);

  const pass =
    entries.length === 4 &&
    allBalanced &&
    Math.abs(dRevenue - 80000) < 0.01 &&
    Math.abs(dExpense - 70000) < 0.01 &&
    present === 6;

  await cleanup(orgId);
  console.log(`\n${pass ? "PASS" : "FAIL"} — cleaned up test entries.`);
  if (!pass) process.exit(1);
}

async function ledgerSnapshot(orgId: string) {
  const lines = await prisma.journalLine.findMany({
    where: { journalEntry: { orgId, status: "POSTED" } },
    include: { account: { select: { type: true } } },
  });
  let revenue = 0;
  let expense = 0;
  for (const l of lines) {
    if (l.account.type === "REVENUE") revenue += l.credit - l.debit;
    if (l.account.type === "EXPENSE") expense += l.debit - l.credit;
  }
  return { revenue, expense };
}

async function cleanup(orgId: string) {
  const ids = (await prisma.journalEntry.findMany({ where: { orgId, reference: { startsWith: TEST_PREFIX } }, select: { id: true } })).map((e) => e.id);
  if (ids.length) {
    await prisma.journalLine.deleteMany({ where: { journalEntryId: { in: ids } } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: ids } } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
