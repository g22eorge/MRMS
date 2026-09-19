#!/usr/bin/env node
/**
 * Flip fully-covered ISSUED invoices to PAID (and mirror the job to paid).
 *
 * Covers the stranded-collectables defect: money present in payment rows,
 * status stuck at ISSUED (typically rewritten by a later re-issue that never
 * re-synced). Detection reads payment ROWS, never the stored paidAmount.
 * Refunds (both kinds) net off, foreign amounts convert to base.
 *
 * Dry-run by default; writes only with --apply. Narrow with repeatable
 * --invoice=<number>, otherwise scans every ISSUED invoice in scope.
 *
 *   node scripts/flip-paid-invoices.mjs                                    # dry-run, all orgs
 *   node scripts/flip-paid-invoices.mjs --invoice=EIS/INV/2026/0075 --apply
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/flip-paid-invoices.mjs --org=org_eis_01 --apply
 */

import { createClient } from "@libsql/client";

const APPLY = process.argv.includes("--apply");
const ALL_ORGS = process.argv.includes("--all-orgs");
const orgArg = process.argv.find((a) => a.startsWith("--org="))?.slice("--org=".length);
const onlyNumbers = process.argv.filter((a) => a.startsWith("--invoice=")).map((a) => a.slice("--invoice=".length));

const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient(authToken ? { url, authToken } : { url });

function toBase(amount, currency, base, rate) {
  if (!currency || currency === base || rate == null) {
    // No rate: 1:1 only when same currency, else unconvertible (skip, don't guess).
    return currency === base || !currency ? Number(amount) : NaN;
  }
  return Number(amount) * Number(rate);
}

const orgFilter = ALL_ORGS || !orgArg ? "" : "AND i.\"orgId\" = ?";
const orgArgs = ALL_ORGS || !orgArg ? [] : [orgArg];
const numFilter = onlyNumbers.length ? `AND i."invoiceNumber" IN (${onlyNumbers.map(() => "?").join(",")})` : "";

const invoices = await client.execute({
  sql: `SELECT i."id", i."orgId", i."invoiceNumber", i."totalAmount", i."currency", i."exchangeRateToBase", i."jobId", i."status",
               o."baseCurrency" AS "baseCurrency"
        FROM "Invoice" i LEFT JOIN "Organization" o ON o."id" = i."orgId"
        WHERE i."status" = 'ISSUED' ${orgFilter} ${numFilter}`,
  args: [...orgArgs, ...onlyNumbers],
}).then((r) => r.rows);

if (invoices.length === 0) {
  console.log("No ISSUED invoices in scope — nothing to do.");
  process.exit(0);
}
if (!APPLY) console.log("(dry-run; add --apply to write)");

let flipped = 0;
for (const inv of invoices) {
  const base = inv.baseCurrency || "UGX";
  const pays = await client.execute({
    sql: `SELECT "amount","currency","exchangeRateToBase","kind" FROM "Payment" WHERE "invoiceId" = ?`,
    args: [inv.id],
  }).then((r) => r.rows);
  const refunds = await client.execute({
    sql: `SELECT "amount","currency","exchangeRateToBase" FROM "Refund" WHERE "invoiceId" = ?`,
    args: [inv.id],
  }).then((r) => r.rows);
  let paid = 0;
  let convertible = true;
  for (const p of pays) {
    const v = toBase(p.amount, p.currency, base, p.exchangeRateToBase);
    if (!Number.isFinite(v)) { convertible = false; break; }
    paid += (p.kind === "REFUND" ? -1 : 1) * v;
  }
  for (const r of refunds) {
    const v = toBase(r.amount, r.currency, base, r.exchangeRateToBase);
    if (!Number.isFinite(v)) { convertible = false; break; }
    paid -= v;
  }
  const total = toBase(inv.totalAmount, inv.currency, base, inv.exchangeRateToBase);
  if (!convertible || !(total > 0)) {
    console.log(`${inv.invoiceNumber}: skipped (unconvertible currency)`);
    continue;
  }
  if (!(paid >= total)) {
    console.log(`${inv.invoiceNumber}: still owed (${paid} of ${total} ${base}) — left listed`);
    continue;
  }
  console.log(`${inv.invoiceNumber}: COVERED (${paid} of ${total} ${base}) — flipping to PAID`);
  if (!APPLY) continue;
  const now = new Date().toISOString();
  await client.batch([
    { sql: `UPDATE "Invoice" SET "status" = 'PAID', "paidAmount" = ?, "paidAt" = COALESCE("paidAt", ?) WHERE "id" = ? AND "status" = 'ISSUED'`, args: [paid, now, inv.id] },
    ...(inv.jobId ? [{ sql: `UPDATE "Job" SET "clientPaid" = 1, "clientPaidAt" = COALESCE("clientPaidAt", ?) WHERE "id" = ? AND "clientPaid" = 0`, args: [now, inv.jobId] }] : []),
  ]);
  flipped += 1;
}

if (!APPLY) console.log("\nDry-run only — nothing written.");
else console.log(`\nDone — ${flipped} invoice(s) flipped to PAID.`);
