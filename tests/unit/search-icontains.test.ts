import { describe, it, expect, afterEach } from "bun:test";

/**
 * The helper reads the datasource URL once at module load, so each case has to
 * import a fresh copy. `?v=` defeats the module cache without touching the file.
 */
async function loadWith(url: string | undefined) {
  const prev = process.env.DATABASE_URL;
  if (url === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = url;
  const mod = await import(`../../lib/db/search?v=${Math.random().toString(36).slice(2)}`);
  process.env.DATABASE_URL = prev;
  return mod as typeof import("../../lib/db/search");
}

afterEach(() => { /* env restored inside loadWith */ });

describe("icontains on SQLite", () => {
  it("emits a plain contains, because Prisma rejects `mode` on this provider", async () => {
    // Not a stylistic choice: passing mode here throws "Unknown argument `mode`"
    // and takes the query down with it.
    const { icontains } = await loadWith("file:./dev.db");
    expect(icontains("amina")).toEqual({ contains: "amina" });
    expect(Object.keys(icontains("amina"))).toEqual(["contains"]);
  });

  it("reports that the engine already folds case", async () => {
    const { searchIsCaseInsensitiveByDefault } = await loadWith("file:./dev.db");
    expect(searchIsCaseInsensitiveByDefault()).toBe(true);
  });

  it("treats a libsql/Turso URL as SQLite", async () => {
    const { icontains } = await loadWith("libsql://mrms-prod.turso.io");
    expect(icontains("x")).toEqual({ contains: "x" });
  });
});

describe("icontains on PostgreSQL", () => {
  it("adds mode:insensitive, without which every search box goes case-sensitive", async () => {
    const { icontains } = await loadWith("postgresql://user:pw@host:5432/db");
    expect(icontains("amina")).toEqual({ contains: "amina", mode: "insensitive" });
  });

  it("accepts the short postgres:// scheme too", async () => {
    const { icontains } = await loadWith("postgres://user:pw@host/db");
    expect(icontains("x")).toEqual({ contains: "x", mode: "insensitive" });
  });

  it("reports that the engine does not fold case", async () => {
    const { searchIsCaseInsensitiveByDefault } = await loadWith("postgres://h/db");
    expect(searchIsCaseInsensitiveByDefault()).toBe(false);
  });
});

describe("icontainsOrUndefined", () => {
  it("drops an empty search instead of matching everything", async () => {
    // `contains: ""` matches every row. An empty search box must filter nothing,
    // not return the whole table as though it had.
    const { icontainsOrUndefined } = await loadWith("file:./dev.db");
    expect(icontainsOrUndefined("")).toBeUndefined();
    expect(icontainsOrUndefined("   ")).toBeUndefined();
    expect(icontainsOrUndefined(null)).toBeUndefined();
    expect(icontainsOrUndefined(undefined)).toBeUndefined();
  });

  it("trims what it is given", async () => {
    const { icontainsOrUndefined } = await loadWith("file:./dev.db");
    expect(icontainsOrUndefined("  amina  ")).toEqual({ contains: "amina" });
  });
});
