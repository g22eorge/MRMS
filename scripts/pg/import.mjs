/**
 * Copies a SQLite/Turso dump into the Postgres database.
 *
 * Schema-aware on purpose. A generic table-to-table copier can only match
 * columns by name and hope; this one reads the datamodel, so it knows which
 * columns exist, which are enums, which are dates, and what order the tables
 * have to be written in for the foreign keys Postgres now actually enforces.
 *
 *   node scripts/pg/import.mjs <dump.db> [options]
 *
 *   --check       validate only: enum labels, dropped-column emptiness, orphans
 *   --truncate    empty the target tables first (required for a clean re-run)
 *   --batch=N     rows per insert (default 500)
 *
 * DATABASE_URL selects the target. The script refuses to write to a database
 * that already holds business rows unless --truncate is given, so a mistyped
 * URL cannot quietly merge two datasets.
 */

import { createClient } from "@libsql/client";
import { PrismaClient, Prisma } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { JUNK_TABLES } from "./junk-tables.mjs";
import { toBoolean, toDate } from "./coerce.mjs";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const truncate = args.includes("--truncate");
const batchSize = Number(args.find((a) => a.startsWith("--batch="))?.split("=")[1] ?? 500);
const dumpArg = args.find((a) => !a.startsWith("--"));

if (!dumpArg) {
  console.error("usage: node scripts/pg/import.mjs <dump.db> [--check] [--truncate] [--batch=N]");
  process.exit(2);
}
const dumpPath = path.resolve(process.cwd(), dumpArg);
if (!existsSync(dumpPath)) {
  console.error(`import: no such database: ${dumpPath}`);
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("import: DATABASE_URL is not set");
  process.exit(2);
}

const importMap = JSON.parse(readFileSync("docs/pg-migration/import-map.json", "utf8"));
const droppedColumns = importMap.droppedColumns ?? {};
/**
 * How to resolve duplicates that violate a declared unique constraint, keyed by
 * "Table.col[,col]". Only "nullSurplus" is supported: keep the earliest row's
 * value and null the column on the rest. Applied only with --resolve-duplicates,
 * and every change is printed.
 */
const duplicatePolicy = importMap.duplicatePolicy ?? {};
const resolveDuplicates = args.includes("--resolve-duplicates");

const sqlite = createClient({ url: `file:${dumpPath}` });
const prisma = new PrismaClient({ log: ["error"] });

const q = (s) => `"${String(s).replaceAll('"', '""')}"`;
const delegateOf = (model) => model.charAt(0).toLowerCase() + model.slice(1);

// ── Datamodel description ───────────────────────────────────────────────────
const enumValues = new Map(
  Prisma.dmmf.datamodel.enums.map((e) => [e.name, new Set(e.values.map((v) => v.dbName ?? v.name))]),
);

const models = Prisma.dmmf.datamodel.models.map((m) => {
  const columns = [];
  const selfRefColumns = new Set();
  const foreignKeys = [];

  for (const f of m.fields) {
    if (f.kind === "object") {
      if (!f.relationFromFields?.length) continue;
      const target = Prisma.dmmf.datamodel.models.find((x) => x.name === f.type);
      if (f.type === m.name) f.relationFromFields.forEach((c) => selfRefColumns.add(c));
      foreignKeys.push({
        columns: f.relationFromFields,
        targetTable: target?.dbName ?? f.type,
        targetColumns: f.relationToFields ?? ["id"],
      });
      continue;
    }
    if (f.isList) continue;
    columns.push({
      name: f.dbName ?? f.name,
      field: f.name,
      type: f.type,
      kind: f.kind, // "scalar" | "enum"
      required: f.isRequired,
      hasDefault: f.hasDefaultValue,
      isUpdatedAt: Boolean(f.isUpdatedAt),
    });
  }

  // Unique constraints the datamodel declares. Production may not have the
  // matching index — the schema drifted — so the data can violate them.
  const uniques = [];
  for (const f of m.fields) {
    if (f.isUnique && f.kind !== "object") uniques.push([f.dbName ?? f.name]);
  }
  for (const idx of m.uniqueIndexes ?? []) {
    const cols = idx.fields.map((name) => {
      const field = m.fields.find((x) => x.name === name);
      return field?.dbName ?? name;
    });
    uniques.push(cols);
  }

  return {
    model: m.name,
    table: m.dbName ?? m.name,
    delegate: delegateOf(m.name),
    columns,
    selfRefColumns,
    foreignKeys,
    uniques,
  };
});

