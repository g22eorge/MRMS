// Reads the live session and the backups directory, so it must never be
// prerendered at build time. Aligns with the force-dynamic convention used
// across the app.
export const dynamic = "force-dynamic";

import { promises as fs } from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";

import { getCurrentUserRole } from "@/lib/session";
import { checkCanRunOpsTools } from "@/lib/platform-admin";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import {
  BACKUP_KEEP_DAYS,
  isValidBackupName,
  resolveBackupDir,
  sortBackupsNewestFirst,
  type BackupEntry,
} from "@/lib/backups";

async function listBackups(): Promise<BackupEntry[]> {
  const dir = resolveBackupDir();
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  const entries: BackupEntry[] = [];
  for (const name of files) {
    if (!isValidBackupName(name)) continue;
    try {
      const stat = await fs.stat(path.join(dir, name));
      if (!stat.isFile()) continue;
      entries.push({ name, bytes: stat.size, createdAt: stat.mtime });
    } catch {
      continue;
    }
  }
  return sortBackupsNewestFirst(entries);
}

function formatBytes(bytes: number) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function BackupsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; deleted?: string; error?: string }>;
}) {
  const { user } = await getCurrentUserRole();
  // Same gate as Data Heal: platform operators everywhere, org ADMINs on the
  // single-tenant care deployment.
  if (!(await checkCanRunOpsTools(user))) {
    redirect("/dashboard");
  }
  const feedback = await searchParams;
  const entries = await listBackups();
  // There is no "create backup" action. It used VACUUM INTO, which is SQLite
  // and does not exist in Postgres, and its replacement — pg_dump — is not in
  // the app image. The backup service makes them; scripts/backup-db.sh asks it
  // for one on demand.

  async function deleteBackupAction(formData: FormData) {
    "use server";
    const { user: actor } = await getCurrentUserRole();
    if (!(await checkCanRunOpsTools(actor))) return;
    const name = String(formData.get("name") ?? "");
    if (!isValidBackupName(name)) {
      redirect("/settings/backups?error=Invalid+backup+name");
    }
    // Not `.catch(() => undefined)`: that reported "Deleted" whether or not the
    // file went, which is how a permissions problem on the shared volume would
    // have stayed invisible. Say what happened.
    try {
      await fs.unlink(path.join(resolveBackupDir(), name));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? "unknown error";
      redirect(`/settings/backups?error=${encodeURIComponent(`Could not delete ${name} (${code})`)}`);
    }
    redirect(`/settings/backups?deleted=${encodeURIComponent(name)}`);
  }

  return (
    <div className="space-y-4">
      <div className="dc-card overflow-hidden px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[0.8125rem] font-bold text-[var(--ink)]">Backups</p>
            <p className="mt-0.5 text-[0.75rem] text-[var(--ink-muted)]">
              {`pg_dump snapshots in ${resolveBackupDir()} · kept ${BACKUP_KEEP_DAYS} days`}
            </p>
          </div>
          <span className="rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-0.5 text-[0.8125rem] text-[var(--ink-muted)]">
            {entries.length} kept
          </span>
        </div>
      </div>

      {feedback.error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-[0.8125rem] font-medium text-red-600">
          {feedback.error}
        </p>
      ) : null}
      {feedback.created ? (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-[0.8125rem] font-medium text-emerald-700 dark:text-emerald-400">
          Backup created: {feedback.created}
        </p>
      ) : null}
      {feedback.deleted ? (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-2.5 text-[0.8125rem] text-[var(--ink-muted)]">
          Deleted: {feedback.deleted}
        </p>
      ) : null}

      <section className="dc-card px-4 py-3">
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Taking a backup</p>
        <p className="mt-1.5 text-[0.8125rem] text-[var(--ink-muted)]">
          The <code>backup</code> service takes one automatically every{" "}
          <code>BACKUP_INTERVAL</code> (daily by default) and prunes anything older than {BACKUP_KEEP_DAYS} days.
          To take one now, on the server: <code>./scripts/backup-db.sh</code>. There is no button here:
          dumps are made by <code>pg_dump</code>, which runs beside the database, not in the app.
        </p>
      </section>

      <section className="dc-card overflow-hidden">
        <div className="border-b border-[var(--line)] px-4 py-2.5">
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Snapshots</p>
        </div>
        {entries.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--ink-muted)]">No backups yet</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {entries.map((entry) => (
              <li key={entry.name} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="mono truncate text-[0.8125rem] font-semibold text-[var(--ink)]">{entry.name}</p>
                  <p className="text-[0.75rem] text-[var(--ink-muted)]">
                    {formatBytes(entry.bytes)} · {entry.createdAt.toLocaleString()}
                  </p>
                </div>
                <a
                  href={`/api/admin/backups/${entry.name}`}
                  className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
                >
                  Download
                </a>
                <form action={deleteBackupAction}>
                  <input type="hidden" name="name" value={entry.name} />
                  <ConfirmSubmitButton
                    message={`Delete backup ${entry.name}? This cannot be undone.`}
                    className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-left text-xs font-semibold text-red-600 transition hover:bg-red-500/10"
                  >
                    Delete
                  </ConfirmSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dc-card px-4 py-3">
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Restore</p>
        <p className="mt-1.5 text-[0.8125rem] text-[var(--ink-muted)]">
          Restores run from <code>scripts/restore-db.sh &lt;file&gt; --force</code> on the server. Restoring
          drops and recreates the live database, which cannot happen from a request the app itself is
          serving, so there is deliberately no restore button. The script checks the file is a
          <code> pg_dump</code> archive, takes a pre-restore dump of the current database, stops the app,
          restores, and starts it again — migrations then bring an older dump up to date.
        </p>
      </section>
    </div>
  );
}
