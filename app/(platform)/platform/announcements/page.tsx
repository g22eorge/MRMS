import { requirePlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { formatEATMediumDate } from "@/lib/date-eat";
import { createAnnouncementAction, toggleAnnouncementAction, deleteAnnouncementAction } from "./actions";

export const dynamic = "force-dynamic";

const LEVEL_CHIP: Record<string, string> = {
  INFO: "bg-sky-500/10 text-sky-700 border-sky-400/30 dark:text-sky-400",
  WARNING: "bg-amber-500/10 text-amber-700 border-amber-400/30 dark:text-amber-400",
  CRITICAL: "bg-red-500/10 text-red-700 border-red-400/30 dark:text-red-400",
};

export default async function PlatformAnnouncementsPage() {
  await requirePlatformAdmin();

  const announcements = await prisma.systemAnnouncement.findMany({ orderBy: { createdAt: "desc" } });
  const now = new Date();

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-lg font-black text-[var(--ink)]">System Announcements</h1>
        <p className="text-[13px] text-[var(--ink-muted)]">Published to a banner across every organization&rsquo;s workspace.</p>
      </div>

      {/* Publish form */}
      <form action={createAnnouncementAction} className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Publish new</p>
        <input name="title" required placeholder="Title" className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]/50" />
        <textarea name="body" required rows={3} placeholder="Message shown to all organizations…" className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]/50" />
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-[12px] text-[var(--ink-muted)]">
            Level
            <select name="level" defaultValue="INFO" className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[13px]">
              <option value="INFO">Info</option>
              <option value="WARNING">Warning</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>
          <label className="text-[12px] text-[var(--ink-muted)]">
            Starts (optional)
            <input type="datetime-local" name="startsAt" className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[13px]" />
          </label>
          <label className="text-[12px] text-[var(--ink-muted)]">
            Ends (optional)
            <input type="datetime-local" name="endsAt" className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[13px]" />
          </label>
        </div>
        <button type="submit" className="btn-premium rounded-lg px-4 py-2 text-[13px] text-white">Publish</button>
      </form>

      {/* List */}
      <div className="space-y-2">
        {announcements.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--line)] py-10 text-center text-[13px] text-[var(--ink-muted)]">No announcements yet.</p>
        ) : (
          announcements.map((a) => {
            const inWindow = (!a.startsAt || a.startsAt <= now) && (!a.endsAt || a.endsAt >= now);
            const live = a.isActive && inWindow;
            return (
              <div key={a.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${LEVEL_CHIP[a.level] ?? LEVEL_CHIP.INFO}`}>{a.level}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${live ? "bg-emerald-500/15 text-emerald-600" : "bg-[var(--panel-strong)] text-[var(--ink-muted)]"}`}>
                        {live ? "Live" : a.isActive ? "Scheduled/expired" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[14px] font-bold text-[var(--ink)]">{a.title}</p>
                    <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">{a.body}</p>
                    <p className="mt-1.5 text-[11px] text-[var(--ink-muted)]">
                      {formatEATMediumDate(a.createdAt)}
                      {a.startsAt ? ` · from ${formatEATMediumDate(a.startsAt)}` : ""}
                      {a.endsAt ? ` · until ${formatEATMediumDate(a.endsAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={toggleAnnouncementAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="isActive" value={String(a.isActive)} />
                      <button type="submit" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-semibold hover:bg-[var(--panel-strong)]">
                        {a.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                    <form action={deleteAnnouncementAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="rounded-lg border border-red-400/40 px-3 py-1.5 text-[12px] font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400">Delete</button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
