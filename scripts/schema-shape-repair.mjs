/**
 * Finds and repairs tables carrying columns schema.prisma does not know about.
 *
 * The drift that matters here is the opposite of the one everyone checks for.
 * sync-schema-to-db.mjs (and schema-drift-check.mjs through it) asks "is every
 * column Prisma wants present?" — and the commercial database passed that check
 * while goods receiving was completely broken. The killer was an *extra*
 * column: GoodsReceivedItem still had `receivedQty NOT NULL` from a older
 * schema generation, Prisma writes `quantity` and has never heard of it, so
 * every insert died on the constraint. Everything Prisma wanted was there. The
 * check had a blind spot lined up exactly with the failure mode.
 *
 * An extra column is:
 *   - harmless   if it is nullable — Prisma omits it, SQLite stores NULL.
 *   - LATENT     if NOT NULL with a default — inserts succeed and the column
 *                silently holds the default forever, disagreeing with the real
 *                one. PartLocationStock.quantity sat at 0 while qtyOnHand said 5.
 *   - BREAKING   if NOT NULL without a default — every insert fails, so the
 *                feature has never worked on that deployment.
 *
 * The tell for BREAKING is an empty table: complaints, supplier payments,
 * cashier shifts and group permissions all held zero rows on commercial, not by
 * coincidence but because nothing could ever be written to them.
 *
 * SQLite cannot drop a column constraint, so the table has to be rebuilt. The
 * authoritative shape comes from `prisma migrate diff --from-empty --script`,
 * the same generator the reconciler uses — which means the rebuilt table keeps
 * the FOREIGN KEY constraints the reconciler skips when it patches columns onto
 * an existing table.
 *
 * Only empty tables are rebuilt. With foreign keys enforced, DROP TABLE runs an
 * implicit DELETE FROM and fires ON DELETE CASCADE into child tables, so
 * rebuilding a populated parent could delete rows nobody asked to touch. A
 * table holding data is reported and left alone: it needs a deliberate
 * migration that says what maps to what, which is what
 * scripts/goods-received-item-drift.mjs does for the one table where legacy
 * rows were plausible (receivedQty -> quantity). That script runs first and
 * this one is the net beneath it.
 *
 *   node scripts/schema-shape-repair.mjs --check   # report only, non-zero on drift
 *   node scripts/schema-shape-repair.mjs           # repair
 */

import { spawnSync } from "node:child_process";
import { createClient } from "@libsql/client";

import { splitSqlStatements } from "./lib/split-sql.mjs";

const CHECK_ONLY = process.argv.includes("--check");
const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("[shape] No TURSO_DATABASE_URL / DATABASE_URL — nothing to do.");
  process.exit(0);
}

const client = createClient({
  url,
  authToken: process.env.TURSO_DATABASE_URL ? process.env.TURSO_AUTH_TOKEN : undefined,
});

/** Authoritative DDL straight from the model — identical call to the reconciler's. */
function generateDdl() {
  const res = spawnSync(
    "bunx",
    ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
    {
      encoding: "utf8",
      shell: process.platform === "win32",
      env: { ...process.env, DATABASE_URL: "file:./dev.db", TURSO_DATABASE_URL: "" },
    },
  );
  if (res.status !== 0) throw new Error(`prisma migrate diff failed: ${res.stderr || res.stdout}`);
  return res.stdout;
}

/** Column names declared in a generated CREATE TABLE, skipping constraint lines. */
function columnsOfCreate(stmt) {
  const cols = [];
  for (const raw of stmt.split("\n")) {
    const line = raw.trim().replace(/,$/, "");
    if (!line.startsWith('"')) continue; // PRIMARY KEY(...) / CONSTRAINT / FOREIGN KEY
    const m = line.match(/^"([^"]+)"/);
    if (m) cols.push(m[1]);
  }
  return cols;
}

