import Link from "next/link";
import type { ReactNode } from "react";

import type { BadgeTone } from "@/components/ui/StatusBadge";
import { clientContactName, clientDisplayName } from "@/lib/client-name";

export type SummaryRow = { label: string; value: ReactNode };
export type RelatedDoc = { label: string; href?: string; sub?: string; tone?: BadgeTone };
export type ActivityItem = { label: string; at: string; tone?: BadgeTone };

/** A generic "counterparty" card — client, supplier, technician, lead, etc. */
export type PartyBlock = {
  /** Card heading. Defaults to "Client". */
  title?: string;
  name: string;
  org?: string | null;
  /** Extra lines (phone, email, address, …); nullish entries are skipped. */
  lines?: (string | null | undefined)[];
};

/** Legacy client shape kept so document pages keep passing `client=`. */
export type ClientBlock = {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  organization?: string | null;
  address?: string | null;
};

/**
 * RecordSummaryRail — the right-hand rail of any record detail page. Leads with
 * the one figure that matters (balance due / total), then key facts, the
 * counterparty, related documents, and an activity trail. Gives every record
 * type a consistent "at a glance" column. (Documents import it as
 * `DocumentSummaryRail`; pass `client=` or the generic `party=`.)
 */
export function RecordSummaryRail({
  headline,
  rows,
  party,
  client,
  related,
  activity,
}: {
  headline: { label: string; value: string; tone?: "ink" | "good" | "warn" | "crit" };
  rows: SummaryRow[];
  party?: PartyBlock | null;
  client?: ClientBlock | null;
  related?: RelatedDoc[];
  activity?: ActivityItem[];
}) {
  const resolvedParty: PartyBlock | null =
    party ??
    (client
      ? {
          title: "Client",
          name: clientDisplayName(client),
          org: clientContactName(client),
          lines: [client.phone, client.email, client.address],
        }
      : null);
  const partyLines = (resolvedParty?.lines ?? []).filter((l): l is string => Boolean(l && l.trim()));

  const headlineColor =
    headline.tone === "good"
      ? "text-[var(--dc-good,#2f8f5f)]"
      : headline.tone === "warn"
        ? "text-[var(--dc-warn,#c08419)]"
        : headline.tone === "crit"
          ? "text-[var(--dc-crit,#c0503f)]"
          : "text-[var(--ink)]";

  return (
    <aside className="flex flex-col gap-4 lg:order-first">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="text-[0.65625rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
          {headline.label}
        </p>
        <p className={`mt-1 break-words text-[1.5rem] font-black leading-none tracking-[-0.02em] tabular-nums ${headlineColor}`}>
          {headline.value}
        </p>
      </div>

      {rows.length > 0 && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-[0.65625rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Details</p>
          <dl className="flex flex-col gap-1.5">
            {rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-3 text-[0.78125rem]">
                <dt className="text-[var(--ink-muted)]">{r.label}</dt>
                <dd className="text-right font-medium tabular-nums">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {resolvedParty && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-[0.65625rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
            {resolvedParty.title ?? "Client"}
          </p>
          <p className="text-[0.8125rem] font-semibold">{resolvedParty.name}</p>
          {resolvedParty.org ? <p className="text-[0.75rem] text-[var(--ink-muted)]">{resolvedParty.org}</p> : null}
          {partyLines.length > 0 && (
            <div className="mt-2 flex flex-col gap-0.5 text-[0.75rem] text-[var(--ink-muted)]">
              {partyLines.map((line, i) => (
                <span key={i} className="whitespace-pre-wrap break-all">{line}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {related && related.length > 0 && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-[0.65625rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Related documents</p>
          <div className="flex flex-col gap-2">
            {related.map((d, i) => {
              const inner = (
                <span className="flex items-center gap-2 text-[0.78125rem]">
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
          <p className="mb-3 text-[0.65625rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Activity</p>
          <ol className="flex flex-col gap-3">
            {activity.map((a, i) => (
              <li key={`${a.label}-${i}`} className="grid grid-cols-[10px_1fr] gap-2 text-[0.75rem]">
                <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent,#b8892b)]" aria-hidden="true" />
                <span>
                  <span className="font-semibold">{a.label}</span>
                  <span className="block text-[0.6875rem] text-[var(--ink-muted)]">{a.at}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
}
