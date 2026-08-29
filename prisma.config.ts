import path from "node:path";

import { defineConfig } from "prisma/config";

function getDatabaseUrl() {
  const isBuildValidation =
    process.env.RUN_PRISMA_MIGRATE_DEPLOY !== "1"
    && (
      process.env.NEXT_PHASE === "phase-production-build"
      || process.env.VERCEL === "1"
      || process.env.VERCEL_ENV !== undefined
    );

  if (isBuildValidation) {
    return `file:${path.resolve(process.cwd(), "prisma", "dev.db")}`;
  }

  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./dev.db";

  // Allow Prisma CLI to target Turso/libSQL when explicitly configured.
  // (Needed for prod `prisma migrate deploy`.)
  if (url.startsWith("libsql:")) {
    return url;
  }

  // PostgreSQL connection strings are already absolute and must be handed over
  // untouched. Without this they fall into the SQLite branch below and come out
  // as `file:/repo/postgresql://user@host/db` — a path, not a connection, which
  // Prisma then rejects for not starting with postgresql://. The error names the
  // schema's url line and reads like the schema is wrong when the config
  // rewrote it.
  if (/^postgres(ql)?:\/\//i.test(url)) {
    return url;
  }

  // Prisma CLI expects a `file:` URL for local sqlite.
  if (!url.startsWith("file:")) {
    const raw = url.replace(/^file:/, "");
    return `file:${path.resolve(process.cwd(), raw)}`;
  }

  const rawPath = url.slice("file:".length);
  if (!rawPath || rawPath.startsWith("/")) return url;

  // Prisma's `file:./dev.db` is resolved relative to `schema.prisma` (./prisma),
  // but the CLI config runs from repo root. Normalize so CLI and runtime match.
  if (rawPath === "dev.db" || rawPath === "./dev.db") {
    return `file:${path.resolve(process.cwd(), "prisma", "dev.db")}`;
  }

  return `file:${path.resolve(process.cwd(), rawPath)}`;
}

// Set the env var so prisma schema can use it
process.env.DATABASE_URL = getDatabaseUrl();

const resolvedUrl = getDatabaseUrl();
const isPostgres = /^postgres(ql)?:\/\//i.test(resolvedUrl);

// The 49 migrations in prisma/migrations are SQLite DDL — DATETIME columns and
// TEXT primary keys — and would fail partway through on PostgreSQL, leaving a
// half-built database. Postgres gets its own directory with a baseline
// generated from the same models (see scripts/pg-schema.mjs). Choosing by
// dialect here means `prisma migrate deploy` cannot be pointed at the wrong
// set by forgetting a flag.
export default defineConfig({
  schema: isPostgres ? "prisma/schema.postgresql.prisma" : "prisma/schema.prisma",
  migrations: {
    path: isPostgres ? "prisma/migrations-postgresql" : "prisma/migrations",
  },
  datasource: {
    url: resolvedUrl,
  },
});