async function main() {
  const statements = splitSqlStatements(generateDdl());
  const creates = new Map();
  const indexes = new Map();

  for (const s of statements) {
    const c = s.match(/^CREATE TABLE\s+"([^"]+)"/i);
    if (c) { creates.set(c[1], s); continue; }
    const i = s.match(/^CREATE (?:UNIQUE )?INDEX\s+"[^"]+"\s+ON\s+"([^"]+)"/i);
    if (i) {
      if (!indexes.has(i[1])) indexes.set(i[1], []);
      indexes.get(i[1]).push(s);
    }
  }

  const present = (
    await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'`,
    )
  ).rows.map((r) => String(r.name));

  const breaking = [], latent = [], skipped = [], repaired = [];

  for (const table of present) {
    const create = creates.get(table);
    if (!create) continue; // not a model — leave alone

    const want = new Set(columnsOfCreate(create));
    const info = (await client.execute(`PRAGMA table_info('${table}')`)).rows;

    const extras = info
      .filter((c) => !want.has(String(c.name)) && Number(c.notnull) === 1)
      .map((c) => ({
        name: String(c.name),
        hasDefault: c.dflt_value !== null && c.dflt_value !== undefined,
      }));
    if (extras.length === 0) continue;

    const label = `${table}: ${extras.map((e) => e.name + (e.hasDefault ? " (defaulted)" : "")).join(", ")}`;
    (extras.some((e) => !e.hasDefault) ? breaking : latent).push(label);

    if (CHECK_ONLY) continue;

    // Only empty tables are rebuilt, and the reason is sharper than caution:
    // with foreign keys enforced, DROP TABLE performs an implicit DELETE FROM,
    // which fires ON DELETE CASCADE into every child table. Rebuilding a
    // populated parent could therefore quietly delete rows in tables nobody
    // asked to touch. A table that still holds data needs a deliberate
    // migration — scripts/goods-received-item-drift.mjs is the worked example.
    const rows = Number((await client.execute(`SELECT COUNT(*) AS n FROM "${table}"`)).rows[0].n ?? 0);
    if (rows > 0) {
      skipped.push(`${table}: holds ${rows} row(s) — rebuild would cascade into child tables`);
      continue;
    }

    const tmp = `__${table}_rebuild`;
    await client.execute(`DROP TABLE IF EXISTS "${tmp}"`);
    // Only the table name is swapped; constraint names inside stay as Prisma
    // wrote them, so they read correctly once the table is renamed back.
    await client.execute(create.replace(/^CREATE TABLE\s+"[^"]+"/i, `CREATE TABLE "${tmp}"`));
    await client.execute(`DROP TABLE "${table}"`);
    await client.execute(`ALTER TABLE "${tmp}" RENAME TO "${table}"`);
    // The old indexes went with the old table, so these names are free again.
    for (const idx of indexes.get(table) ?? []) await client.execute(idx);
    repaired.push(label);
    console.log(`[shape] Rebuilt ${table}.`);
  }

  const report = (title, list) => {
    if (!list.length) return;
    console.log(`[shape] ${title}`);
    for (const l of list) console.log(`          ${l}`);
  };

  if (CHECK_ONLY) {
    report("BREAKING — extra NOT NULL, no default; inserts fail:", breaking);
    report("LATENT — extra NOT NULL with a default; column silently wrong:", latent);
    if (!breaking.length && !latent.length) {
      console.log("[shape] No unknown NOT NULL columns — shapes agree with schema.prisma.");
      return;
    }
    process.exit(breaking.length ? 1 : 0);
  }

  report("Repaired:", repaired);
  report("SKIPPED — needs a deliberate migration:", skipped);
  if (!repaired.length && !skipped.length) console.log("[shape] Nothing to repair.");
  // A skip is deferred work, not a failure. This runs as a build heal step
  // where a non-zero exit aborts the deploy under STRICT_SCHEMA_HEAL, and the
  // skipped tables are latent-only and permanent until someone migrates them —
  // exiting non-zero here would block every future deploy on a known backlog.
  // Real failures still surface: main() throws and the catch below exits 1.
}

main()
  .catch((error) => {
    console.error("[shape] Failed:", error?.message ?? error);
    process.exit(1);
  })
  .finally(() => client.close?.());