const byTable = new Map(models.map((m) => [m.table, m]));

/** Tables ordered so a row's referenced parents are always written first. */
function topologicalOrder() {
  const remaining = new Map(models.map((m) => [m.model, m]));
  const deps = new Map(
    models.map((m) => [
      m.model,
      new Set(
        m.foreignKeys
          .map((fk) => byTable.get(fk.targetTable)?.model)
          .filter((name) => name && name !== m.model),
      ),
    ]),
  );

  const order = [];
  const placed = new Set();
  while (remaining.size) {
    const ready = [...remaining.values()].filter((m) =>
      [...deps.get(m.model)].every((d) => placed.has(d)),
    );
    if (!ready.length) {
      // Would only happen if a future schema introduces a genuine cycle. Say so
      // rather than emitting a silently wrong order.
      throw new Error(
        `import: foreign-key cycle among ${[...remaining.keys()].join(", ")} — needs a manual order`,
      );
    }
    for (const m of ready) {
      order.push(m);
      placed.add(m.model);
      remaining.delete(m.model);
    }
  }
  return order;
}

// ── Value coercion ─────────────────────────────────────────────────────────
/**
 * SQLite has no date or boolean type. Dates were written as ISO-8601 text by
 * Prisma and as `CURRENT_TIMESTAMP` strings by the hand-written DDL, and older
 * rows may be integer epoch milliseconds; booleans are 0/1.
 */
function coerce(value, column, context) {
  if (value === null || value === undefined) return null;

  switch (column.type) {
    case "DateTime":
      return toDate(value, context);
    case "Boolean":
      return toBoolean(value);
    case "Int":
      return Number(value);
    case "Float":
      return Number(value);
    case "Decimal":
      // Via string, so a float's decimal expansion is not re-rounded on the way in.
      return new Prisma.Decimal(String(value));
    case "String":
      return String(value);
    default: {
      if (column.kind === "enum") {
        const label = String(value);
        const allowed = enumValues.get(column.type);
        if (allowed && !allowed.has(label)) {
          throw new Error(
            `${context}: ${label} is not a valid ${column.type} (allowed: ${[...allowed].join(", ")})`,
          );
        }
        return label;
      }
      return value;
    }
  }
}

// ── Source inspection ──────────────────────────────────────────────────────
async function sourceTables() {
  const r = await sqlite.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  return new Set(r.rows.map((row) => String(row.name)));
}

async function sourceColumns(table) {
  const r = await sqlite.execute(`PRAGMA table_info(${q(table)})`);
  return r.rows.map((row) => String(row.name));
}

async function sourceRows(table, columns) {
  const list = columns.map(q).join(", ");
  const r = await sqlite.execute(`SELECT ${list} FROM ${q(table)}`);
  return r.rows;
}

