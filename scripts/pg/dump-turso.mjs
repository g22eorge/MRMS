/**
 * Copies a libSQL/Turso database into a local SQLite file.
 *
 * The cutover needs a dump taken inside the write freeze, and every downstream
 * tool here takes a plain SQLite file path. Uses @libsql/client, already a
 * dependency, so there is no CLI to install on the machine doing the cutover.
 *
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... \
 *     node scripts/pg/dump-turso.mjs final.db
 *
 * Also works source-to-source for a rehearsal:
 *   SOURCE_URL=file:./mrms-prod.db node scripts/pg/dump-turso.mjs copy.db
 *
 * Schema and data only — indexes and triggers are copied too, but nothing here
 * depends on them: the destination is read by the importer, which uses the
 * datamodel rather than the dump's schema.
 */

import { createClient } from "@libsql/client";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const force = args.includes("--force");
const outArg = args.find((a) => !a.startsWith("--"));

if (!outArg) {
  console.error("usage: node scripts/pg/dump-turso.mjs <out.db> [--force]");
  process.exit(2);
}

const sourceUrl = process.env.SOURCE_URL ?? process.env.TURSO_DATABASE_URL;
if (!sourceUrl) {
  console.error("dump: set TURSO_DATABASE_URL (or SOURCE_URL for a local rehearsal)");
  process.exit(2);
}

const outPath = path.resolve(process.cwd(), outArg);
if (existsSync(outPath)) {
  if (!force) {
    console.error(`dump: ${outArg} already exists — pass --force to overwrite`);
    process.exit(2);
  }
  // Remove rather than truncate: a partially-overwritten SQLite file is worse
  // than no file, because it still opens.
  unlinkSync(outPath);
}

const source = createClient({
  url: sourceUrl,
  ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
});
const target = createClient({ url: `file:${outPath}` });

const q = (s) => `"${String(s).replaceAll('"', '""')}"`;

// Rows are copied table by table in name order, which is not foreign-key order,
// so enforcement has to be off for the copy. This is a byte-level duplicate of
// the source, not a validation step: the importer derives the correct insertion
// order from the datamodel and Postgres enforces the keys there.
await target.execute("PRAGMA foreign_keys = OFF");

console.log(`\nDUMP  ${sourceUrl.replace(/(:\/\/)[^@]*@/, "$1***@")}  ->  ${outArg}`);
console.log("=".repeat(70));

// Schema first, in creation order, skipping SQLite's own internal objects.
const schema = await source.execute(
  `SELECT type, name, tbl_name, sql FROM sqlite_master
   WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
   ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, name`,
);

const tables = [];
for (const row of schema.rows) {
  const sql = String(row.sql);
  try {
    await target.execute(sql);
  } catch (error) {
    console.error(`  failed creating ${row.type} ${row.name}: ${error.message}`);
    process.exit(1);
  }
  if (String(row.type) === "table") tables.push(String(row.name));
}
console.log(`  schema: ${tables.length} tables, ${schema.rows.length - tables.length} indexes/triggers`);

let totalRows = 0;
const BATCH = 200;

for (const table of tables) {
  const info = await source.execute(`PRAGMA table_info(${q(table)})`);
  const columns = info.rows.map((r) => String(r.name));
  if (!columns.length) continue;

  const rows = await source.execute(`SELECT ${columns.map(q).join(", ")} FROM ${q(table)}`);
  if (!rows.rows.length) continue;

  const placeholders = `(${columns.map(() => "?").join(", ")})`;
  const insert = `INSERT INTO ${q(table)} (${columns.map(q).join(", ")}) VALUES ${placeholders}`;

  for (let i = 0; i < rows.rows.length; i += BATCH) {
    const chunk = rows.rows.slice(i, i + BATCH);
    await target.batch(
      chunk.map((row) => ({ sql: insert, args: columns.map((c) => row[c] ?? null) })),
      "write",
    );
  }
  totalRows += rows.rows.length;
}

// Row-count parity, so a truncated copy is caught here rather than three steps
// later during the import.
let mismatched = 0;
for (const table of tables) {
  const a = Number((await source.execute(`SELECT COUNT(*) AS n FROM ${q(table)}`)).rows[0].n);
  const b = Number((await target.execute(`SELECT COUNT(*) AS n FROM ${q(table)}`)).rows[0].n);
  if (a !== b) {
    console.error(`  MISMATCH ${table}: source ${a}, dump ${b}`);
    mismatched += 1;
  }
}

await source.close();
await target.close();

console.log(`  copied ${totalRows} rows`);
if (mismatched) {
  console.error(`\n  ${mismatched} table(s) do not match — the dump is not usable.\n`);
  process.exit(1);
}
console.log(`  row counts match on all ${tables.length} tables`);
console.log(`\n  next: node scripts/pg/baseline.mjs ${outArg}\n`);
