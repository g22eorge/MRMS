import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const port = new URL(baseURL).port || "4173";
/**
 * The scratch Postgres container (docker-compose.dev.yml, port 5434). The seed
 * below is destructive, so this must never default to the development database.
 */
const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://mrms:mrms_dev_password@localhost:5434/mrms_scratch?schema=public";
const betterAuthSecret = process.env.BETTER_AUTH_SECRET ?? "playwright_test_secret_not_for_production";

// Expose the resolved DB URL to test workers so their direct Prisma instances work
if (!process.env.E2E_DATABASE_URL) process.env.E2E_DATABASE_URL = databaseUrl;
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = databaseUrl;
const authEnv = `NEXT_PUBLIC_APP_URL=${baseURL} BETTER_AUTH_URL=${baseURL} BETTER_AUTH_SECRET=${betterAuthSecret} PROD=false E2E_DISABLE_RATE_LIMIT=1 ALLOW_DESTRUCTIVE_SEED=1 DATABASE_URL=${databaseUrl}`;

// `migrate deploy`, not `db push`: the schema reaches every environment the same
// way now, and db push is what produced the drift the Postgres migration had to
// reconcile.
const webServerBoot = `${authEnv} bunx prisma migrate deploy && bunx prisma generate && ${authEnv} bun run seed`;

// One build directory for both halves: `bun run build` writes to .next-gate
// off-CI, and a `bun run start` looking at .next would find no build.
const distDir = process.env.NEXT_DIST_DIR ?? ".next-e2e";
const distEnv = `NEXT_DIST_DIR=${distDir}`;

const webServerCommand =
  process.env.E2E_SKIP_BUILD === "1"
    ? `${webServerBoot} && ${authEnv} ${distEnv} PORT=${port} bun run start`
    : `${authEnv} ${distEnv} bun run build && ${webServerBoot} && ${authEnv} ${distEnv} PORT=${port} bun run start`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 90000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: webServerCommand,
    url: `${baseURL}/login`,
    reuseExistingServer: !!(process.env.E2E_REUSE_SERVER),
    timeout: 300000,
  },
});
