import { describe, it, expect } from "bun:test";

/**
 * What the Prisma CLI is pointed at, per engine.
 *
 * This config decides three things from one environment variable: the
 * connection URL, which schema file to read, and which migration directory to
 * replay. Getting any of them wrong is quiet in a way that hurts — a Postgres
 * URL used to be rewritten into `file:/repo/postgresql://...`, and Prisma then
 * reported that the *schema* had a bad URL, which sends you to the wrong file.
 *
 * The migrations pair matters most. The 49 migrations under prisma/migrations
 * are SQLite DDL; replaying them against PostgreSQL fails partway and leaves a
 * half-built database.
 */

/**
 * defineConfig does not expose `datasource` on the object it returns, so the
 * resolved URL is read where Prisma itself reads it: the config assigns
 * process.env.DATABASE_URL on load, and that assignment is the contract.
 */
async function configFor(url: string) {
  const prev = process.env.DATABASE_URL;
  const prevTurso = process.env.TURSO_DATABASE_URL;
  process.env.DATABASE_URL = url;
  delete process.env.TURSO_DATABASE_URL;
  const mod = await import(`../../prisma.config?v=${Math.random().toString(36).slice(2)}`);
  const resolvedUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = prev;
  if (prevTurso) process.env.TURSO_DATABASE_URL = prevTurso;
  const cfg = mod.default as { schema: string; migrations: { path: string } };
  return { ...cfg, resolvedUrl };
}

describe("the URL is handed to Prisma in the shape that engine expects", () => {
  it("passes a PostgreSQL URL through untouched", async () => {
    // Was the bug: this fell into the SQLite branch and came back as a file path.
    const c = await configFor("postgresql://user:pw@db.example.com:5432/mrms");
    expect(c.resolvedUrl).toBe("postgresql://user:pw@db.example.com:5432/mrms");
  });

  it("accepts the postgres:// spelling too, which is equally valid", async () => {
    const c = await configFor("postgres://user:pw@db.example.com:5432/mrms");
    expect(c.resolvedUrl).toBe("postgres://user:pw@db.example.com:5432/mrms");
  });

  it("still resolves a relative SQLite path to an absolute one", async () => {
    const c = await configFor("file:./dev.db");
    expect(c.resolvedUrl).toMatch(/^file:\/.*prisma\/dev\.db$/);
  });

  it("leaves libsql alone, which is what production connects with", async () => {
    const c = await configFor("libsql://mrms-prod.turso.io");
    expect(c.resolvedUrl).toBe("libsql://mrms-prod.turso.io");
  });
});

describe("schema and migrations are chosen together, by dialect", () => {
  it("uses the generated Postgres schema and its own baseline on PostgreSQL", async () => {
    const c = await configFor("postgresql://u:p@h:5432/d");
    expect(c.schema).toBe("prisma/schema.postgresql.prisma");
    expect(c.migrations.path).toBe("prisma/migrations-postgresql");
  });

  it("uses the source schema and the SQLite migrations everywhere else", async () => {
    for (const url of ["file:./dev.db", "libsql://mrms-prod.turso.io"]) {
      const c = await configFor(url);
      expect(c.schema).toBe("prisma/schema.prisma");
      expect(c.migrations.path).toBe("prisma/migrations");
    }
  });

  it("never pairs a Postgres schema with SQLite migrations, or the reverse", async () => {
    // The pairing is the point: a mismatch here builds a database from DDL the
    // running schema does not describe.
    for (const url of ["postgresql://u:p@h:5432/d", "file:./dev.db", "libsql://x.turso.io"]) {
      const c = await configFor(url);
      const schemaIsPg = c.schema.includes("postgresql");
      const migrationsArePg = c.migrations.path.includes("postgresql");
      expect(schemaIsPg).toBe(migrationsArePg);
    }
  });
});

describe("the generated Postgres schema stays in step with its source", () => {
  it("is exactly the source with the provider swapped", async () => {
    // A generated file nobody regenerates is worse than no file: it looks
    // authoritative while describing an older database. This fails the moment
    // someone adds a model to schema.prisma and does not run `bun run pg:schema`.
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("prisma/schema.prisma", "utf8");
    const generated = readFileSync("prisma/schema.postgresql.prisma", "utf8");

    const body = generated.slice(generated.indexOf("// This is your Prisma schema file"));
    expect(body).toBe(source.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"'));
    expect(generated).toContain("GENERATED FILE");
  });

  it("keeps the source free of features a provider swap cannot translate", async () => {
    // The one-line translation only holds while the schema stays on plain
    // scalars. A @db. attribute or a Json column silently makes the two
    // schemas describe different databases.
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("prisma/schema.prisma", "utf8");
    expect(source).not.toMatch(/@db\./);
    expect(source).not.toMatch(/dbgenerated\s*\(/);
    expect(source).not.toMatch(/^\s*\w+\s+(Json|Bytes|Decimal)(\?|\[\])?\s/m);
  });
});
