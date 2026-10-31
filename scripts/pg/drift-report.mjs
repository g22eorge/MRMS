/**
 * Reports how far a SQLite database has drifted from prisma/schema.prisma.
 *
 * Production was built with `prisma db push` plus hand-written DDL healing, so
 * the live schema and the datamodel disagree in both directions. Every column
 * the schema knows about but the database lacks is a column the Postgres import
 * must default; every column the database has but the schema does not is data
 * that would be silently dropped. This script is the measurement both of those
 * decisions are made against.
 *
 * Usage:
 *   node scripts/pg/drift-report.mjs [path/to/db.sqlite] [--json] [--strict]
 *
 * --strict exits 1 when any drift is found (for CI once Phase 1 lands).
 */

import { createClient } from "@libsql/client";
import path from "node:path";
import { existsSync } from "node:fs";

import { parseSchema } from "./schema-model.mjs";
import { JUNK_TABLES } from "./junk-tables.mjs";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const strict = args.includes("--strict");
const dbArg = args.find((a) => !a.startsWith("--")) ?? "prisma/dev.db";
const dbPath = path.resolve(process.cwd(), dbArg);

if (!existsSync(dbPath)) {
  console.error(`drift-report: no such database: ${dbPath}`);
  process.exit(2);
}


const client = createClient({ url: `file:${dbPath}` });

async function tableNames() {
  const r = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return r.rows.map((row) => String(row.name));
}

async function tableColumns(table) {
  const r = await client.execute(`PRAGMA table_info("${table.replaceAll('"', '""')}")`);
  return new Map(r.rows.map((row) => [String(row.name), String(row.type)]));
}

async function rowCount(table) {
  const r = await client.execute(`SELECT COUNT(*) AS n FROM "${table.replaceAll('"', '""')}"`);
  return Number(r.rows[0].n);
}

const { provider, models } = parseSchema();
const dbTables = await tableNames();
const dbTableSet = new Set(dbTables);

// schema.prisma keys models by model name; table name may differ via @@map.
const tableToModel = new Map([...models.values()].map((m) => [m.table, m]));

const report = {
  database: path.relative(process.cwd(), dbPath),
  schemaProvider: provider,
  generatedFor: "postgres-migration",
  counts: {},
  unknownTables: [],
  missingTables: [],
  junkTables: [],
  tables: {},
};

for (const t of dbTables) {
  if (JUNK_TABLES.has(t)) {
    report.junkTables.push({ table: t, rows: await rowCount(t) });
    continue;
  }
  if (!tableToModel.has(t)) {
    report.unknownTables.push({ table: t, rows: await rowCount(t), columns: [...(await tableColumns(t)).keys()] });
  }
}

for (const m of tableToModel.values()) {
  if (!dbTableSet.has(m.table)) report.missingTables.push(m.table);
}

let missingColumnTotal = 0;
let unknownColumnTotal = 0;
let rowsAtRisk = 0;

for (const [table, model] of [...tableToModel].sort(([a], [b]) => a.localeCompare(b))) {
  if (!dbTableSet.has(table)) continue;
  const dbCols = await tableColumns(table);

  const missing = [...model.columns.values()].filter((c) => !dbCols.has(c.column));
  const unknown = [...dbCols.keys()].filter((c) => !model.columns.has(c));
  if (missing.length === 0 && unknown.length === 0) continue;

  const rows = await rowCount(table);
  if (rows > 0) rowsAtRisk += rows;
  missingColumnTotal += missing.length;
  unknownColumnTotal += unknown.length;

  report.tables[table] = {
    rows,
    // Schema knows it, DB lacks it: the import must supply a value.
    missingInDb: missing.map((c) => ({
      column: c.column,
      type: c.type,
      optional: c.optional,
      hasDefault: c.hasDefault,
      // The dangerous class: NOT NULL with no default and no source data.
      needsBackfill: !c.optional && !c.hasDefault && !c.isUpdatedAt,
    })),
    // DB has it, schema does not: promote to the schema or drop deliberately.
    unknownToSchema: unknown.map((c) => ({ column: c, sqliteType: dbCols.get(c) })),
  };
}

report.counts = {
  schemaModels: models.size,
  dbTables: dbTables.length,
  unknownTables: report.unknownTables.length,
  missingTables: report.missingTables.length,
  junkTables: report.junkTables.length,
  missingColumns: missingColumnTotal,
  unknownColumns: unknownColumnTotal,
  tablesWithDrift: Object.keys(report.tables).length,
  rowsInDriftedTables: rowsAtRisk,
};

await client.close();

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const c = report.counts;
  console.log(`\nDRIFT REPORT  ${report.database}  (schema provider: ${report.schemaProvider})`);
  console.log("=".repeat(78));
  console.log(`  schema models ${c.schemaModels}   db tables ${c.dbTables}`);
  console.log(`  missing columns (schema has, DB lacks): ${c.missingColumns}`);
  console.log(`  unknown columns (DB has, schema lacks): ${c.unknownColumns}`);
  console.log(`  unknown tables: ${c.unknownTables}   missing tables: ${c.missingTables}   junk: ${c.junkTables}`);

  if (report.unknownTables.length) {
    console.log("\n  TABLES IN DB, NOT IN SCHEMA  (data here is dropped unless modelled)");
    for (const t of report.unknownTables) console.log(`    ${t.rows.toString().padStart(6)} rows  ${t.table}`);
  }
  if (report.junkTables.length) {
    console.log("\n  JUNK TABLES  (excluded from import by design)");
    for (const t of report.junkTables) console.log(`    ${t.rows.toString().padStart(6)} rows  ${t.table}`);
  }
  if (report.missingTables.length) {
    console.log("\n  TABLES IN SCHEMA, NOT IN DB  (created empty by migration)");
    console.log(`    ${report.missingTables.join(", ")}`);
  }

  const backfills = [];
  console.log("\n  COLUMN DRIFT BY TABLE");
  for (const [table, t] of Object.entries(report.tables)) {
    console.log(`\n    ${table}  (${t.rows} rows)`);
    if (t.missingInDb.length) {
      console.log(`      schema-only (${t.missingInDb.length}): ${t.missingInDb.map((c) => c.column).join(", ")}`);
      for (const c of t.missingInDb) if (c.needsBackfill && t.rows > 0) backfills.push(`${table}.${c.column} (${c.type}, ${t.rows} rows)`);
    }
    if (t.unknownToSchema.length) {
      console.log(`      DB-only     (${t.unknownToSchema.length}): ${t.unknownToSchema.map((c) => c.column).join(", ")}`);
    }
  }

  if (backfills.length) {
    console.log("\n  !! REQUIRED-WITHOUT-DEFAULT COLUMNS OVER EXISTING ROWS — need an explicit backfill rule:");
    for (const b of backfills) console.log(`      - ${b}`);
  }
  console.log();
}

const hasDrift =
  report.counts.missingColumns > 0 ||
  report.counts.unknownColumns > 0 ||
  report.counts.unknownTables > 0;

if (strict && hasDrift) {
  console.error("drift-report: drift present and --strict was set");
  process.exit(1);
}
