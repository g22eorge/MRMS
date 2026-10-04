/**
 * Adds Job.quotationNumber and backfills it with the number each job has
 * already been sending.
 *
 * Job quotations print a number but never create a Quotation row, so before
 * this column the number was rebuilt from the job number on every render by
 * deriveDocNumberFromJob — which returns the slash form for a slash-era job
 * number and "QT-" + the raw job number for anything else. Job numbering has
 * changed shape four times, so quotation numbers inherited four shapes.
 *
 * The backfill is the part that matters. Every job already quoted has sent a
 * PDF carrying its derived number, and that number must survive: the customer
 * is holding it. Writing the derived value into the new column makes the
 * reuse path pick it up, so history is preserved exactly and only quotes
 * issued from here on take an allocated EIS/QT/YYYY/NNNN.
 *
 * Idempotent: the column add is skipped when present, and the backfill only
 * touches rows where quotationNumber is still null.
 *
 *   node scripts/job-quotation-number.mjs            # report only
 *   node scripts/job-quotation-number.mjs --apply    # write
 */

import { createClient } from "@libsql/client";

const APPLY = process.argv.includes("--apply");
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  // Exit clean, matching the sibling heal scripts: this runs as a build step,
  // and a missing URL means "not a real deploy", not "the deploy is broken".
  console.error("[qt-number] TURSO_DATABASE_URL is not set — nothing to do.");
  process.exit(0);
}

const client = createClient({ url, authToken });

/** Mirrors deriveDocNumberFromJob in lib/documents.ts. Keep the two in step. */
function deriveDocNumberFromJob(jobNumber, type) {
  const slash = String(jobNumber).match(/^(.+?)\/(\d{4})\/(\d+)$/);
  if (slash) {
    const [, prefix, year, seq] = slash;
    return `${prefix}/${type}/${year}/${seq}`;
  }
  return `${type}-${jobNumber}`;
}

async function main() {
  const cols = (await client.execute("PRAGMA table_info(Job)")).rows.map((r) => r.name);
  let columnExists = cols.includes("quotationNumber");

  if (!columnExists) {
    if (!APPLY) {
      console.log("[qt-number] would add Job.quotationNumber and its unique index.");
    } else {
      await client.execute(`ALTER TABLE "Job" ADD COLUMN "quotationNumber" TEXT`);
      // Re-flag, not re-read: the backfill below must run in this same pass.
      // Reading the column list only once, before the ALTER, silently skips it.
      columnExists = true;
      console.log("[qt-number] added Job.quotationNumber.");
    }
  } else {
    console.log("[qt-number] Job.quotationNumber already present.");
  }

  if (!columnExists) {
    // Dry run against a database that has not been migrated yet. Count from
    // quotedAt alone so the report is still useful.
    const quoted = await client.execute(`SELECT count(*) AS n FROM Job WHERE quotedAt IS NOT NULL`);
    console.log(`[qt-number] Dry run: ${quoted.rows[0].n} quoted job(s) would have their number preserved.`);
    return;
  }

  // Only jobs that have actually been quoted have sent a number worth keeping.
  // A job never quoted has printed nothing, so it should take a freshly
  // allocated number the first time it is sent rather than a derived one.
  const pending = await client.execute(`
    SELECT id, jobNumber FROM Job
    WHERE quotedAt IS NOT NULL
      AND (quotationNumber IS NULL OR trim(quotationNumber) = '')
  `);

  console.log(`[qt-number] ${pending.rows.length} quoted job(s) need their existing number preserved.`);

  // A duplicate would break the unique index, and would mean two jobs have been
  // sending the same quotation number — worth knowing about either way.
  const seen = new Map();
  const clashes = [];
  for (const j of pending.rows) {
    const derived = deriveDocNumberFromJob(j.jobNumber, "QT");
    if (seen.has(derived)) clashes.push([seen.get(derived), j.jobNumber, derived]);
    else seen.set(derived, j.jobNumber);
  }
  const taken = await client.execute(
    `SELECT quotationNumber FROM Job WHERE quotationNumber IS NOT NULL AND trim(quotationNumber) <> ''`,
  ).catch(() => ({ rows: [] }));
  for (const t of taken.rows) {
    if (seen.has(t.quotationNumber)) clashes.push([seen.get(t.quotationNumber), "(existing row)", t.quotationNumber]);
  }
  if (clashes.length) {
    console.error(`[qt-number] ABORT — ${clashes.length} duplicate derived number(s):`);
    for (const [a, b, n] of clashes.slice(0, 10)) console.error(`    ${n}  <-  ${a} and ${b}`);
    process.exit(1);
  }

  if (!APPLY) {
    for (const j of pending.rows.slice(0, 8)) {
      console.log(`  would set ${String(j.jobNumber).padEnd(24)} -> ${deriveDocNumberFromJob(j.jobNumber, "QT")}`);
    }
    if (pending.rows.length > 8) console.log(`  ... and ${pending.rows.length - 8} more`);
    console.log("[qt-number] Dry run. Re-run with --apply.");
    return;
  }

  let written = 0;
  for (const j of pending.rows) {
    await client.execute({
      sql: `UPDATE Job SET quotationNumber = ? WHERE id = ? AND (quotationNumber IS NULL OR trim(quotationNumber) = '')`,
      args: [deriveDocNumberFromJob(j.jobNumber, "QT"), j.id],
    });
    written += 1;
  }

  // The index goes on last: before the backfill the column is all NULLs, and
  // after it every value is distinct, so this is the point where it can hold.
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Job_quotationNumber_key" ON "Job"("quotationNumber")`,
  );

  console.log(`[qt-number] Backfilled ${written} job(s); unique index in place.`);
}

main()
  .catch((e) => { console.error("[qt-number] Failed:", e?.message ?? e); process.exit(1); })
  .finally(() => client.close?.());
