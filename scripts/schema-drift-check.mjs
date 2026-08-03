#!/usr/bin/env node
/**
 * Schema drift check for this repo's production path.
 *
 * Prod schema reaches Turso via the reconciler (scripts/sync-schema-to-db.mjs),
 * NOT Prisma Migrate — so drift is checked with the reconciler's `--check`
 * dry-run, not `prisma migrate diff/status` (which give false negatives against
 * a reconciler-managed database that has no _prisma_migrations baseline).
 *
 * Targets the DB from TURSO_DATABASE_URL / DATABASE_URL (falling back to the
 * local dev DB), exactly like the reconciler. Exits non-zero if any table or
 * column is missing relative to prisma/schema.prisma. Read-only — never mutates.
 */
import { spawnSync } from "node:child_process";

const res = spawnSync("node", ["scripts/sync-schema-to-db.mjs", "--check"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(res.status ?? 1);
