/**
 * Business-level check on an imported database.
 *
 * The row/sum/timestamp comparison in verify-import.mjs proves the copy is
 * faithful. This proves the result is *usable*: that relationships still
 * resolve now that Postgres enforces the foreign keys SQLite only declared,
 * that enum values became valid native enum labels, that money reads back as
 * numbers, and that the duplicate resolutions did what they claimed.
 *
 * The expected figures are those of the production snapshot; adjust them when
 * run against a different dump.
 *
 *   DATABASE_URL=... bun scripts/pg/verify-business.ts
 */

import { prisma } from "@/lib/prisma";

let fails = 0;
const ok = (n: string, c: boolean, e = "") => { console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${e ? "  →  " + e : ""}`); if (!c) fails++; };

console.log("\n-- imported production data, read through the application client --");
const [orgs, clients, jobs, invoices, payments] = await Promise.all([
  prisma.organization.count(), prisma.client.count(), prisma.job.count(),
  prisma.invoice.count(), prisma.payment.count(),
]);
ok("counts match the source dump", orgs === 1 && clients === 77 && jobs === 75 && invoices === 56 && payments === 64,
   `orgs=${orgs} clients=${clients} jobs=${jobs} invoices=${invoices} payments=${payments}`);

const pay = await prisma.payment.aggregate({ _sum: { amount: true } });
ok("SUM(Payment.amount) = 20,348,100", pay._sum.amount === 20348100, String(pay._sum.amount));
const inv = await prisma.invoice.aggregate({ _sum: { totalAmount: true, paidAmount: true } });
ok("SUM(Invoice.totalAmount) = 18,160,000", inv._sum.totalAmount === 18160000, String(inv._sum.totalAmount));
ok("SUM(Invoice.paidAmount) = 16,630,000", inv._sum.paidAmount === 16630000, String(inv._sum.paidAmount));
ok("money reads as number, not Decimal", typeof pay._sum.amount === "number");

console.log("\n-- relationships survive (Postgres now enforces these keys) --");
const withChain = await prisma.invoice.findFirst({
  where: { jobId: { not: null }, payments: { some: {} } },
  include: { job: { include: { client: true } }, client: true, payments: true },
});
ok("invoice -> job -> client -> payments resolves", Boolean(withChain?.job?.client && withChain.payments.length),
   withChain ? `${withChain.invoiceNumber} job=${withChain.job?.jobNumber} client=${withChain.job?.client?.fullName} payments=${withChain.payments.length}` : "none");
const orphan = await prisma.$queryRaw<Array<{ n: number }>>`
  SELECT COUNT(*)::int AS n FROM "Job" j
  LEFT JOIN "Client" c ON c.id = j."clientId" WHERE c.id IS NULL`;
ok("no jobs with a dangling client", Number(orphan[0].n) === 0, String(orphan[0].n));

console.log("\n-- enum values round-tripped into native Postgres enums --");
const byStatus = await prisma.job.groupBy({ by: ["status"], _count: { _all: true } });
ok("job statuses present", byStatus.length === 7, byStatus.map((r) => `${r.status}:${r._count._all}`).join(" "));
const byMethod = await prisma.payment.groupBy({ by: ["method"], _count: { _all: true } });
ok("payment methods present", byMethod.length >= 1, byMethod.map((r) => `${r.method}:${r._count._all}`).join(" "));

console.log("\n-- the duplicate resolution did what it claimed --");
const dupes = await prisma.$queryRaw<Array<{ n: number }>>`
  SELECT COUNT(*)::int AS n FROM (
    SELECT "invoiceNumber" FROM "Job" WHERE "invoiceNumber" IS NOT NULL
    GROUP BY "invoiceNumber" HAVING COUNT(*) > 1) d`;
ok("no duplicate Job.invoiceNumber remains", Number(dupes[0].n) === 0, String(dupes[0].n));
const kept = await prisma.job.count({ where: { invoiceNumber: { not: null } } });
// 75 jobs, 19 of which never had an invoice number; 56 did, and 15 of those
// were surplus duplicates that the resolver cleared. 56 - 15 = 41.
ok("41 jobs keep an invoice number (56 had one, 15 surplus cleared)", kept === 41, String(kept));
// Each surviving number must be the one its Invoice points at.
const mismatched = await prisma.$queryRaw<Array<{ n: number }>>`
  SELECT COUNT(*)::int AS n FROM "Job" j
  JOIN "Invoice" i ON i."invoiceNumber" = j."invoiceNumber"
  WHERE j."invoiceNumber" IS NOT NULL AND i."jobId" IS NOT NULL AND i."jobId" <> j.id`;
ok("every kept number sits on the job its Invoice references", Number(mismatched[0].n) === 0, String(mismatched[0].n));

console.log("\n-- branding fallback still resolves after clearing the singleton's orgId --");
const branding = await prisma.documentBrandingSettings.findMany({ select: { id: true, orgId: true } });
ok("two rows, one org-scoped, one legacy singleton",
   branding.length === 2 && branding.some((b) => b.orgId !== null) && branding.some((b) => b.id === "singleton" && b.orgId === null),
   branding.map((b) => `${b.id}:${b.orgId}`).join(" "));

console.log("\n-- dates landed as real instants --");
const oldest = await prisma.auditLog.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
const newest = await prisma.auditLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
ok("AuditLog spans 2026-04-10 .. 2026-07-08", oldest!.createdAt.toISOString().startsWith("2026-04-10") && newest!.createdAt.toISOString().startsWith("2026-07-08"),
   `${oldest!.createdAt.toISOString()} .. ${newest!.createdAt.toISOString()}`);
const ms = await prisma.payment.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
ok("milliseconds preserved", ms!.createdAt.getUTCMilliseconds() !== 0, ms!.createdAt.toISOString());

console.log(`\n${fails === 0 ? "ALL PASS" : fails + " FAILURES"}\n`);
process.exit(fails === 0 ? 0 : 1);
