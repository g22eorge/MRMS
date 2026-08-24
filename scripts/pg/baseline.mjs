/**
 * Captures a verifiable fingerprint of a SQLite database before migration.
 *
 * The import in Phase 4 is only trustworthy if we can prove the Postgres copy
 * holds the same data. Row counts alone are weak (they miss silently-nulled
 * columns), so this also sums every numeric column and records the min/max of
 * every timestamp column. Those three families together catch dropped columns,
 * botched type coercion and timezone shifts.
 *
 * Usage:
 *   node scripts/pg/baseline.mjs <db.sqlite> [--out docs/pg-migration/baseline.json]
 */

import { createClient } from "@libsql/client";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

import { parseSchema } from "./schema-model.mjs";
import { JUNK_TABLES } from "./junk-tables.mjs";

const args = process.argv.slice(2);
const dbArg = args.find((a) => !a.startsWith("--")) ?? "prisma/dev.db";
const outIdx = args.indexOf("--out");
const dbPath = path.resolve(process.cwd(), dbArg);

if (!existsSync(dbPath)) {
  console.error(`baseline: no such database: ${dbPath}`);
  process.exit(2);
}

const defaultOut = path.join(
  "docs", "pg-migration",
  `baseline.${path.basename(dbPath).replace(/\.(db|sqlite3?)$/, "")}.json`,
);
const outPath = path.resolve(process.cwd(), outIdx >= 0 ? args[outIdx + 1] : defaultOut);

const client = createClient({ url: `file:${dbPath}` });
const { models } = parseSchema();
const tableToModel = new Map([...models.values()].map((m) => [m.table, m]));

const q = (s) => `"${String(s).replaceAll('"', '""')}"`;

const tables = (
  await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
).rows.map((r) => String(r.name));

const fingerprint = {
  source: path.relative(process.cwd(), dbPath),
  capturedAt: new Date().toISOString(),
  totals: { tables: 0, rows: 0 },
  tables: {},
  skipped: [],
};

for (const table of tables) {
  if (JUNK_TABLES.has(table)) {
    fingerprint.skipped.push(table);
    continue;
  }

  const cols = (await client.execute(`PRAGMA table_info(${q(table)})`)).rows.map((r) => ({
    name: String(r.name),
    type: String(r.type).toUpperCase(),
  }));

  const rows = Number((await client.execute(`SELECT COUNT(*) AS n FROM ${q(table)}`)).rows[0].n);
  const entry = { rows, sums: {}, ranges: {} };

  if (rows > 0) {
    const model = tableToModel.get(table);

    // Numeric columns: sum them. Uses the DB's own type so it also covers
    // columns the schema does not know about (they still have to survive).
    const numeric = cols.filter((c) => c.type.includes("REAL") || c.type.includes("INT") || c.type.includes("NUM") || c.type.includes("DECIMAL"));
    for (const c of numeric) {
      // Booleans are stored as INTEGER; summing them is still a useful checksum.
      const r = await client.execute(`SELECT SUM(CAST(${q(c.name)} AS REAL)) AS s, COUNT(${q(c.name)}) AS n FROM ${q(table)}`);
      const s = r.rows[0].s;
      entry.sums[c.name] = {
        sum: s === null ? null : Math.round(Number(s) * 1e6) / 1e6,
        nonNull: Number(r.rows[0].n),
      };
    }

    // Timestamp columns: min/max, so timezone or epoch/ISO coercion bugs show up.
    const temporal = cols.filter((c) => {
      if (c.type.includes("DATE") || c.type.includes("TIME")) return true;
      return model?.columns.get(c.name)?.type === "DateTime";
    });
    for (const c of temporal) {
      const r = await client.execute(
        `SELECT MIN(${q(c.name)}) AS lo, MAX(${q(c.name)}) AS hi, COUNT(${q(c.name)}) AS n FROM ${q(table)}`,
      );
      entry.ranges[c.name] = {
        min: r.rows[0].lo === null ? null : String(r.rows[0].lo),
        max: r.rows[0].hi === null ? null : String(r.rows[0].hi),
        nonNull: Number(r.rows[0].n),
      };
    }
  }

  fingerprint.tables[table] = entry;
  fingerprint.totals.tables += 1;
  fingerprint.totals.rows += rows;
}

await client.close();

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(fingerprint, null, 2)}\n`);

const nonEmpty = Object.entries(fingerprint.tables).filter(([, t]) => t.rows > 0);
console.log(`\nBASELINE  ${fingerprint.source}`);
console.log("=".repeat(60));
console.log(`  tables: ${fingerprint.totals.tables}  (${nonEmpty.length} non-empty)`);
console.log(`  rows:   ${fingerprint.totals.rows}`);
console.log(`  skipped (junk): ${fingerprint.skipped.join(", ") || "none"}`);
console.log(`\n  top tables by rows:`);
for (const [t, v] of nonEmpty.sort((a, b) => b[1].rows - a[1].rows).slice(0, 10)) {
  console.log(`    ${String(v.rows).padStart(6)}  ${t}`);
}
console.log(`\n  written: ${path.relative(process.cwd(), outPath)}\n`);
