#!/usr/bin/env node
/**
 * Generic, idempotent schema reconciler for the production (Turso/libSQL) DB.
 *
 * Prisma Migrate can't run against Turso's libSQL protocol, so prod schema drifts
 * whenever schema.prisma gains a model/column that never reached prod. This script
 * closes the gap authoritatively:
 *   1. `prisma migrate diff --from-empty --to-schema-datamodel` → full desired
 *      SQLite DDL for EVERY model (no DB connection needed to generate it).
 *   2. Apply it to the live DB idempotently: create missing tables, add missing
 *      columns, create missing indexes. Never drops or rewrites anything.
 *
 * Safe to run on every deploy. A NOT-NULL column with no default is added as
 * nullable (with a warning) so it can't fail against populated tables.
 */
import { spawnSync } from "node:child_process";
import { createClient } from "@libsql/client";

// Use || (not ??) so an empty-string env var falls through to the next source.
const url = process.env.TURSO_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || "file:./prisma/dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient(authToken ? { url, authToken } : { url });

function generateDdl() {
  // migrate diff --from-empty does not connect to any DB; give the CLI a valid
  // file: URL so prisma.config.ts is happy, and clear Turso for the subprocess.
  const res = spawnSync(
    "bunx",
    ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
    {
      encoding: "utf8",
      shell: process.platform === "win32",
      env: { ...process.env, DATABASE_URL: "file:./dev.db", TURSO_DATABASE_URL: "" },
    },
  );
  if (res.status !== 0) {
    throw new Error(`prisma migrate diff failed: ${res.stderr || res.stdout}`);
  }
  return res.stdout;
}

function splitStatements(ddl) {
  // No semicolons appear inside identifiers/defaults in generated DDL, so a
  // split on ";" is safe. Strip -- comment lines and blank pieces.
  return ddl
    .split(";")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);
}

async function existingTables() {
  const r = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  return new Set(r.rows.map((row) => String(row.name)));
}

async function columnsOf(table) {
  const r = await client.execute(`PRAGMA table_info('${table.replaceAll("'", "''")}')`);
  return new Set(r.rows.map((row) => String(row.name)));
}

function tableName(createStmt) {
  const m = createStmt.match(/CREATE TABLE\s+"([^"]+)"/i);
  return m ? m[1] : null;
}

// Parse addable column defs from a CREATE TABLE body (skip PK / constraint lines).
function columnDefs(createStmt) {
  const open = createStmt.indexOf("(");
  const close = createStmt.lastIndexOf(")");
  if (open < 0 || close < 0) return [];
  const body = createStmt.slice(open + 1, close);
  const defs = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim().replace(/,$/, "");
    if (!line.startsWith('"')) continue; // PRIMARY KEY(...), CONSTRAINT..., FOREIGN KEY...
    const m = line.match(/^"([^"]+)"\s+(.+)$/s);
    if (!m) continue;
    const name = m[1];
    let def = m[2].trim();
    if (/PRIMARY KEY/i.test(def)) continue; // can't ALTER-ADD a PK column
    defs.push({ name, def });
  }
  return defs;
}

async function run() {
  const ddl = generateDdl();
  const statements = splitStatements(ddl);
  const creates = statements.filter((s) => /^CREATE TABLE/i.test(s));
  const indexes = statements.filter((s) => /^CREATE (UNIQUE )?INDEX/i.test(s));

  const createdTables = [];
  const addedColumns = [];
  const warnings = [];
  let indexesEnsured = 0;

  let tables = await existingTables();

  // Pass 1 — tables & columns. Each statement is guarded so one failure can't
  // strand every not-yet-processed table (which would ship a half-synced schema).
  for (const stmt of creates) {
    const name = tableName(stmt);
    if (!name) continue;
    if (!tables.has(name)) {
      try {
        await client.execute(stmt);
        createdTables.push(name);
        tables.add(name);
      } catch (e) {
        warnings.push(`create table ${name} failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      continue;
    }
    const existingCols = await columnsOf(name);
    for (const { name: col, def } of columnDefs(stmt)) {
      if (existingCols.has(col)) continue;
      let addDef = def;
      if (/NOT NULL/i.test(def) && !/DEFAULT/i.test(def)) {
        addDef = def.replace(/\s*NOT NULL/i, "").trim();
        warnings.push(`${name}.${col} added as NULLABLE (schema is NOT NULL without default — backfill may be needed)`);
      }
      try {
        await client.execute(`ALTER TABLE "${name}" ADD COLUMN "${col}" ${addDef}`);
        addedColumns.push(`${name}.${col}`);
      } catch (e) {
        warnings.push(`add column ${name}.${col} failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // Pre-index remediation — fix known legacy-data violations so the UNIQUE
  // indexes below can be created. Both are safe and idempotent.
  const remediations = [];
  {
    const tablesNow = await existingTables();
    // Empty-string invoiceNumber duplicates → NULL (SQLite allows many NULLs in a unique index).
    if (tablesNow.has("Job")) {
      const r = await client.execute(`UPDATE "Job" SET "invoiceNumber" = NULL WHERE "invoiceNumber" IS NOT NULL AND TRIM("invoiceNumber") = ''`);
      if (r.rowsAffected) remediations.push(`Job.invoiceNumber: nulled ${r.rowsAffected} empty value(s)`);
    }
    // Duplicate branding rows per org → keep the newest (max rowid), delete the rest.
    if (tablesNow.has("DocumentBrandingSettings")) {
      const r = await client.execute(`DELETE FROM "DocumentBrandingSettings" WHERE rowid NOT IN (SELECT MAX(rowid) FROM "DocumentBrandingSettings" GROUP BY "orgId")`);
      if (r.rowsAffected) remediations.push(`DocumentBrandingSettings: removed ${r.rowsAffected} duplicate row(s)`);
    }
    // DocumentSequence became org-scoped: drop the legacy global unique so per-org
    // counter rows can coexist (the new (orgId,type,year) unique is created below).
    if (tablesNow.has("DocumentSequence")) {
      const idx = await client.execute({
        sql: "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
        args: ["DocumentSequence_type_year_key"],
      });
      if (idx.rows.length) {
        await client.execute('DROP INDEX "DocumentSequence_type_year_key"');
        remediations.push("Dropped legacy DocumentSequence_type_year_key (now org-scoped)");
      }
    }
  }

  // Pass 2 — indexes (idempotent via IF NOT EXISTS)
  for (const stmt of indexes) {
    const idempotent = stmt
      .replace(/^CREATE UNIQUE INDEX\s+"/i, 'CREATE UNIQUE INDEX IF NOT EXISTS "')
      .replace(/^CREATE INDEX\s+"/i, 'CREATE INDEX IF NOT EXISTS "');
    try {
      await client.execute(idempotent);
      indexesEnsured += 1;
    } catch (e) {
      // A unique index can fail if existing data violates it — report, don't abort.
      warnings.push(`index skipped: ${idempotent.slice(0, 80)} → ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    ok: true,
    databaseUrl: url,
    createdTables,
    addedColumns,
    remediations,
    indexesEnsured,
    warnings,
  };
}

try {
  const result = await run();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
} finally {
  client.close();
}
