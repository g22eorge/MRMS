#!/usr/bin/env node
/**
 * Production integrity check (read-only — never writes).
 *
 * Covers what the stock qa:data-integrity script can't: it runs on Turso via
 * libSQL (plain PrismaClient can't), tolerates known schema drift (missing
 * columns are reported, not fatal), and checks money consistency, orphans,
 * duplicate unique values, and stranded rows.
 *
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/prod-integrity-check.mjs
 *   DATABASE_URL="file:./dev.db" node scripts/prod-integrity-check.mjs   # local file
 */

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient(authToken ? { url, authToken } : { url });

let failures = 0;
const fail = (m) => { failures += 1; console.error(`FAIL: ${m}`); };
const ok = (m) => console.log(`OK: ${m}`);
const info = (m) => console.log(`INFO: ${m}`);

async function columns(table) {
  // PRAGMA won't take bound parameters and returns empty (not an error) for
  // missing tables — check existence explicitly first.
  const exists = await db.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, [table]);
  if (exists.rows.length === 0) return null;
  const safe = table.replace(/'/g, "''");
  const r = await db.execute(`SELECT name FROM pragma_table_info('${safe}')`);
  return new Set(r.rows.map((x) => x.name));
}

const has = (cols, c) => cols instanceof Set && cols.has(c);

// ── 1. Schema presence for everything this program relies on ────────────────
const expenseCols = await columns("Expense");
const jobCols = await columns("Job");
const invoiceCols = await columns("Invoice");
for (const [table, cols, want] of [
  ["Expense", expenseCols, ["paidAmount", "dueAt"]],
  ["Job", jobCols, ["clientBill", "clientPaid"]],
  ["Invoice", invoiceCols, ["paidAmount"]],
  ["ExpensePayment", await columns("ExpensePayment"), ["amount"]],
  ["RecurringExpense", await columns("RecurringExpense"), ["nextDueAt"]],
  ["BankAccount", await columns("BankAccount"), ["ledgerCode"]],
]) {
  if (!cols) fail(`table missing: ${table}`);
  else {
    const missing = want.filter((c) => !has(cols, c));
    if (missing.length) fail(`${table} missing columns: ${missing.join(", ")}`);
    else ok(`${table} schema present`);
  }
}

// ── 2. Duplicate unique values ──────────────────────────────────────────────
for (const [table, col] of [["Job", "invoiceNumber"], ["Invoice", "invoiceNumber"], ["Expense", "expenseNumber"], ["Job", "jobNumber"]]) {
  try {
    const dupes = await db.execute(
      `SELECT "${col}" AS v, COUNT(*) AS c FROM "${table}" WHERE "${col}" IS NOT NULL AND "${col}" != '' GROUP BY "${col}" HAVING COUNT(*) > 1 LIMIT 10`,
    );
    if (dupes.rows.length) fail(`duplicate ${table}.${col}: ${dupes.rows.map((r) => `${r.v} (x${r.c})`).join(", ")}`);
    else ok(`no duplicate ${table}.${col}`);
  } catch (e) {
    info(`skip duplicate check ${table}.${col}: ${String(e?.message ?? e).slice(0, 90)}`);
  }
}

// ── 3. Orphans ──────────────────────────────────────────────────────────────
const orphanChecks = [
  ["Payment", "invoiceId", "Invoice", "id", "AND p.\"saleId\" IS NULL"],
  ["Refund", "invoiceId", "Invoice", "id", "AND r.\"saleId\" IS NULL"],
  ["Job", "clientId", "Client", "id", ""],
  ["Invoice", "jobId", "Job", "id", "AND i.\"jobId\" IS NOT NULL"],
  ["Invoice", "clientId", "Client", "id", ""],
];
for (const [child, fk, parent, pk, extra] of orphanChecks) {
  const alias = child[0].toLowerCase();
  try {
    const r = await db.execute(
      `SELECT COUNT(*) AS v FROM "${child}" ${alias} LEFT JOIN "${parent}" p2 ON p2."${pk}" = ${alias}."${fk}" WHERE ${alias}."${fk}" IS NOT NULL AND p2."${pk}" IS NULL ${extra}`,
    );
    const n = Number(r.rows[0]?.v ?? 0);
    if (n > 0) fail(`${n} orphan ${child} rows (missing ${parent})`);
    else ok(`no orphan ${child} → ${parent}`);
  } catch (e) {
    info(`skip orphan check ${child}: ${String(e?.message ?? e).slice(0, 90)}`);
  }
}

// ── 4. Money consistency ────────────────────────────────────────────────────
try {
  // ISSUED invoices fully covered by payment rows (the stranded-collectables defect).
  const stuck = await db.execute(
    `SELECT i."invoiceNumber" FROM "Invoice" i
     WHERE i."status" = 'ISSUED'
       AND (SELECT COALESCE(SUM(CASE WHEN p."kind" = 'REFUND' THEN -p."amount" ELSE p."amount" END), 0)
            FROM "Payment" p WHERE p."invoiceId" = i."id") >= i."totalAmount"
       AND i."totalAmount" > 0 LIMIT 25`,
  );
  if (stuck.rows.length) fail(`stranded collectables (covered but ISSUED): ${stuck.rows.map((r) => r.invoiceNumber).join(", ")}`);
  else ok("no stranded collectable invoices");
} catch (e) {
  info(`skip stranded check: ${String(e?.message ?? e).slice(0, 90)}`);
}

if (has(expenseCols, "paidAmount")) {
  try {
    const bad = await db.execute(
      `SELECT "expenseNumber" FROM "Expense" WHERE "paidAt" IS NOT NULL AND "paidAmount" < "amount" LIMIT 10`,
    );
    if (bad.rows.length) fail(`paid expenses with short paidAmount: ${bad.rows.map((r) => r.expenseNumber).join(", ")}`);
    else ok("paid expenses fully recorded");
  } catch (e) {
    info(`skip expense balance check: ${String(e?.message ?? e).slice(0, 90)}`);
  }
}

try {
  const neg = await db.execute(`SELECT COUNT(*) AS v FROM "ExpensePayment" WHERE "amount" <= 0`);
  if (Number(neg.rows[0]?.v ?? 0) > 0) fail("non-positive ExpensePayment rows exist");
  else ok("expense payments all positive");
} catch {
  info("skip expense-payment positivity (table absent)");
}

// ── 5. Jobs stuck terminally unpaid with no invoice at all ──────────────────
try {
  const r = await db.execute(
    `SELECT "jobNumber" FROM "Job"
     WHERE "clientPaid" = 0 AND "status" IN ('READY_FOR_PICKUP','COMPLETED','DELIVERED')
       AND NOT EXISTS (SELECT 1 FROM "Invoice" i WHERE i."jobId" = "Job"."id")
     LIMIT 15`,
  );
  if (r.rows.length) info(`terminal uninvoiced unpaid jobs (need recording or closing): ${r.rows.map((x) => x.jobNumber).join(", ")}`);
  else ok("no terminal uninvoiced unpaid jobs");
} catch (e) {
  info(`skip terminal-jobs check: ${String(e?.message ?? e).slice(0, 90)}`);
}

console.log(failures === 0 ? "\nAll integrity checks passed." : `\n${failures} FAILURE(S) — see above.`);
process.exit(failures === 0 ? 0 : 1);
