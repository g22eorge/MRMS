import { spawnSync } from "node:child_process";

/**
 * Production build.
 *
 * Replaces scripts/vercel-build.mjs, which was 101 lines of workarounds for the
 * SQLite provider: it stashed the real DATABASE_URL and substituted
 * `file:./dev.db` so Prisma's schema validation would accept it during
 * `next build`, cleared the Turso variables so prisma.config.ts would not pick
 * them up, and — before any of that — ran two "schema healing" scripts against
 * the production database so freshly deployed code would not boot against a
 * stale schema.
 *
 * None of it is needed now. A `postgresql` datasource validates without a
 * reachable database, so the build needs no database at all, and schema drift is
 * handled by `prisma migrate deploy` at release time rather than by DDL repair
 * at build time.
 */

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Off CI, build into a separate directory so `next build` never cleans the
// running dev server's .next mid-session. Honour an explicit NEXT_DIST_DIR.
const isCi = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true" || process.env.DOCKER_BUILD === "1";
const distDir = process.env.NEXT_DIST_DIR || (isCi ? undefined : ".next-gate");
if (distDir && !isCi) {
  console.log(`[build] local build -> ${distDir} (dev server's .next left untouched)`);
}

const env = {
  ...process.env,
  ...(distDir ? { NEXT_DIST_DIR: distDir } : {}),
};

run("bunx", ["prisma", "generate"], { env });
run("node", ["scripts/assert-prisma-models.mjs"], { env });
run("next", ["build"], { env });
