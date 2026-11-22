/**
 * Itemise job invoices that were written before repairs carried invoice lines.
 *
 * A job invoice used to record only a total, so it could not be credited line by
 * line and the PDF printed a subtotal no line accounted for. This composes lines
 * for the ones that have none, using the same helper the live invoicing paths
 * now use.
 *
 * Safe by construction:
 *   - only touches invoices that have ZERO lines, so it is idempotent and never
 *     disturbs an invoice someone itemised by hand;
 *   - never writes Invoice.totalAmount — lines are derived from it;
 *   - verifies subtotal + tax == totalAmount for every invoice it writes, and
 *     rolls that invoice back if it does not.
 *
 * Usage:
 *   TDB=<libsql url> TTOK=<token> bun run scripts/migrations/backfill-job-invoice-lines.ts [--apply]
 *
 * Without --apply it reports what it would do and writes nothing.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

import { syncJobInvoiceLines } from "@/lib/commercial/job-invoice-lines";
import { normalizeCurrency } from "@/lib/currency";

const APPLY = process.argv.includes("--apply");

const db = process.env.TDB
  ? new PrismaClient({ adapter: new PrismaLibSql({ url: process.env.TDB, authToken: process.env.TTOK }) })
  : new PrismaClient();

const JOB_FIELDS = {
  id: true,
  brand: true,
  model: true,
  serviceType: true,
  issueDescription: true,
  clientBill: true,
  vatApplicable: true,
  softwareOsInstall: true,
  softwareDriversUpdates: true,
  softwareDataBackupRestore: true,
  softwareAccountSetup: true,
  softwarePerformanceTune: true,
  softwareThirdPartyApps: true,
} as const;

const candidates = await db.invoice.findMany({
  where: { jobId: { not: null }, lines: { none: {} } },
  select: {
    id: true,
    invoiceNumber: true,
    orgId: true,
    currency: true,
    totalAmount: true,
    job: { select: JOB_FIELDS },
  },
  orderBy: { issuedAt: "asc" },
});

console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${candidates.length} job invoice(s) with no lines\n`);

let written = 0;
let skippedNoBill = 0;
let failed = 0;

for (const inv of candidates) {
  const job = inv.job;
  if (!job || !inv.orgId) { skippedNoBill++; continue; }
  // Itemise against the INVOICE's own total, not the job's current clientBill.
  // For a historical document the invoice is the record of what the customer
  // was billed; a job whose bill was revised after invoicing would otherwise
  // produce lines that contradict the total. (One invoice on care is in exactly
  // that state.) The live invoicing path has no such gap — there the two are
  // the same number by construction.
  const bill = inv.totalAmount;
  if (!(bill > 0)) {
    skippedNoBill++;
    continue;
  }
  const jobBill = typeof job.clientBill === "number" ? job.clientBill : null;
  if (jobBill !== null && Math.abs(jobBill - bill) > 0.01) {
    console.log(`  note ${inv.invoiceNumber}: job bill ${jobBill} differs from invoice total ${bill}; itemising the invoice total`);
  }

  const currency = normalizeCurrency(inv.currency, "UGX");

  if (!APPLY) {
    console.log(`  would itemise ${inv.invoiceNumber} — bill ${bill} ${currency}`);
    written++;
    continue;
  }

  try {
    await db.$transaction(async (tx) => {
      const count = await syncJobInvoiceLines(tx, {
        orgId: inv.orgId!,
        invoiceId: inv.id,
        job,
        clientBill: bill,
        currency,
      });

      // The whole point is that the customer's total does not move. Verify it
      // from what actually landed, and abort this invoice if it did.
      const check = await tx.invoiceLine.findMany({ where: { invoiceId: inv.id }, select: { lineTotal: true, taxAmount: true } });
      const sum = check.reduce((s, l) => s + l.lineTotal + (l.taxAmount ?? 0), 0);
      if (Math.abs(sum - inv.totalAmount) > 0.01) {
        throw new Error(`lines sum to ${sum}, invoice total is ${inv.totalAmount}`);
      }
      console.log(`  ${inv.invoiceNumber}: ${count} line(s), sum ${sum} == total ${inv.totalAmount}`);
    });
    written++;
  } catch (e) {
    failed++;
    console.log(`  FAILED ${inv.invoiceNumber}: ${(e as Error).message}`);
  }
}

console.log(`\n${APPLY ? "written" : "would write"}=${written}  skipped(no bill)=${skippedNoBill}  failed=${failed}`);

if (APPLY) {
  const left = await db.invoice.count({ where: { jobId: { not: null }, lines: { none: {} } } });
  console.log(`job invoices still without lines: ${left}`);
}
