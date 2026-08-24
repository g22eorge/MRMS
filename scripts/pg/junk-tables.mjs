/**
 * Tables that exist in the production database as debris from past emergency
 * repairs. They carry no business data the app reads and are excluded from
 * both the baseline fingerprint and the Postgres import.
 */
export const JUNK_TABLES = new Set([
  // UK-spelling duplicate of Organization, created by an old raw-DDL typo.
  // Verified: no code path references a table named "Organisation".
  "Organisation",
  // One-off backup taken during the 2026-04-26 Job column repair.
  "Job_restore_backup_20260426",
  // Prisma's own bookkeeping — recreated by `migrate deploy`, never imported.
  "_prisma_migrations",
]);