// ── Validation ─────────────────────────────────────────────────────────────
async function validate(order, present) {
  const problems = [];
  const notes = [];

  // 1. Every column the import-map says to drop must genuinely hold no data.
  for (const [table, columns] of Object.entries(droppedColumns)) {
    if (!present.has(table)) continue;
    const actual = new Set(await sourceColumns(table));
    for (const column of Object.keys(columns)) {
      if (!actual.has(column)) continue;
      const r = await sqlite.execute(`SELECT COUNT(${q(column)}) AS n FROM ${q(table)}`);
      const n = Number(r.rows[0].n);
      if (n > 0) {
        problems.push(
          `${table}.${column} is marked as droppable but holds ${n} non-null values — revisit docs/pg-migration/import-map.json`,
        );
      }
    }
  }

  // 2. Enum labels the datamodel would reject.
  for (const m of order) {
    if (!present.has(m.table)) continue;
    const actual = new Set(await sourceColumns(m.table));
    for (const column of m.columns) {
      if (column.kind !== "enum" || !actual.has(column.name)) continue;
      const r = await sqlite.execute(
        `SELECT DISTINCT ${q(column.name)} AS v FROM ${q(m.table)} WHERE ${q(column.name)} IS NOT NULL`,
      );
      const allowed = enumValues.get(column.type) ?? new Set();
      for (const row of r.rows) {
        const label = String(row.v);
        if (!allowed.has(label)) {
          problems.push(`${m.table}.${column.name}: "${label}" is not a valid ${column.type}`);
        }
      }
    }
  }

  // 3. Rows pointing at parents that do not exist. SQLite did not enforce
  //    foreign keys; Postgres will, so an orphan aborts the insert.
  for (const m of order) {
    if (!present.has(m.table)) continue;
    const actual = new Set(await sourceColumns(m.table));
    for (const fk of m.foreignKeys) {
      const target = byTable.get(fk.targetTable);
      if (!target || !present.has(target.table)) continue;
      if (!fk.columns.every((c) => actual.has(c))) continue;
      if (fk.columns.length !== 1 || fk.targetColumns.length !== 1) continue; // composite: skip
      const [col] = fk.columns;
      const [ref] = fk.targetColumns;
      const targetCols = new Set(await sourceColumns(target.table));
      if (!targetCols.has(ref)) continue;
      const r = await sqlite.execute(
        `SELECT COUNT(*) AS n FROM ${q(m.table)} s
         WHERE s.${q(col)} IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM ${q(target.table)} t WHERE t.${q(ref)} = s.${q(col)})`,
      );
      const n = Number(r.rows[0].n);
      if (n > 0) {
        problems.push(
          `${m.table}.${col} has ${n} row(s) referencing a missing ${target.table}.${ref} — Postgres will reject these`,
        );
      }
    }
  }

  // 4. Rows that violate a unique constraint the datamodel declares.
  //    SQLite did not necessarily have the index — production is missing
  //    Job_invoiceNumber_key, for instance — so duplicates can be sitting in
  //    the data. Postgres creates the index at migrate time and then rejects
  //    them, and a silent `skipDuplicates` would drop the rows along with every
  //    child row that references them.
  for (const m of order) {
    if (!present.has(m.table)) continue;
    const actual = new Set(await sourceColumns(m.table));
    for (const cols of m.uniques) {
      if (!cols.every((c) => actual.has(c))) continue;
      const list = cols.map(q).join(", ");
      const notNull = cols.map((c) => `${q(c)} IS NOT NULL`).join(" AND ");
      const r = await sqlite.execute(
        `SELECT ${list}, COUNT(*) AS c FROM ${q(m.table)}
         WHERE ${notNull} GROUP BY ${list} HAVING COUNT(*) > 1 ORDER BY c DESC`,
      );
      if (!r.rows.length) continue;
      const extra = r.rows.reduce((sum, row) => sum + Number(row.c) - 1, 0);
      const sample = r.rows
        .slice(0, 3)
        .map((row) => cols.map((c) => `${c}=${JSON.stringify(row[c])}`).join(" ") + ` ×${row.c}`)
        .join("; ");
      const policyKey = `${m.table}.${cols.join(",")}`;
      const policy = duplicatePolicy[policyKey];
      const description =
        `${m.table} violates UNIQUE(${cols.join(", ")}): ${r.rows.length} duplicated value(s), ` +
        `${extra} surplus row(s). e.g. ${sample}`;
      if (policy && resolveDuplicates) {
        notes.push(`${description} — resolving with "${policy.resolver}"`);
      } else if (policy) {
        problems.push(`${description} — policy "${policy.resolver}" available; re-run with --resolve-duplicates to apply it`);
      } else {
        problems.push(`${description} — no policy in docs/pg-migration/import-map.json`);
      }
    }
  }

  // 5. Source tables the datamodel has no home for.
  for (const table of present) {
    if (JUNK_TABLES.has(table) || byTable.has(table)) continue;
    problems.push(`${table} exists in the dump but not in the datamodel — its rows would be dropped`);
  }

  // 6. Columns present in the dump, unknown to the datamodel, not in the map.
  for (const m of order) {
    if (!present.has(m.table)) continue;
    const known = new Set(m.columns.map((c) => c.name));
    for (const fk of m.foreignKeys) fk.columns.forEach((c) => known.add(c));
    const mapped = new Set(Object.keys(droppedColumns[m.table] ?? {}));
    for (const column of await sourceColumns(m.table)) {
      if (known.has(column) || mapped.has(column)) continue;
      problems.push(`${m.table}.${column} is unknown to the datamodel and not listed in import-map.json`);
    }
  }

  for (const table of present) {
    if (JUNK_TABLES.has(table)) {
      const r = await sqlite.execute(`SELECT COUNT(*) AS n FROM ${q(table)}`);
      notes.push(`skipping ${table} (${Number(r.rows[0].n)} rows) — see docs/pg-migration/retired-tables.md`);
    }
  }

  return { problems, notes };
}


