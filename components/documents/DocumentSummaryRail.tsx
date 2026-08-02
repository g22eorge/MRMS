import Link from "next/link";
import type { ReactNode } from "react";

import type { BadgeTone } from "@/components/ui/StatusBadge";

export type SummaryRow = { label: string; value: ReactNode };
export type RelatedDoc = { label: string; href?: string; sub?: string; tone?: BadgeTone };
export type ActivityItem = { label: string; at: string; tone?: BadgeTone };

/**
 * DocumentSummaryRail — the right-hand rail of a document detail page. Leads with
 * the one figure that matters (balance due / total), then the key facts, the
 * client, related documents, and an activity trail. Gives every document type a
 * consistent "at a glance" column instead of a truncated KPI strip.
 */
export function DocumentSummaryRail({
  headline,
  rows,
  client,
  related,
  activity,
}: {
  headline: { label: string; value: string; tone?: "ink" | "good" | "warn" | "crit" };
  rows: SummaryRow[];
  client?: { fullName: string; phone?: string | null; email?: string | null; organization?: string | null; address?: string | null } | null;
  related?: RelatedDoc[];
  activity?: ActivityItem[];
}) {
  const headlineColor =
    headline.tone === "good"
      ? "text-[var(--dc-good,#2f8f5f)]"
      : headline.tone === "warn"
        ? "text-[var(--dc-warn,#c08419)]"
        : headline.tone === "crit"
          ? "text-[var(--dc-crit,#c0503f)]"
          : "text-[var(--ink)]";

  return (
    <aside className="flex flex-col gap-4">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
          {headline.label}
        </p>
        <p className={`mt-1 break-words text-[24px] font-black leading-none tracking-[-0.02em] tabular-nums ${headlineColor}`}>
          {headline.value}
        </p>
      </div>

      {rows.length > 0 && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Details</p>
          <dl className="flex flex-col gap-1.5">
            {rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <dt className="text-[var(--ink-muted)]">{r.label}</dt>
                <dd className="text-right font-medium tabular-nums">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {client && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Client</p>
          <p className="text-[13px] font-semibold">{client.fullName}</p>
          {client.organization ? <p className="text-[12px] text-[var(--ink-muted)]">{client.organization}</p> : null}
          <div className="mt-2 flex flex-col gap-0.5 text-[12px] text-[var(--ink-muted)]">
            {client.phone ? <span>{client.phone}</span> : null}
            {client.email ? <span className="break-all">{client.email}</span> : null}
            {client.address ? <span className="whitespace-pre-wrap">{client.address}</span> : null}
          </div>
        </div>
      )}

      {related && related.length > 0 && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Related documents</p>
          <div className="flex flex-col gap-2">
            {related.map((d, i) => {
              const inner = (
                <span className="flex items-center gap-2 text-[12.5px]">
                  <span className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--accent,#b8892b)]" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="mono font-medium">{d.label}</span>
                    {d.sub ? <span className="text-[var(--ink-muted)]"> · {d.sub}</span> : null}
                  </span>
                </span>
              );
              return d.href ? (
                <Link key={`${d.label}-${i}`} href={d.href} className="hover:opacity-80">{inner}</Link>
              ) : (
                <div key={`${d.label}-${i}`}>{inner}</div>
              );
            })}
          </div>
        </div>
      )}

      {activity && activity.length > 0 && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Activity</p>
          <ol className="flex flex-col gap-3">
            {activity.map((a, i) => (
              <li key={`${a.label}-${i}`} className="grid grid-cols-[10px_1fr] gap-2 text-[12px]">
                <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent,#b8892b)]" aria-hidden="true" />
                <span>
                  <span className="font-semibold">{a.label}</span>
                  <span className="block text-[11px] text-[var(--ink-muted)]">{a.at}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
}
