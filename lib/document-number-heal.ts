import { nextDocumentNumber } from "@/lib/commercial/document-workflow";
import type { Db } from "@/lib/prisma";

/**
 * Repairs for document numbering, run as part of Data Heal.
 *
 * Both problems came in with imported data. Jobs carried over from the old
 * database kept the numbers they had been given there, but the counters those
 * numbers were drawn from were not carried with them, and the two databases had
 * been issuing from the same monthly series independently.
 *
 * 1. Counters behind. DocumentSequence(orgId, type, year, month) sat below the
 *    highest number already in use, or did not exist. Allocation now walks past
 *    taken numbers, so this no longer fails — but each allocation pays for the
 *    gap one lookup at a time, and a gap wider than the retry limit would still
 *    fail. Raising the counter to the highest number in use removes the gap.
 *    A counter is only ever raised.
 *
 * 2. One invoice number on two documents. A job holds an invoice number that an
 *    Invoice row belonging to something else also holds. The Invoice row keeps
 *    it: it is the persisted document, with lines and a client, and it is the
 *    rule the app already applies — opening the job's invoice finds its stored
 *    number taken and allocates another. Doing it here means the job is
 *    renumbered once, deliberately and with an audit entry, instead of silently
 *    the next time somebody opens the PDF. The new number is drawn from the
 *    month the job's invoice was issued in.
 *
 * Idempotent: a second run finds nothing to do.
 */

export type DocumentNumberHealResult = {
  countersBehind: Array<{ orgId: string; type: string; year: number; month: number; from: number | null; to: number }>;
  countersRaised: number;
  duplicateInvoiceNumbers: Array<{ jobId: string; jobNumber: string; from: string; to: string | null }>;
  invoiceNumbersReassigned: number;
};

type InUseRow = { orgId: string; type: string; year: number; month: number; max: number };

/**
 * Highest sequence in use per org, type and month, across every column that
 * holds a universal-format number (TAG/TYPE/YYYY/MM/NNN). Legacy formats do not
 * match the pattern and are left alone: they never drew from these counters.
 */
async function highestNumbersInUse(prisma: Db): Promise<InUseRow[]> {
  const rows = await prisma.$queryRaw<Array<{ orgId: string; type: string; year: number; month: number; max: number }>>`
    WITH numbers AS (
      SELECT "orgId", "jobNumber" AS n FROM "Job"
      UNION ALL SELECT "orgId", "invoiceNumber" FROM "Job" WHERE "invoiceNumber" IS NOT NULL
      UNION ALL SELECT "orgId", "quotationNumber" FROM "Job" WHERE "quotationNumber" IS NOT NULL
      UNION ALL SELECT "orgId", "invoiceNumber" FROM "Invoice"
      UNION ALL SELECT "orgId", "quoteNumber" FROM "Quotation"
      UNION ALL SELECT "orgId", "receiptNumber" FROM "Receipt"
      UNION ALL SELECT "orgId", "deliveryNoteNumber" FROM "DeliveryNote"
      UNION ALL SELECT "orgId", "creditNoteNumber" FROM "CreditNote"
      UNION ALL SELECT "orgId", "complaintNumber" FROM "Complaint"
    ), parsed AS (
      SELECT "orgId", regexp_match(n, '^[^/]+/([A-Z]+)/([0-9]{4})/([0-9]{2})/([0-9]{1,9})$') AS m
      FROM numbers
      WHERE "orgId" IS NOT NULL
    )
    SELECT "orgId",
           m[1] AS "type",
           m[2]::int AS "year",
           m[3]::int AS "month",
           MAX(m[4]::int)::int AS "max"
    FROM parsed
    WHERE m IS NOT NULL
    GROUP BY 1, 2, 3, 4
  `;
  return rows.map((row) => ({
    orgId: row.orgId,
    type: row.type,
    year: Number(row.year),
    month: Number(row.month),
    max: Number(row.max),
  }));
}

export async function healDocumentNumbers(
  prisma: Db,
  options: { dryRun?: boolean; actorUserId?: string } = {},
): Promise<DocumentNumberHealResult> {
  const dryRun = options.dryRun === true;
  const result: DocumentNumberHealResult = {
    countersBehind: [],
    countersRaised: 0,
    duplicateInvoiceNumbers: [],
    invoiceNumbersReassigned: 0,
  };

  // ── 1. Counters ────────────────────────────────────────────────────────────
  // First, so the renumbering below draws from a counter that is already past
  // everything in use.
  for (const used of await highestNumbersInUse(prisma)) {
    if (used.month < 1 || used.month > 12) continue;
    const key = { orgId: used.orgId, type: used.type, year: used.year, month: used.month };
    const existing = await prisma.documentSequence.findUnique({
      where: { orgId_type_year_month: key },
      select: { value: true },
    });
    if (existing && existing.value >= used.max) continue;

    result.countersBehind.push({ ...key, from: existing?.value ?? null, to: used.max });
    if (dryRun) continue;

    if (existing) {
      // Guarded on the value so a number allocated since the read is never undone.
      await prisma.documentSequence.updateMany({
        where: { ...key, value: { lt: used.max } },
        data: { value: used.max },
      });
    } else {
      await prisma.documentSequence.upsert({
        where: { orgId_type_year_month: key },
        create: { ...key, value: used.max },
        update: {},
      });
    }
    result.countersRaised += 1;
  }

  // ── 2. One invoice number on two documents ─────────────────────────────────
  const clashes = await prisma.$queryRaw<
    Array<{ jobId: string; jobNumber: string; orgId: string; invoiceNumber: string; invoiceIssuedAt: Date | null; createdById: string }>
  >`
    SELECT j."id" AS "jobId", j."jobNumber", j."orgId", j."invoiceNumber", j."invoiceIssuedAt", j."createdById"
    FROM "Job" j
    JOIN "Invoice" i ON i."invoiceNumber" = j."invoiceNumber"
    WHERE i."jobId" IS DISTINCT FROM j."id"
    ORDER BY j."invoiceIssuedAt" NULLS LAST, j."jobNumber"
  `;

  for (const clash of clashes) {
    if (dryRun) {
      result.duplicateInvoiceNumbers.push({ jobId: clash.jobId, jobNumber: clash.jobNumber, from: clash.invoiceNumber, to: null });
      continue;
    }

    const reassigned = await prisma.$transaction(async (tx) => {
      // Re-read inside the transaction: the app renumbers the same job if
      // somebody opens its invoice first.
      const job = await tx.job.findUnique({ where: { id: clash.jobId }, select: { invoiceNumber: true } });
      if (job?.invoiceNumber !== clash.invoiceNumber) return null;

      const next = await nextDocumentNumber(tx, "INV", "invoice", clash.orgId, clash.invoiceIssuedAt ?? new Date());
      await tx.job.update({ where: { id: clash.jobId }, data: { invoiceNumber: next } });
      await tx.auditLog.create({
        data: {
          orgId: clash.orgId,
          jobId: clash.jobId,
          userId: options.actorUserId ?? clash.createdById,
          action: "DATA_HEAL_INVOICE_RENUMBERED",
          detail: JSON.stringify({
            from: clash.invoiceNumber,
            to: next,
            reason: "invoice number also held by another invoice",
            source: "data-heal",
          }),
        },
      });
      return next;
    });

    if (!reassigned) continue;
    result.duplicateInvoiceNumbers.push({ jobId: clash.jobId, jobNumber: clash.jobNumber, from: clash.invoiceNumber, to: reassigned });
    result.invoiceNumbersReassigned += 1;
  }

  return result;
}
