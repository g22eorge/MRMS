/**
 * Tables present in the production SQLite database that are excluded from both
 * the baseline fingerprint and the Postgres import.
 *
 * Every entry has been checked for code references with a repo-wide search
 * before being listed here. See docs/pg-migration/retired-tables.md for the
 * preserved contents of the rows that are dropped.
 */
export const JUNK_TABLES = new Set([
  // ── Debris from past emergency repairs ────────────────────────────────────
  // UK-spelling duplicate of Organization, created by an old raw-DDL typo.
  // Zero code references to a table of this name.
  "Organisation",
  // One-off backup taken during the 2026-04-26 Job column repair.
  "Job_restore_backup_20260426",

  // ── Abandoned features: created by DDL, never read ────────────────────────
  // All three have ZERO references anywhere in app/, lib/, components/ or
  // scripts/ — not even in app/api/admin/db-fix/route.ts, which created them.
  // Branch-level document numbering was never built; numbering is resolved from
  // DocumentBrandingSettings (see lib/commercial/org-number.ts), and the single
  // BranchNumberingSettings row duplicates prefixes already stored there.
  "BranchNumberingSettings",
  "BranchOperatingHours",
  "OrgSecurityPolicy",

  // ── Prisma bookkeeping ────────────────────────────────────────────────────
  // Recreated by `migrate deploy`; never imported.
  "_prisma_migrations",
]);
