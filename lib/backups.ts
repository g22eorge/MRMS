import path from "node:path";

/**
 * Backup naming + safety helpers. Dependency-free on purpose so unit tests
 * import this without server modules.
 *
 * Backups are `pg_dump -Fc` files. Nothing in the app makes them: the `backup`
 * service (scripts/pg-backup.sh) writes one every BACKUP_INTERVAL into the
 * `backups` volume, and `scripts/backup-db.sh` asks it for one on demand. The
 * app image has no pg_dump, so a "create backup" button would have nothing to
 * run — the page lists, downloads and deletes what the service produced.
 *
 * Restore is deliberately NOT an in-app operation: it drops and recreates the
 * live database, which cannot happen under a connected Prisma client. Restores
 * run via scripts/restore-db.sh (verified file, automatic pre-restore dump,
 * services stopped around it).
 */

/**
 * The three kinds of file this page will touch, and nothing else:
 *
 *   mrms-20261004T020000Z.dump             the backup service (UTC)
 *   mrms-dev-20261004-020000.dump          `bun run pg:export` in development
 *   mrms-prerestore-20261004T020000Z.dump  written by restore-db.sh before it
 *                                          replaces anything
 *
 * scripts/restore-db.sh carries the same pattern; change both together. The
 * pattern is the path-traversal defence — a name that does not match is
 * rejected before it is ever joined to a directory.
 */
const BACKUP_NAME = /^mrms-(\d{8}T\d{6}Z|dev-\d{8}-\d{6}|prerestore-\d{8}T\d{6}Z)\.dump$/;

export const BACKUP_SUFFIX = ".dump";

/** Retention is the backup service's, not the page's; shown for reference. */
export const BACKUP_KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS) || 14;

export function isValidBackupName(name: string): boolean {
  return BACKUP_NAME.test(name);
}

/** The backup service's own naming, UTC. Kept here so there is one definition. */
export function backupFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `mrms-${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}` +
    `T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z${BACKUP_SUFFIX}`
  );
}

/**
 * Where the dumps are. Production mounts the `backups` volume at /backups and
 * sets BACKUP_DIR; development falls back to ./backups, which the app container
 * sees through its bind mount and where `pg:export` writes.
 */
export function resolveBackupDir(): string {
  if (process.env.BACKUP_DIR) return path.resolve(process.env.BACKUP_DIR);
  return path.join(process.cwd(), "backups");
}

export type BackupEntry = { name: string; bytes: number; createdAt: Date };

/** Sort newest-first for display. Pure — takes stat rows, returns them ordered. */
export function sortBackupsNewestFirst(entries: BackupEntry[]): BackupEntry[] {
  return [...entries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Names older than keepDays (relative to now). Pure — the caller deletes. */
export function pruneCandidates(entries: BackupEntry[], keepDays: number, now: Date = new Date()): string[] {
  const cutoff = now.getTime() - keepDays * 86_400_000;
  return entries.filter((e) => e.createdAt.getTime() < cutoff).map((e) => e.name);
}
