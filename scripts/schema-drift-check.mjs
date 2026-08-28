#!/usr/bin/env node
/**
 * Schema drift check for this repo's production path.
 *
 * Prod schema reaches Turso via the reconciler (scripts/sync-schema-to-db.mjs),
 * NOT Prisma Migrate — so drift is checked with the reconciler's `--check`
 * dry-run, not `prisma migrate diff/status` (which give false negatives against
 * a reconciler-managed database that has no _prisma_migrations baseline).
 *
 * Drift runs in both directions, and this only used to look one way:
 *
 *   1. MISSING — a table or column schema.prisma wants that the DB lacks.
 *      Caught by the reconciler's --check.
 *   2. EXTRA   — a NOT NULL column the DB has that schema.prisma does not know
 *      about. Caught by schema-shape-repair.mjs --check.
 *
 * Only checking (1) is what let goods receiving stay broken on the commercial
 * deployment: GoodsReceivedItem still carried `receivedQty NOT NULL` from an
 * older schema generation, Prisma writes `quantity`, and every receipt failed
 * the constraint. Everything Prisma wanted was present, so this check reported
 * the database clean while a whole feature had never once worked. The blind
 * spot lined up exactly with the failure mode, which is why it survived so long.
 *
 * Targets the DB from TURSO_DATABASE_URL / DATABASE_URL (falling back to the
 * local dev DB), exactly like the reconciler. Read-only — never mutates.
 */
import { spawnSync } from "node:child_process";

const checks = [
  ["missing tables/columns", "scripts/sync-schema-to-db.mjs"],
  ["unknown NOT NULL columns", "scripts/schema-shape-repair.mjs"],
];

let failed = 0;
for (const [label, script] of checks) {
  console.log(`[drift] Checking for ${label} (${script} --check)...`);
  const res = spawnSync("node", [script, "--check"], { stdio: "inherit", env: process.env });
  if ((res.status ?? 1) !== 0) failed = res.status ?? 1;
}

process.exit(failed);
