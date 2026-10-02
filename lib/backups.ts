import path from "node:path";

/**
 * Backup naming + safety helpers. Dependency-free on purpose so unit tests
 * import this without server modules.
 *
 * Restore is deliberately NOT an in-app operation: swapping the live SQLite
 * file under a connected Prisma client risks corruption. Restores run via
 * scripts/restore-db.sh (verified file, auto pre-restore snapshot) with the
 * app stopped. The admin UI offers create/list/download/prune only.
 */

export const BACKUP_PREFIX = "mrms-";
export const BACKUP_SUFFIX = ".db";
export const BACKUP_KEEP_DAYS = 30;

/** Strict backup filename: mrms-YYYY-MM-DD_HH-MM-SS.db — nothing else restores. */
export function isValidBackupName(name: string): boolean {
  return /^mrms-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/.test(name);
}

export function backupFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${BACKUP_PREFIX}${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}${BACKUP_SUFFIX}`;
}

export function resolveBackupDir(): string {
  if (process.env.BACKUP_DIR) return path.resolve(process.env.BACKUP_DIR);
  // Render persists /var/data; uploads live beside the DB there too.
  if (process.env.UPLOADS_DIR) return path.resolve(path.dirname(process.env.UPLOADS_DIR), "backups");
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
