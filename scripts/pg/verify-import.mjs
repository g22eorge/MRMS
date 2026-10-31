/**
 * Compares the Postgres database against a baseline fingerprint taken from the
 * SQLite source (scripts/pg/baseline.mjs).
 *
 * Row counts alone would miss the failures that matter — a column silently
 * imported as NULL, a date shifted by a timezone, a money value re-rounded — so
 * this also compares the sum of every numeric column and the min/max of every
 * timestamp column, which is what the baseline records.
 *
 *   node scripts/pg/verify-import.mjs docs/pg-migration/baseline.mrms-prod.json
 *
 * Differences that the import intended are declared in the baseline's
 * `expectedDeltas`, so a deliberate change reads as accounted-for rather than as
 * a failure.
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { toEpochMs } from "./coerce.mjs";

const args = process.argv.slice(2);
const baselinePath = args.find((a) => !a.startsWith("--")) ?? "docs/pg-migration/baseline.mrms-prod.json";
if (!existsSync(baselinePath)) {
  console.error(`verify: no such baseline: ${baselinePath}`);
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("verify: DATABASE_URL is not set");
  process.exit(2);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const prisma = new PrismaClient({ log: ["error"] });
const q = (s) => `"${String(s).replaceAll('"', '""')}"`;

/**
 * Rows the import deliberately does not carry over, and columns it deliberately
 * clears. Anything else is a discrepancy.
 */
const expectedDeltas = JSON.parse(
  readFileSync("docs/pg-migration/import-map.json", "utf8"),
).verificationDeltas ?? {};

const failures = [];
const accounted = [];
let tablesChecked = 0;
let rowsExpected = 0;
let rowsFound = 0;

async function liveColumns(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = $1`,
    table,
  );
  return new Map(rows.map((r) => [r.column_name, r.data_type]));
}

for (const [table, expected] of Object.entries(baseline.tables)) {
  const delta = expectedDeltas[table] ?? {};

  const exists = await prisma.$queryRawUnsafe(
    `SELECT 1 AS one FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_name = $1 LIMIT 1`,
    table,
  );
  if (!exists.length) {
    const notImported = delta.rowsNotImported ?? 0;
    if (expected.rows === 0) continue;
    if (notImported >= expected.rows) {
      accounted.push(`${table}: ${expected.rows} row(s) intentionally not imported — ${delta.why}`);
      continue;
    }
    failures.push(`${table}: not present in Postgres (expected ${expected.rows} rows)`);
    continue;
  }
  const live = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM ${q(table)}`);

  tablesChecked += 1;
  const actualRows = Number(live[0].n);
  const expectedRows = expected.rows - (delta.rowsNotImported ?? 0);
  rowsExpected += expectedRows;
  rowsFound += actualRows;

  if (actualRows !== expectedRows) {
    failures.push(`${table}: ${actualRows} rows, expected ${expectedRows}`);
    continue;
  }
  if (delta.rowsNotImported) {
    accounted.push(`${table}: ${delta.rowsNotImported} row(s) intentionally not imported — ${delta.why}`);
  }
  if (expected.rows === 0) continue;

  const columns = await liveColumns(table);

  // Numeric column sums.
  for (const [column, want] of Object.entries(expected.sums ?? {})) {
    if (!columns.has(column)) {
      if ((delta.columnsDropped ?? []).includes(column)) {
        accounted.push(`${table}.${column}: column intentionally dropped`);
        continue;
      }
      failures.push(`${table}.${column}: column missing in Postgres`);
      continue;
    }
    if (want.sum === null) continue; // all-null in the source

    // The baseline summed SQLite INTEGER columns, which is where booleans lived.
    // Postgres has a real boolean type and refuses to cast it to numeric, so sum
    // it as 0/1 — matching what the baseline actually measured.
    const dataType = columns.get(column);
    const expr =
      dataType === "boolean"
        ? `SUM(CASE WHEN ${q(column)} THEN 1 ELSE 0 END)::numeric`
        : `SUM(${q(column)}::numeric)`;
    const rows = await prisma.$queryRawUnsafe(
      `SELECT ${expr} AS s, COUNT(${q(column)})::int AS n FROM ${q(table)}`,
    );
    const gotSum = rows[0].s === null ? null : Math.round(Number(rows[0].s) * 1e6) / 1e6;
    const gotCount = Number(rows[0].n);

    if ((delta.columnsCleared ?? []).includes(column)) {
      accounted.push(`${table}.${column}: values intentionally cleared — ${delta.why}`);
      continue;
    }
    if (gotSum !== want.sum) {
      failures.push(`${table}.${column}: sum ${gotSum}, expected ${want.sum}`);
    }
    if (gotCount !== want.nonNull) {
      failures.push(`${table}.${column}: ${gotCount} non-null, expected ${want.nonNull}`);
    }
  }

  // Timestamp ranges — catches epoch/ISO confusion and timezone shifts.
  for (const [column, want] of Object.entries(expected.ranges ?? {})) {
    if (!columns.has(column)) {
      if ((delta.columnsDropped ?? []).includes(column)) continue;
      failures.push(`${table}.${column}: timestamp column missing in Postgres`);
      continue;
    }
    if (want.nonNull === 0) continue;
    const rows = await prisma.$queryRawUnsafe(
      `SELECT MIN(${q(column)}) AS lo, MAX(${q(column)}) AS hi, COUNT(${q(column)})::int AS n FROM ${q(table)}`,
    );
    const gotCount = Number(rows[0].n);
    if (gotCount !== want.nonNull) {
      failures.push(`${table}.${column}: ${gotCount} non-null timestamps, expected ${want.nonNull}`);
      continue;
    }
    // Compare as instants: the source stored ISO-8601 text, Postgres stores
    // timestamp(3), and both should denote the same moment.
    const toMs = (v) => toEpochMs(v, `${table}.${column}`);
    const wantLo = toMs(want.min);
    const wantHi = toMs(want.max);
    const gotLo = toMs(rows[0].lo);
    const gotHi = toMs(rows[0].hi);
    // Format defensively: an unparseable baseline value must be reported as
    // such, not crash the run that is meant to report it.
    const iso = (ms) => (ms === null || Number.isNaN(ms) ? "unparseable" : new Date(ms).toISOString());
    if (Number.isNaN(wantLo) || Number.isNaN(wantHi)) {
      failures.push(`${table}.${column}: baseline holds an unparseable timestamp (min=${want.min}, max=${want.max})`);
      continue;
    }
    if (wantLo !== null && gotLo !== wantLo) {
      failures.push(`${table}.${column}: min ${iso(gotLo)}, expected ${iso(wantLo)}`);
    }
    if (wantHi !== null && gotHi !== wantHi) {
      failures.push(`${table}.${column}: max ${iso(gotHi)}, expected ${iso(wantHi)}`);
    }
  }
}

console.log(`\nVERIFY  ${path.basename(baselinePath)}  vs  Postgres`);
console.log("=".repeat(70));
console.log(`  tables compared: ${tablesChecked}`);
console.log(`  rows: ${rowsFound} found / ${rowsExpected} expected`);
if (accounted.length) {
  console.log(`\n  accounted-for differences (${accounted.length}):`);
  for (const a of accounted) console.log(`    - ${a}`);
}
if (failures.length) {
  console.log(`\n  ${failures.length} DISCREPANCY(IES):`);
  for (const f of failures) console.log(`    - ${f}`);
  console.log("");
  await prisma.$disconnect();
  process.exit(1);
}
console.log("\n  row counts, numeric sums and timestamp ranges all match.\n");
await prisma.$disconnect();
