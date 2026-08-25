/**
 * Business-level check on an imported database.
 *
 * verify-import.mjs proves the copy is faithful — row counts, numeric sums,
 * timestamp ranges. This proves the result is *usable*: that relationships still
 * resolve now that Postgres enforces the foreign keys SQLite only declared, that
 * enum values became valid native labels, that money reads back as numbers, and
 * that the duplicate resolutions did what they claimed.
 *
 * Expected figures are read from the baseline fingerprint rather than hardcoded,
 * so this does not have to be edited for each new dump.
 *
 *   DATABASE_URL=... bun scripts/pg/verify-business.ts [baseline.json]
 */

import { readFileSync } from "node:fs";

import { prisma } from "@/lib/prisma";

const baselinePath = process.argv[2] ?? "docs/pg-migration/baseline.mrms-prod.json";
const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as {
  tables: Record<string, { rows: number; sums?: Record<string, { sum: number | null; nonNull: number }> }>;
};

let fails = 0;
const ok = (n: string, c: boolean, e = "") => {
  console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${e ? "  →  " + e : ""}`);
  if (!c) fails++;
};

const rowsOf = (table: string) => baseline.tables[table]?.rows ?? 0;
const sumOf = (table: string, column: string) => baseline.tables[table]?.sums?.[column]?.sum ?? null;

console.log(`\n-- counts match the source dump (${baselinePath}) --`);
for (const table of ["Organization", "Client", "Job", "Invoice", "Payment", "Sale", "AuditLog", "OutboundMessage"]) {
  const delegate = (prisma as unknown as Record<string, { count: () => Promise<number> }>)[
    table.charAt(0).toLowerCase() + table.slice(1)
  ];
  const actual = await delegate.count();
  ok(`${table}: ${actual}`, actual === rowsOf(table), `expected ${rowsOf(table)}`);
}

console.log("\n-- money: exact totals, and read back as numbers --");
const payAgg = await prisma.payment.aggregate({ _sum: { amount: true } });
ok("SUM(Payment.amount)", payAgg._sum.amount === sumOf("Payment", "amount"),
   `${payAgg._sum.amount} vs ${sumOf("Payment", "amount")}`);
const invAgg = await prisma.invoice.aggregate({ _sum: { totalAmount: true, paidAmount: true } });
ok("SUM(Invoice.totalAmount)", invAgg._sum.totalAmount === sumOf("Invoice", "totalAmount"),
   `${invAgg._sum.totalAmount} vs ${sumOf("Invoice", "totalAmount")}`);
ok("SUM(Invoice.paidAmount)", invAgg._sum.paidAmount === sumOf("Invoice", "paidAmount"),
   `${invAgg._sum.paidAmount} vs ${sumOf("Invoice", "paidAmount")}`);
// Job money columns are @map'd: externalTechBill -> costEstimate, clientBill -> finalCost.
const jobAgg = await prisma.job.aggregate({ _sum: { clientBill: true, externalTechBill: true } });
ok("SUM(Job.clientBill) [finalCost]", jobAgg._sum.clientBill === sumOf("Job", "finalCost"),
   `${jobAgg._sum.clientBill} vs ${sumOf("Job", "finalCost")}`);
ok("money is number, not Decimal", typeof payAgg._sum.amount === "number");

console.log("\n-- relationships survive (Postgres now enforces these keys) --");
const chain = await prisma.invoice.findFirst({
  where: { jobId: { not: null }, payments: { some: {} } },
  include: { job: { include: { client: true } }, payments: true },
});
ok("invoice -> job -> client -> payments resolves", Boolean(chain?.job?.client && chain.payments.length),
   chain ? `${chain.invoiceNumber} job=${chain.job?.jobNumber} payments=${chain.payments.length}` : "none found");
for (const [label, sql] of [
  ["jobs with a dangling client", `SELECT COUNT(*)::int AS n FROM "Job" j LEFT JOIN "Client" c ON c.id = j."clientId" WHERE c.id IS NULL`],
  ["payments with a dangling invoice", `SELECT COUNT(*)::int AS n FROM "Payment" p LEFT JOIN "Invoice" i ON i.id = p."invoiceId" WHERE p."invoiceId" IS NOT NULL AND i.id IS NULL`],
  ["sale items with a dangling sale", `SELECT COUNT(*)::int AS n FROM "SaleItem" s LEFT JOIN "Sale" x ON x.id = s."saleId" WHERE x.id IS NULL`],
] as const) {
  const r = await prisma.$queryRawUnsafe<Array<{ n: number }>>(sql);
  ok(`no ${label}`, Number(r[0].n) === 0, String(r[0].n));
}

console.log("\n-- enum values became valid native Postgres labels --");
const byStatus = await prisma.job.groupBy({ by: ["status"], _count: { _all: true } });
ok("job statuses", byStatus.length > 0, byStatus.map((r) => `${r.status}:${r._count._all}`).join(" "));
const byMethod = await prisma.payment.groupBy({ by: ["method"], _count: { _all: true } });
ok("payment methods", byMethod.length > 0, byMethod.map((r) => `${r.method}:${r._count._all}`).join(" "));

console.log("\n-- duplicate resolution did what it claimed --");
const dupes = await prisma.$queryRaw<Array<{ n: number }>>`
  SELECT COUNT(*)::int AS n FROM (
    SELECT "invoiceNumber" FROM "Job" WHERE "invoiceNumber" IS NOT NULL
    GROUP BY "invoiceNumber" HAVING COUNT(*) > 1) d`;
ok("no duplicate Job.invoiceNumber remains", Number(dupes[0].n) === 0, String(dupes[0].n));
const mismatched = await prisma.$queryRaw<Array<{ n: number }>>`
  SELECT COUNT(*)::int AS n FROM "Job" j
  JOIN "Invoice" i ON i."invoiceNumber" = j."invoiceNumber"
  WHERE j."invoiceNumber" IS NOT NULL AND i."jobId" IS NOT NULL AND i."jobId" <> j.id`;
ok("every kept number sits on the job its Invoice references", Number(mismatched[0].n) === 0, String(mismatched[0].n));

console.log("\n-- dates landed as real instants --");
const oldest = await prisma.auditLog.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
const newest = await prisma.auditLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
ok("AuditLog spans a plausible range", Boolean(oldest && newest && oldest.createdAt < newest.createdAt),
   `${oldest?.createdAt.toISOString()} .. ${newest?.createdAt.toISOString()}`);
const withMs = await prisma.payment.findFirst({
  where: { createdAt: { not: undefined } },
  orderBy: { createdAt: "asc" },
  select: { createdAt: true },
});
ok("milliseconds preserved", (withMs?.createdAt.getUTCMilliseconds() ?? 0) !== 0, withMs?.createdAt.toISOString());

console.log(`\n${fails === 0 ? "ALL PASS" : fails + " FAILURES"}\n`);
process.exit(fails === 0 ? 0 : 1);