// ── Duplicate resolution ───────────────────────────────────────────────────
/**
 * Named, per-constraint fixes for data that violates a unique constraint the
 * datamodel declares but the source database never had an index for.
 *
 * Deliberately not a generic "keep the first row" rule: which row is correct is
 * a question about the business records, and the answer differs per constraint.
 * Each resolver returns the UPDATE statements it wants to run against the
 * *target* after that table is written, and every one is printed.
 */
const RESOLVERS = {
  /**
   * Job.invoiceNumber is a denormalised copy of Invoice.invoiceNumber. The
   * Invoice table is authoritative and its own numbers are unique, so keep the
   * value on the job the Invoice actually references and clear the rest.
   */
  async "job-invoice-number"() {
    const dupes = await sqlite.execute(
      `SELECT "invoiceNumber" AS n FROM "Job" WHERE "invoiceNumber" IS NOT NULL
       GROUP BY "invoiceNumber" HAVING COUNT(*) > 1`,
    );
    const changes = [];
    for (const row of dupes.rows) {
      const number = String(row.n);
      const owner = await sqlite.execute({
        sql: `SELECT "jobId" FROM "Invoice" WHERE "invoiceNumber" = ? AND "jobId" IS NOT NULL LIMIT 1`,
        args: [number],
      });
      const keepJobId = owner.rows[0]?.jobId ? String(owner.rows[0].jobId) : null;
      const jobs = await sqlite.execute({
        sql: `SELECT id FROM "Job" WHERE "invoiceNumber" = ? ORDER BY "receivedAt"`,
        args: [number],
      });
      // With no Invoice pointing anywhere, fall back to the earliest job so the
      // number is not lost entirely.
      const keep = keepJobId ?? String(jobs.rows[0].id);
      for (const job of jobs.rows) {
        const id = String(job.id);
        if (id === keep) continue;
        changes.push({
          table: "Job",
          id,
          set: { invoiceNumber: null },
          why: `${number} kept on ${keep}${keepJobId ? " (referenced by its Invoice)" : " (earliest; no Invoice row references it)"}`,
        });
      }
    }
    return changes;
  },

  /**
   * Keep orgId on the per-org branding row; clear it on the legacy singleton,
   * which stays readable by id as the fallback the app still looks for.
   */
  async "branding-singleton"() {
    const rows = await sqlite.execute(
      `SELECT id, "orgId" FROM "DocumentBrandingSettings" WHERE "orgId" IS NOT NULL`,
    );
    const byOrg = new Map();
    for (const r of rows.rows) {
      const orgId = String(r.orgId);
      if (!byOrg.has(orgId)) byOrg.set(orgId, []);
      byOrg.get(orgId).push(String(r.id));
    }
    const changes = [];
    for (const [orgId, ids] of byOrg) {
      if (ids.length < 2) continue;
      const keep = ids.includes(orgId) ? orgId : ids[0];
      for (const id of ids) {
        if (id === keep) continue;
        changes.push({
          table: "DocumentBrandingSettings",
          id,
          set: { orgId: null },
          why: `orgId ${orgId} kept on the per-org row ${keep}; ${id} stays readable by id`,
        });
      }
    }
    return changes;
  },
};

async function plannedResolutions() {
  const planned = [];
  for (const [key, policy] of Object.entries(duplicatePolicy)) {
    const resolver = RESOLVERS[policy.resolver];
    if (!resolver) throw new Error(`import: no resolver named "${policy.resolver}" for ${key}`);
    planned.push(...(await resolver()));
  }
  return planned;
}

