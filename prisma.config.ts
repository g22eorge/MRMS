import { existsSync, readFileSync } from "node:fs";

import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration.
 *
 * This file used to contain ~45 lines of URL rewriting: it forced `file:` URLs,
 * resolved relative SQLite paths against two different working directories, and
 * substituted a build-time database when it detected Vercel. All of that existed
 * because the datasource provider was `sqlite`, so any Prisma validation during
 * `next build` had to be handed a `file:` URL even in production.
 *
 * With a `postgresql` provider the schema validates without a reachable
 * database, so the CLI reads DATABASE_URL like any normal setup. The rewriting
 * was also actively harmful: it silently redirected
 * `DATABASE_URL=... prisma db push` to prisma/dev.db, which is why
 * `bun run test:unit` operated on the development database while claiming to use
 * prisma/test.db.
 */

/**
 * Prisma disables its own dotenv loading as soon as a config file exists, so
 * load it here. Deliberately a few lines rather than a dependency: it only has
 * to cover `KEY=value` and quoted values, and never overrides a variable that
 * is already set, so an explicit `DATABASE_URL=... bunx prisma ...` still wins.
 */
function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// Same precedence Next.js uses: .env.local overrides .env.
loadEnvFile(".env.local");
loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});
