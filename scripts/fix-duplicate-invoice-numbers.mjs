#!/usr/bin/env node
/**
 * Fix duplicate Job.invoiceNumber values.
 *
 * The unique index on Job.invoiceNumber cannot be created while duplicates
 * exist (the deploy reconciler reports this as a skipped index and moves
 * on). Duplicates also make invoice lookups hit the wrong job.
 *
 * Rule per duplicate group — the number belongs to the job the Invoice row
 * points at; everyone else is re-pointed at their own invoice, or cleared
 * (NULL lets the next billing flow mint a fresh number):
 *   1. An Invoice row carries the number  -> its job keeps it.
 *   2. Otherwise the earliest-received job keeps it.
 *   3. Other jobs take their own invoice's number when they have one,
 *      else NULL.
 *
 * Dry-run by default; writes only with --apply (and --org=<id> to narrow).
 *
 *   node scripts/fix-duplicate-invoice-numbers.mjs
 *   node scripts/fix-duplicate-invoice-numbers.mjs --org=org_xxx --apply
 */

import { createClient } from "@libsql/client";

const APPLY = process.argv.includes("--apply");
const ALL_ORGS = process.argv.includes("--all-orgs");
const orgArg = process.argv.find((a) => a.startsWith("--org="))?.slice("--org=".length);

const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient(authToken ? { url, authToken } : { url });

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const orgFilter = ALL_ORGS || !orgArg ? "" : "AND j.\"orgId\" = ?";
const orgArgs = ALL_ORGS || !orgArg ? [] : [orgArg];

const groups = await client.execute({
  sql: `SELECT j."invoiceNumber" AS num, j."orgId" AS orgId, COUNT(*) AS c
        FROM "Job" j
        WHERE j."invoiceNumber" IS NOT NULL AND j."invoiceNumber" != '' ${orgFilter}
        GROUP BY j."invoiceNumber", j."orgId"
        HAVING COUNT(*) > 1
        ORDER BY j."orgId", j."invoiceNumber"`,
  args: orgArgs,
}).then((r) => r.rows);

if (groups.length === 0) {
  console.log("No duplicate Job.invoiceNumber values — nothing to do.");
  process.exit(0);
}
if (!APPLY) console.log("(dry-run; pass --org=<id> to narrow, --apply to write)");

let totalFixes = 0;
for (const g of groups) {
  const jobs = await client.execute({
    sql: `SELECT j."id", j."jobNumber", j."receivedAt",
                 (SELECT i."invoiceNumber" FROM "Invoice" i WHERE i."jobId" = j."id" ORDER BY i."issuedAt" DESC LIMIT 1) AS ownInvoice
          FROM "Job" j
          WHERE j."orgId" = ? AND j."invoiceNumber" = ?
          ORDER BY datetime(j."receivedAt") ASC, j."rowid" ASC`,
    args: [g.orgId, g.num],
  }).then((r) => r.rows);

  const invoices = await client.execute({
    sql: `SELECT "jobId" FROM "Invoice" WHERE "orgId" = ? AND "invoiceNumber" = ?`,
    args: [g.orgId, g.num],
  }).then((r) => r.rows.map((x) => x.jobId));

  // Rightful owner: the job the Invoice row points at, else the earliest job.
  let keeper = jobs.find((j) => invoices.includes(j.id)) ?? jobs[0];
  console.log(`[${g.orgId}] ${g.num} on ${jobs.length} jobs — keeper: ${keeper.jobNumber}`);

  const updates = [];
  for (const j of jobs) {
    if (j.id === keeper.id) continue;
    const next = j.ownInvoice && j.ownInvoice !== g.num ? j.ownInvoice : null;
    updates.push({ id: j.id, jobNumber: j.jobNumber, to: next });
    console.log(`  ${j.jobNumber}  →  ${next ?? "NULL (re-mint on next billing)"}`);
  }

  if (APPLY && updates.length > 0) {
    const stmts = updates.map((u) => ({
      sql: `UPDATE "Job" SET "invoiceNumber" = ? WHERE "id" = ? AND "orgId" = ?`,
      args: [u.to, u.id, g.orgId],
    }));
    for (let i = 0; i < stmts.length; i += 50) {
      await client.batch(stmts.slice(i, i + 50));
    }
    console.log(`  wrote ${updates.length} fix(es).`);
    totalFixes += updates.length;
  }
}

if (!APPLY) console.log("\nDry-run only — nothing written. Re-run with --apply (and --org=<id>) to fix.");
else console.log(`\nDone — ${totalFixes} duplicate reference(s) cleared. Redeploy (or re-run the reconciler) to create the unique index.`);