// ── Target guards ──────────────────────────────────────────────────────────
async function targetRowCount(order) {
  let total = 0;
  for (const m of order) {
    const r = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM ${q(m.table)}`);
    total += Number(r[0].n);
  }
  return total;
}

async function truncateAll(order) {
  // One statement so the cascade is atomic; RESTART IDENTITY is harmless here
  // (every key is a cuid) but keeps the target genuinely fresh.
  const tables = order.map((m) => q(m.table)).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

// ── Main ───────────────────────────────────────────────────────────────────
const order = topologicalOrder();
const present = await sourceTables();

console.log(`\nIMPORT  ${path.relative(process.cwd(), dumpPath)}  ->  Postgres`);
console.log("=".repeat(74));
console.log(`  datamodel tables: ${order.length}   dump tables: ${present.size}`);

const { problems, notes } = await validate(order, present);
for (const note of notes) console.log(`  note: ${note}`);
if (problems.length) {
  console.error(`\n  ${problems.length} problem(s) — refusing to import:\n`);
  for (const p of problems) console.error(`    - ${p}`);
  console.error("");
  await sqlite.close();
  await prisma.$disconnect();
  process.exit(1);
}
console.log("  validation: OK (enum labels, dropped columns, orphan keys, unknown tables/columns)");

if (checkOnly) {
  console.log("\n  --check given; nothing written.\n");
  await sqlite.close();
  await prisma.$disconnect();
  process.exit(0);
}

const existing = await targetRowCount(order);
if (existing > 0 && !truncate) {
  console.error(
    `\n  target already holds ${existing} rows. Re-run with --truncate to replace them,` +
    `\n  or point DATABASE_URL at an empty database.\n`,
  );
  await sqlite.close();
  await prisma.$disconnect();
  process.exit(1);
}
if (truncate && existing > 0) {
  console.log(`  truncating target (${existing} rows)...`);
  await truncateAll(order);
}

let totalRows = 0;
const perTable = [];
const deferredSelfRefs = [];

// Resolved before anything is written, so a row never has to be corrected after
// the constraint has already rejected it.
const resolutions = resolveDuplicates ? await plannedResolutions() : [];
if (resolutions.length) {
  console.log(`\n  applying ${resolutions.length} duplicate resolution(s):`);
  for (const change of resolutions) {
    const fields = Object.entries(change.set).map(([k, v]) => `${k}=${v === null ? "NULL" : v}`).join(", ");
    console.log(`    ${change.table} ${change.id}: ${fields}  (${change.why})`);
  }
}
const resolutionsByTable = new Map();
for (const change of resolutions) {
  if (!resolutionsByTable.has(change.table)) resolutionsByTable.set(change.table, new Map());
  resolutionsByTable.get(change.table).set(change.id, change.set);
}

for (const m of order) {
  if (!present.has(m.table)) continue;

  const sourceCols = new Set(await sourceColumns(m.table));
  const columns = m.columns.filter((c) => sourceCols.has(c.name));
  // Foreign-key columns are scalars in the datamodel too, so they are already
  // in `columns`; nothing extra to collect.
  if (!columns.length) continue;

  const rows = await sourceRows(m.table, columns.map((c) => c.name));
  if (!rows.length) continue;

  // A self-referencing column is written as null first, then filled in, so the
  // parent row does not have to precede the child inside a single table.
  const selfRefCols = columns.filter((c) => m.selfRefColumns.has(c.name));

  const tableResolutions = resolutionsByTable.get(m.table);

  const data = rows.map((row, i) => {
    const out = {};
    const override = tableResolutions?.get(String(row.id));
    for (const c of columns) {
      const context = `${m.table}.${c.name} (row ${i + 1})`;
      if (override && c.field in override) {
        out[c.field] = override[c.field];
        continue;
      }
      const value = coerce(row[c.name], c, context);
      if (selfRefCols.some((s) => s.name === c.name) && value !== null) {
        deferredSelfRefs.push({ table: m.table, delegate: m.delegate, id: row.id, column: c.field, value });
        out[c.field] = null;
        continue;
      }
      out[c.field] = value;
    }
    return out;
  });

  const delegate = prisma[m.delegate];
  for (let i = 0; i < data.length; i += batchSize) {
    const chunk = data.slice(i, i + batchSize);
    try {
      // No skipDuplicates: a row that cannot be written is a finding, not
      // something to drop quietly — and dropping a parent row cascades into
      // foreign-key failures on everything that referenced it.
      await delegate.createMany({ data: chunk });
    } catch (error) {
      console.error(`\n  failed writing ${m.table} rows ${i + 1}-${i + chunk.length}:`);
      console.error(`    ${error.message?.split("\n")[0] ?? error}`);
      await sqlite.close();
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  totalRows += data.length;
  perTable.push({ table: m.table, rows: data.length });
}

// Fill in the self-references now that every row exists.
for (const ref of deferredSelfRefs) {
  await prisma[ref.delegate].update({ where: { id: ref.id }, data: { [ref.column]: ref.value } });
}

console.log(`\n  wrote ${totalRows} rows across ${perTable.length} tables`);
if (deferredSelfRefs.length) {
  console.log(`  resolved ${deferredSelfRefs.length} self-reference(s) in a second pass`);
}
console.log("\n  largest tables:");
for (const t of perTable.sort((a, b) => b.rows - a.rows).slice(0, 10)) {
  console.log(`    ${String(t.rows).padStart(6)}  ${t.table}`);
}
console.log("");

await sqlite.close();
await prisma.$disconnect();
