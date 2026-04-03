import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const port = new URL(baseURL).port || "4173";
const authEnv = `NEXT_PUBLIC_APP_URL=${baseURL} BETTER_AUTH_URL=${baseURL}`;

const webServerCommand =
  process.env.E2E_SKIP_BUILD === "1"
    ? `${authEnv} PORT=${port} bun run start`
    : `${authEnv} bun run build && ${authEnv} PORT=${port} bun run start`;

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
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
