import { describe, it, expect, mock } from "bun:test";

/** Captures the SQL each branch actually emits, without a database. */
const seen: Array<{ sql: string; args: unknown[] }> = [];
mock.module("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: async (sql: string, ...args: unknown[]) => {
      seen.push({ sql, args });
      if (/information_schema\.columns/.test(sql)) return [{ column_name: "orgId" }, { column_name: "companyTaxId" }];
      // tableExists counts; listTables selects names. Same table, different question.
      if (/information_schema\.tables/.test(sql) && /COUNT/.test(sql)) return [{ n: 1 }];
      if (/information_schema\.tables/.test(sql)) return [{ table_name: "Client" }, { table_name: "Job" }];
      if (/PRAGMA/.test(sql)) return [{ name: "orgId" }, { name: "companyTaxId" }];
      if (/sqlite_master/.test(sql) && /type = 'table' AND name/.test(sql)) return [{ name: "Client" }];
      if (/sqlite_master/.test(sql)) return [{ name: "Client" }, { name: "Job" }];
      return [];
    },
    $executeRawUnsafe: async (sql: string, ...args: unknown[]) => { seen.push({ sql, args }); return 1; },
  },
}));

async function loadWith(url: string) {
  const prev = process.env.DATABASE_URL;
  process.env.DATABASE_URL = url;
  seen.length = 0;
  const mod = await import(`../../lib/db/introspect?v=${Math.random().toString(36).slice(2)}`);
  process.env.DATABASE_URL = prev;
  return mod as typeof import("../../lib/db/introspect");
}

const SQLITE = "file:./dev.db";
const PG = "postgresql://u:p@h:5432/d";

describe("dialect selection", () => {
  it("reports which dialect it will speak", async () => {
    expect((await loadWith(SQLITE)).introspectionDialect()).toBe("sqlite");
    expect((await loadWith(PG)).introspectionDialect()).toBe("postgres");
  });

  it("treats libsql/Turso as SQLite, which is what production runs", async () => {
    expect((await loadWith("libsql://mrms-prod.turso.io")).introspectionDialect()).toBe("sqlite");
  });
});

describe("tableColumns", () => {
  it("uses PRAGMA on SQLite", async () => {
    const m = await loadWith(SQLITE);
    const cols = await m.tableColumns("DocumentBrandingSettings");
    expect(seen[0].sql).toContain("PRAGMA table_info");
    expect(cols.has("companyTaxId")).toBe(true);
  });

  it("uses information_schema on PostgreSQL, where PRAGMA does not exist", async () => {
    const m = await loadWith(PG);
    const cols = await m.tableColumns("DocumentBrandingSettings");
    expect(seen[0].sql).toContain("information_schema.columns");
    expect(seen[0].args).toEqual(["DocumentBrandingSettings"]);
    expect(cols.has("companyTaxId")).toBe(true);
  });

  it("returns an empty set rather than throwing when the query fails", async () => {
    // Every caller treats empty as "assume the columns are missing and degrade",
    // which is the safe direction and the behaviour they had before.
    mock.module("@/lib/prisma", () => ({
      prisma: { $queryRawUnsafe: async () => { throw new Error("no such table"); }, $executeRawUnsafe: async () => 0 },
    }));
    const m = await loadWith(SQLITE);
    expect((await m.tableColumns("Missing")).size).toBe(0);
  });
});

describe("tableExists", () => {
  it("queries sqlite_master on SQLite, with the name bound not inlined", async () => {
    mock.module("@/lib/prisma", () => ({
      prisma: {
        $queryRawUnsafe: async (sql: string, ...args: unknown[]) => { seen.push({ sql, args }); return [{ name: "Client" }]; },
        $executeRawUnsafe: async () => 1,
      },
    }));
    const m = await loadWith(SQLITE);
    expect(await m.tableExists("Client")).toBe(true);
    expect(seen[0].sql).toContain("sqlite_master");
    expect(seen[0].args).toEqual(["Client"]);
  });

  it("counts information_schema.tables on PostgreSQL", async () => {
    mock.module("@/lib/prisma", () => ({
      prisma: {
        $queryRawUnsafe: async (sql: string, ...args: unknown[]) => { seen.push({ sql, args }); return [{ n: 1 }]; },
        $executeRawUnsafe: async () => 1,
      },
    }));
    const m = await loadWith(PG);
    expect(await m.tableExists("Client")).toBe(true);
    expect(seen[0].sql).toContain("information_schema.tables");
  });
});

describe("addColumnIfMissing", () => {
  it("uses IF NOT EXISTS on PostgreSQL, which SQLite has no form of", async () => {
    mock.module("@/lib/prisma", () => ({
      prisma: {
        $queryRawUnsafe: async () => [],
        $executeRawUnsafe: async (sql: string) => { seen.push({ sql, args: [] }); return 1; },
      },
    }));
    const m = await loadWith(PG);
    await m.addColumnIfMissing("OrgWhatsAppConfig", "atApiKey", "TEXT");
    expect(seen[0].sql).toContain("ADD COLUMN IF NOT EXISTS");
  });

  it("checks first on SQLite, and skips a column that is already there", async () => {
    mock.module("@/lib/prisma", () => ({
      prisma: {
        $queryRawUnsafe: async (sql: string) => (/PRAGMA/.test(sql) ? [{ name: "atApiKey" }] : []),
        $executeRawUnsafe: async (sql: string) => { seen.push({ sql, args: [] }); return 1; },
      },
    }));
    const m = await loadWith(SQLITE);
    const added = await m.addColumnIfMissing("OrgWhatsAppConfig", "atApiKey", "TEXT");
    expect(added).toBe(false);
    expect(seen.some((x) => x.sql.includes("ALTER TABLE"))).toBe(false);
  });
});

describe("listTables", () => {
  // Its own mock: the addColumnIfMissing tests above replace the module-level
  // one, and bun does not unwind that between blocks.
  const install = () => mock.module("@/lib/prisma", () => ({
    prisma: {
      $queryRawUnsafe: async (sql: string, ...args: unknown[]) => {
        seen.push({ sql, args });
        if (/information_schema\.tables/.test(sql)) return [{ table_name: "Client" }, { table_name: "Job" }];
        if (/sqlite_master/.test(sql)) return [{ name: "Client" }, { name: "Job" }];
        return [];
      },
      $executeRawUnsafe: async () => 1,
    },
  }));

  it("reads sqlite_master on SQLite", async () => {
    install();
    const m = await loadWith(SQLITE);
    const tables = await m.listTables();
    expect(seen[0].sql).toContain("sqlite_master");
    expect(tables.has("Client")).toBe(true);
    expect(tables.size).toBe(2);
  });

  it("reads information_schema on PostgreSQL, filtered to real tables", async () => {
    install();
    const m = await loadWith(PG);
    const tables = await m.listTables();
    expect(seen[0].sql).toContain("information_schema.tables");
    // Views are not tables; without this filter the health page would list them
    // alongside real ones and report a shape the database does not have.
    expect(seen[0].sql).toContain("BASE TABLE");
    expect(tables.has("Job")).toBe(true);
  });

  it("returns an empty set rather than throwing, so callers degrade as before", async () => {
    mock.module("@/lib/prisma", () => ({
      prisma: {
        $queryRawUnsafe: async () => { throw new Error("no such table"); },
        $executeRawUnsafe: async () => 1,
      },
    }));
    const m = await loadWith(PG);
    expect((await m.listTables()).size).toBe(0);
  });
});
