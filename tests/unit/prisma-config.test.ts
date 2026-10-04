import { describe, it, expect, afterEach } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * What the Prisma CLI is pointed at.
 *
 * This file used to cover a config that chose a URL shape, a schema file and a
 * migration directory from one environment variable, because the repo carried
 * two schemas — `sqlite` for the source of truth and a generated `postgresql`
 * copy. There is one schema now, so the interesting property inverted: the
 * config must do as little as possible.
 *
 * The rewriting it used to do was not harmless. It redirected an explicit
 * `DATABASE_URL=... bunx prisma ...` to `prisma/dev.db`, so `test:unit` operated
 * on the development database while reporting that it used a throwaway one. A
 * test that only checked the happy path would not have caught that, so what is
 * pinned here is that an explicitly supplied URL survives untouched.
 */
const CONFIG_SRC = readFileSync("prisma.config.ts", "utf8");

const saved = process.env.DATABASE_URL;
afterEach(() => {
  if (saved === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = saved;
});

async function loadConfig() {
  const mod = await import(`../../prisma.config.ts?v=${Math.random().toString(36).slice(2)}`);
  return mod.default as { schema: string; migrations?: { path?: string } };
}

describe("the config points at the one schema and its migrations", () => {
  it("uses prisma/schema.prisma and prisma/migrations", async () => {
    const config = await loadConfig();
    expect(config.schema).toBe("prisma/schema.prisma");
    expect(config.migrations?.path).toBe("prisma/migrations");
  });

  it("names no second schema and no archived migration directory", () => {
    // The SQLite migrations are kept for reference but must never be replayed:
    // they contain PRAGMA statements Postgres cannot parse.
    expect(CONFIG_SRC).not.toContain("schema.postgresql.prisma");
    expect(CONFIG_SRC).not.toContain("migrations-sqlite-archive");
    expect(CONFIG_SRC).not.toContain("migrations-postgresql");
  });
});

describe("an explicitly supplied DATABASE_URL survives", () => {
  it("is not rewritten, reshaped, or redirected to a file", async () => {
    const url = "postgresql://mrms:pw@localhost:5434/mrms_scratch?schema=public";
    process.env.DATABASE_URL = url;
    await loadConfig();
    expect(process.env.DATABASE_URL).toBe(url);
  });

  it("takes precedence over anything in .env, which is only a fallback", async () => {
    process.env.DATABASE_URL = "postgresql://explicit:pw@host:5432/explicit";
    await loadConfig();
    expect(process.env.DATABASE_URL).toBe("postgresql://explicit:pw@host:5432/explicit");
  });

  it("does no file: coercion at all", () => {
    // "file:" survives in two innocent places: the comment recording why the
    // coercion went away (in backticks, so a bare quote check is not enough),
    // and `loadEnvFile(file: string)`. Strip the comments, then look for the
    // string literal — a URL the config builds or prefixes itself.
    const code = CONFIG_SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/["'`]file:/);
  });
});

describe("the env loader", () => {
  it("reads .env.local before .env, the precedence Next.js uses", () => {
    const local = CONFIG_SRC.indexOf('loadEnvFile(".env.local")');
    const base = CONFIG_SRC.indexOf('loadEnvFile(".env")');
    expect(local).toBeGreaterThan(-1);
    expect(base).toBeGreaterThan(local);
  });

  it("never overwrites a variable that is already set", () => {
    // Prisma stops loading dotenv once a config file exists, so this file does
    // it — but a value from the environment must still win over a file.
    expect(CONFIG_SRC).toContain("if (process.env[key] !== undefined) continue;");
  });
});
