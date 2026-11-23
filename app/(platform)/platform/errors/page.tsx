import { formatEATDateTime } from "@/lib/date-eat";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

/**
 * Server errors from the last seven days, most frequent first. Each line is
 * one distinct failure in one place, with how many times it happened and when
 * it last did. Open a line for the stack trace.
 */
export default async function PlatformErrorsPage() {
  await requirePlatformAdmin();
  const since = new Date(Date.now() - 7 * 86_400_000);

  const rows = await prisma.errorEvent
    .groupBy({
      by: ["fingerprint"],
      where: { lastSeenAt: { gte: since } },
      _sum: { count: true },
      _max: { lastSeenAt: true },
      _min: { firstSeenAt: true },
      orderBy: { _sum: { count: "desc" } },
      take: 100,
    })
    .catch(() => []);

  const latest = rows.length
    ? await prisma.errorEvent.findMany({
        where: { fingerprint: { in: rows.map((r) => r.fingerprint) }, lastSeenAt: { gte: since } },
        orderBy: { lastSeenAt: "desc" },
        select: { fingerprint: true, message: true, stack: true, route: true, path: true, method: true, kind: true },
      })
    : [];
  const sample = new Map<string, (typeof latest)[number]>();
  for (const event of latest) if (!sample.has(event.fingerprint)) sample.set(event.fingerprint, event);

  const total = rows.reduce((sum, row) => sum + (row._sum.count ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[var(--ink)]">Errors</h1>
        <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
          {rows.length === 0 ? "Nothing has failed in the last 7 days." : `${total} in the last 7 days, across ${rows.length} distinct ${rows.length === 1 ? "error" : "errors"}.`}
        </p>
      </div>

      {rows.length > 0 ? (
        <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          {rows.map((row) => {
            const event = sample.get(row.fingerprint);
            return (
              <li key={row.fingerprint}>
                <details>
                  <summary className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-[var(--panel-strong)]">
                    <span className="mt-0.5 w-12 shrink-0 text-right text-sm font-bold tabular-nums text-[var(--ink)]">{row._sum.count ?? 0}×</span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-semibold text-[var(--ink)]">{event?.message ?? "Unknown error"}</span>
                      <span className="block truncate text-[0.75rem] text-[var(--ink-muted)]">
                        {[event?.method, event?.route ?? event?.path, event?.kind].filter(Boolean).join(" · ") || "No route recorded"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[0.75rem] text-[var(--ink-muted)]">
                      last {row._max.lastSeenAt ? formatEATDateTime(row._max.lastSeenAt) : "—"}
                    </span>
                  </summary>
                  <div className="space-y-2 border-t border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3 text-[0.75rem] text-[var(--ink-muted)]">
                    <p>First seen {row._min.firstSeenAt ? formatEATDateTime(row._min.firstSeenAt) : "—"}{event?.path ? ` · ${event.path}` : ""}</p>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 text-[0.6875rem] leading-relaxed text-[var(--ink)]">{event?.stack ?? "No stack trace recorded."}</pre>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
