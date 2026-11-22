import { describe, it, expect, beforeEach, mock } from "bun:test";

/**
 * What the introspection helpers actually ask the database, without one.
 *
 * This file used to cover `lib/db/introspect.ts`, which spoke two dialects and
 * could add a column at runtime. Both went away with the Postgres migration:
 * there is one dialect now, and schema changes arrive through
 * `prisma migrate deploy` rather than through application code. What is still
 * worth pinning is narrower but sharper — the queries must bind the table name
 * instead of inlining it, must scope to the current schema rather than reporting
 * on every schema in the database, and must degrade to an empty answer rather
 * than throwing, because the admin health screens call them precisely when the
 * database is in a state worth asking about.
 */
type Call = { sql: string; values: unknown[] };
const seen: Call[] = [];
let respond: (sql: string) => unknown[];
let fail = false;

/** Mirrors Prisma's tagged-template $queryRaw: strings in, values bound out. */
function queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
  const sql = strings.join("?");
  seen.push({ sql, values });
  if (fail) return Promise.reject(new Error("relation does not exist"));
  return Promise.resolve(respond(sql));
}

mock.module("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));

const {
  listTables,
  tableExists,
  tableColumns,
  columnNames,
  columnExists,
  appliedMigrations,
} = await import("@/lib/db-introspect");

const COLUMN_ROWS = [
  { column_name: "id", data_type: "text", is_nullable: "NO", column_default: null },
  { column_name: "orgId", data_type: "text", is_nullable: "YES", column_default: "'x'::text" },
];

beforeEach(() => {
  seen.length = 0;
  fail = false;
  respond = (sql) => {
    if (/information_schema\.columns/.test(sql)) return COLUMN_ROWS;
    if (/information_schema\.tables/.test(sql)) return [{ table_name: "Client" }, { table_name: "Job" }];
    if (/_prisma_migrations/.test(sql)) {
      return [
        { migration_name: "0_init", finished_at: new Date("2026-09-01"), rolled_back_at: null },
      ];
    }
    return [];
  };
});

const lastSql = () => seen.at(-1)!.sql;

describe("listTables", () => {
  it("returns base tables in the current schema, in name order", async () => {
    expect(await listTables()).toEqual(["Client", "Job"]);
    expect(lastSql()).toContain("current_schema()");
    expect(lastSql()).toContain("BASE TABLE");
    expect(lastSql()).toContain("ORDER BY table_name");
  });
});

describe("tableExists", () => {
  it("binds the table name rather than inlining it", async () => {
    await tableExists("Job");
    // The name must arrive as a bound value; an inlined one would be injectable.
    expect(seen.at(-1)!.values).toEqual(["Job"]);
    expect(lastSql()).not.toContain("Job");
  });

  it("is false when nothing comes back", async () => {
    respond = () => [];
    expect(await tableExists("Nope")).toBe(false);
  });

  it("is false rather than throwing when the query fails", async () => {
    fail = true;
    expect(await tableExists("Job")).toBe(false);
  });
});

describe("tableColumns", () => {
  it("reads information_schema.columns in ordinal order, name bound", async () => {
    const cols = await tableColumns("Client");
    expect(seen.at(-1)!.values).toEqual(["Client"]);
    expect(lastSql()).toContain("ORDER BY ordinal_position");
    expect(cols.map((c) => c.name)).toEqual(["id", "orgId"]);
  });

  it("translates is_nullable into a boolean and keeps the default verbatim", async () => {
    const [id, orgId] = await tableColumns("Client");
    expect(id.nullable).toBe(false);
    expect(id.default).toBeNull();
    expect(orgId.nullable).toBe(true);
    expect(orgId.default).toBe("'x'::text");
    expect(orgId.dataType).toBe("text");
  });

  it("returns an empty list rather than throwing when the table is absent", async () => {
    fail = true;
    expect(await tableColumns("Gone")).toEqual([]);
  });
});

describe("columnNames / columnExists", () => {
  it("derive from tableColumns", async () => {
    expect(await columnNames("Client")).toEqual(new Set(["id", "orgId"]));
    expect(await columnExists("Client", "orgId")).toBe(true);
    expect(await columnExists("Client", "missing")).toBe(false);
  });

  it("report nothing rather than throwing when the table is absent", async () => {
    fail = true;
    expect(await columnNames("Gone")).toEqual(new Set());
    expect(await columnExists("Gone", "id")).toBe(false);
  });
});

describe("appliedMigrations", () => {
  it("reads the Prisma migrations table, newest first", async () => {
    const rows = await appliedMigrations();
    expect(lastSql()).toContain("ORDER BY started_at DESC");
    expect(rows).toEqual([
      { name: "0_init", appliedAt: new Date("2026-09-01"), rolledBackAt: null },
    ]);
  });

  it("returns an empty list on a database with no migrations table", async () => {
    fail = true;
    expect(await appliedMigrations()).toEqual([]);
  });
});
