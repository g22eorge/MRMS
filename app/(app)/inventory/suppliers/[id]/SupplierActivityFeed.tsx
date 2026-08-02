"use client";

import { useState } from "react";
import Link from "next/link";

import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";

export type SupplierActivityItem = {
  key: string;
  type: "PO" | "BILL" | "REQUEST" | "GRN";
  label: string;
  href: string;
  dateMs: number;
  dateLabel: string;
  status: string;
  tone: BadgeTone;
  amount?: string;
  sub?: string;
};

type Filter = "ALL" | "PO" | "BILL" | "REQUEST" | "GRN";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PO", label: "POs" },
  { key: "BILL", label: "Bills" },
  { key: "REQUEST", label: "Requests" },
  { key: "GRN", label: "Goods received" },
];

/**
 * One unified activity feed for a supplier — replaces the four stacked tables
 * (POs, bills, requests, GRNs) with a single time-ordered list you filter by
 * type. Lead with the two real actions; everything else is history.
 */
export function SupplierActivityFeed({
  items,
  newPoHref,
  newBillHref,
}: {
  items: SupplierActivityItem[];
  newPoHref: string;
  newBillHref: string;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const counts = items.reduce(
    (acc, item) => ((acc[item.type] = (acc[item.type] ?? 0) + 1), acc),
    {} as Record<string, number>,
  );
  const visible = filter === "ALL" ? items : items.filter((item) => item.type === filter);

  return (
    <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">History ({items.length})</p>
        <div className="flex gap-1.5">
          <Link href={newPoHref} className="rounded-md bg-[var(--gold)]/15 px-3 py-1 text-xs font-semibold text-[var(--gold)] hover:bg-[var(--gold)]/25">New PO</Link>
          <Link href={newBillHref} className="rounded-md bg-[var(--gold)]/15 px-3 py-1 text-xs font-semibold text-[var(--gold)] hover:bg-[var(--gold)]/25">New Bill</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-[var(--line)] px-4 py-2">
        {FILTERS.map(({ key, label }) => {
          const count = key === "ALL" ? items.length : counts[key] ?? 0;
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--accent)]/30 hover:text-[var(--ink)]"
              }`}
            >
              {label} <span className="tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-[var(--ink-muted)]">No activity in this view yet.</p>
      ) : (
        <div className="divide-y divide-[var(--line)]">
          {visible.map((item) => (
            <Link key={item.key} href={item.href} className="flex items-center justify-between gap-3 px-4 py-2.5 transition hover:bg-[var(--panel-strong)]/40">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[var(--panel-strong)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">{item.type}</span>
                  <span className="mono truncate text-[13px] font-semibold text-[var(--ink)]">{item.label}</span>
                </div>
                <p className="mt-0.5 truncate text-[12px] text-[var(--ink-muted)]">{item.dateLabel}{item.sub ? ` · ${item.sub}` : ""}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.amount ? <span className="text-[13px] font-bold tabular-nums text-[var(--ink)]">{item.amount}</span> : null}
                <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
