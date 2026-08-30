import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * When a build may skip migrations, and when it must refuse to.
 *
 * RUN_PRISMA_MIGRATE_DEPLOY=1 with no database URL used to exit(1)
 * unconditionally. That guard protects exactly one thing — a production deploy
 * must never ship code against a database nobody migrated — and it protects
 * nothing on a preview, which has no database to migrate.
 *
 * On the commercial project the flag is set for Preview as well as Production
 * while the Turso variables are Production-only, so every preview build died
 * here in eight seconds. The cost was not the failed build: it was that nothing
 * could be checked on a real deployment before reaching the paying customers,
 * on the one project that has them.
 *
 * Verified by running the script both ways before this was written:
 * VERCEL_ENV=production exits 1 with the original message, VERCEL_ENV=preview
 * warns and builds through to completion.
 */

const SRC = readFileSync("scripts/vercel-build.mjs", "utf8");
const GATE = SRC.slice(
  SRC.indexOf('if (process.env.RUN_PRISMA_MIGRATE_DEPLOY === "1")'),
  SRC.indexOf("process.env.DATABASE_URL = buildDatabaseUrl"),
);

/** The decision, mirrored from the script and pinned against it below. */
function skipsMigrate(vercelEnv: string | undefined, hasDatabaseUrl: boolean) {
  if (hasDatabaseUrl) return false;
  const env = vercelEnv || "";
  return env !== "" && env !== "production";
}

describe("production never skips a migration", () => {
  it("refuses when the target is production and no database is configured", () => {
    expect(skipsMigrate("production", false)).toBe(false);
  });

  it("refuses when the environment is unknown, rather than assuming it is safe", () => {
    // "Not proven to be production" is not "proven not to be". A build run
    // somewhere this script has never seen keeps the strict behaviour.
    expect(skipsMigrate(undefined, false)).toBe(false);
    expect(skipsMigrate("", false)).toBe(false);
  });

  it("still runs the migration whenever a database is configured", () => {
    for (const env of ["production", "preview", "development", undefined]) {
      expect(skipsMigrate(env, true)).toBe(false);
    }
  });
});

describe("a preview builds instead of dying", () => {
  it("skips on preview", () => {
    expect(skipsMigrate("preview", false)).toBe(true);
  });

  it("skips on development too", () => {
    expect(skipsMigrate("development", false)).toBe(true);
  });
});

describe("the script matches the rule tested here", () => {
  it("gates on VERCEL_ENV rather than on the flag alone", () => {
    expect(GATE).toContain("process.env.VERCEL_ENV");
    expect(GATE).toContain('vercelEnv !== "" && vercelEnv !== "production"');
  });

  it("keeps the original hard failure for everything else", () => {
    expect(GATE).toContain("RUN_PRISMA_MIGRATE_DEPLOY=1 requires DATABASE_URL or TURSO_DATABASE_URL.");
    expect(GATE).toContain("process.exit(1)");
  });

  it("says what a database-less preview cannot do, rather than passing silently", () => {
    // A green build on a deployment whose pages cannot query anything is its
    // own kind of misleading, so the skip is loud about what it leaves behind.
    expect(GATE).toContain("skipping prisma migrate deploy");
    expect(GATE).toContain("will fail at runtime");
  });

  it("only migrates in the branch where a URL exists", () => {
    // The migrate must not sit after the guard where a skipped build reaches
    // it anyway — that would run `migrate deploy` against the build's throwaway
    // SQLite file and report success for a migration nothing applied.
    // Matched loosely: the call is now conditional on the engine, passing
    // --schema for PostgreSQL. The property under test is unchanged — the
    // migrate must sit inside the else-branch, not after the guard.
    const migrateAt = GATE.search(/run\("bunx",\s*(IS_POSTGRES|\[)/);
    const elseAt = GATE.indexOf("} else {");
    expect(elseAt).toBeGreaterThan(-1);
    expect(migrateAt).toBeGreaterThan(elseAt);
  });
});
