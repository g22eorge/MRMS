import Link from "next/link";

import { StatStrip } from "@/components/ui/StatStrip";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { COMMUNICATIONS_ROUTES } from "@/lib/communications/routes";
import { formatMoneyCompact } from "@/lib/currency";
import { routeLabel } from "@/lib/nav/registry";

import type { AdminDashboardData } from "./admin-data";

/** ADMIN "Needs action" — the key-actions card, rendered full width above the grid. */
export function AdminNeedsAction({ data }: { data: AdminDashboardData }) {
  const {
    awaitingApprovalCount, readyForPickupCount, overdueJobsCount,
    completedUnpaidCount, jobsNoClientUpdateCount, failedOutboxCount,
  } = data;

  const items = [
    { label: "Awaiting approval", count: awaitingApprovalCount,   href: "/jobs?status=AWAITING_APPROVAL", tone: "text-[var(--accent)]" },
    { label: "Ready for pickup",  count: readyForPickupCount,     href: "/jobs?status=READY_FOR_PICKUP",  tone: "text-emerald-600" },
    { label: "Overdue",           count: overdueJobsCount,        href: "/jobs?status=RECEIVED,DIAGNOSING,REFERRED,IN_EXTERNAL_REPAIR,AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP", tone: "text-red-500" },
    { label: "Completed unpaid",  count: completedUnpaidCount,    href: "/jobs?status=COMPLETED",         tone: "text-amber-600" },
    { label: "No client update",  count: jobsNoClientUpdateCount, href: "/jobs",                          tone: "text-[var(--ink)]" },
    { label: "Failed messages",   count: failedOutboxCount,       href: COMMUNICATIONS_ROUTES.outbox,     tone: "text-red-500" },
  ] as const;
  const openTotal = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <p className="text-[13px] font-semibold text-[var(--ink)]">Needs action</p>
          <StatusBadge tone={openTotal > 0 ? "warning" : "success"} dot>
            {openTotal > 0 ? `${openTotal} open` : "All clear"}
          </StatusBadge>
        </div>
        <Link href="/jobs" className="text-[12px] font-semibold text-[var(--accent)]">{routeLabel("/jobs")} →</Link>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link key={item.label} href={item.href}
            className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-[var(--panel-strong)]">
            <p className="text-[13px] text-[var(--ink)]">{item.label}</p>
            <p className={`text-[18px] font-bold leading-none tabular-nums ${item.count > 0 ? item.tone : "text-[var(--ink-muted)]/40"}`}>
              {item.count}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** ADMIN centre column: Repair pipeline + Revenue trend. */
export function AdminActionColumn({ data }: { data: AdminDashboardData }) {
  const { currency, today, conversionRate, statusData, revenueTrend } = data;

  return (
    <div className="flex h-full flex-col gap-4">

      {/* Repair Pipeline */}
      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
          <p className="text-[13px] font-semibold text-[var(--ink)]">
            Repair pipeline
            {conversionRate > 0 && <span className="ml-1.5 text-[12px] font-normal text-[var(--ink-muted)]">· {conversionRate}% conv.</span>}
          </p>
          <Link href="/jobs" className="text-[12px] font-semibold text-[var(--accent)]">View →</Link>
        </div>
        {(() => {
          const STAGES = [
            { key: "RECEIVED",          name: "Received",   tone: (v: number) => v > 0 ? "text-sky-600"         : "text-[var(--ink-muted)]/40" },
            { key: "DIAGNOSING",        name: "Diagnosing", tone: (v: number) => v > 0 ? "text-blue-600"        : "text-[var(--ink-muted)]/40" },
            { key: "AWAITING_APPROVAL", name: "Awaiting",   tone: (v: number) => v > 0 ? "text-[var(--accent)]" : "text-[var(--ink-muted)]/40" },
            { key: "IN_REPAIR",         name: "In repair",  tone: (v: number) => v > 0 ? "text-violet-600"      : "text-[var(--ink-muted)]/40" },
            { key: "READY_FOR_PICKUP",  name: "Ready",      tone: (v: number) => v > 0 ? "text-emerald-600"     : "text-[var(--ink-muted)]/40" },
            { key: "COMPLETED",         name: "Completed",  tone: (v: number) => v > 0 ? "text-emerald-600"     : "text-[var(--ink-muted)]/40" },
          ] as const;
          return (
            <div className="grid grid-cols-3 gap-1 p-2">
              {STAGES.map(({ key, name, tone }) => {
                const count = statusData.find(s => s.key === key)?.value ?? 0;
                return (
                  <Link key={key} href={`/jobs?status=${key}`}
                    className="flex flex-col items-center gap-1 rounded-lg py-4 transition hover:bg-[var(--panel-strong)]">
                    <p className={`text-[22px] font-bold leading-none tabular-nums ${tone(count)}`}>{count}</p>
                    <p className="text-[11px] text-[var(--ink-muted)]">{name}</p>
                  </Link>
                );
              })}
            </div>
          );
        })()}
      </section>

      {/* Revenue trend — full Jan-Dec, fixed-height rows */}
      {(() => {
        const year = today.getFullYear();
        const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const full12 = MON.map((label, idx) => {
          const key = `${year}-${String(idx + 1).padStart(2, "0")}`;
          const found = revenueTrend.find(m => m.key === key);
          return { label, key, revenue: found?.revenue ?? 0, margin: found?.margin ?? 0, future: !found };
        });
        const maxRev    = Math.max(...full12.map(m => m.revenue), 1);
        const ytdTotal  = full12.reduce((s, m) => s + m.revenue, 0);
        const ytdMargin = full12.reduce((s, m) => s + m.margin,  0);
        const peakIdx   = full12.reduce((b, m, i) => m.revenue > full12[b].revenue ? i : b, 0);
        if (ytdTotal === 0) return null;
        return (
          <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
              <p className="text-[13px] font-semibold text-[var(--ink)]">
                Revenue trend <span className="font-normal text-[var(--ink-muted)]">· {year}</span>
              </p>
              <Link href="/reports" className="text-[12px] font-semibold text-[var(--accent)]">{routeLabel("/reports")} →</Link>
            </div>
            {/* YTD summary */}
            <div className="border-b border-[var(--line)]">
              <StatStrip
                columns={2}
                tiles={[
                  { label: "YTD Revenue", value: formatMoneyCompact(ytdTotal, currency), accent: true },
                  { label: "YTD Margin",  value: formatMoneyCompact(ytdMargin, currency), valueClass: ytdMargin >= 0 ? "text-emerald-600" : "text-red-500" },
                ]}
              />
            </div>
            {/* Col headings */}
            <div className="grid grid-cols-[2rem_1fr_2.75rem] items-center gap-x-2 border-b border-[var(--line)] px-5 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Mo</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Rev · Margin</span>
              <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Mg%</span>
            </div>
            {/* 12 rows */}
            <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {full12.map((m, i) => {
                const isPeak  = i === peakIdx;
                const barPct  = Math.round((m.revenue / maxRev) * 100);
                const mrgPct  = m.revenue > 0 ? Math.round((m.margin / m.revenue) * 100) : null;
                return (
                  <div key={m.key}
                    className={`grid grid-cols-[2rem_1fr_2.75rem] items-center gap-x-2 px-5 py-2 ${i < 11 ? "border-b border-[var(--line)]" : ""}`}>
                    {/* Month */}
                    <span className={`text-[11px] font-semibold ${isPeak ? "text-[var(--accent)]" : m.future ? "text-[var(--ink-muted)]/40" : "text-[var(--ink-muted)]"}`}>{m.label}</span>
                    {/* Revenue + margin + bar */}
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-[12px] font-bold tabular-nums leading-none ${isPeak ? "text-[var(--accent)]" : m.future ? "text-[var(--ink-muted)]/40" : "text-[var(--ink)]"}`}>
                          {m.revenue > 0 ? formatMoneyCompact(m.revenue, currency) : "—"}
                        </span>
                        {m.margin !== 0 && (
                          <span className={`text-[11px] tabular-nums leading-none ${m.margin >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {formatMoneyCompact(m.margin, currency)}
                          </span>
                        )}
                      </div>
                      {/* Dual stacked bar: revenue (accent) + margin (emerald) overlay */}
                      <div className="relative h-[3px] overflow-hidden rounded-full bg-[var(--panel-strong)]">
                        <div className={`absolute inset-y-0 left-0 rounded-full ${isPeak ? "bg-[var(--accent)]" : "bg-[var(--accent)]/35"}`} style={{ width: `${barPct}%` }} />
                        {m.revenue > 0 && m.margin > 0 && (
                          <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/60" style={{ width: `${Math.round((m.margin / maxRev) * 100)}%` }} />
                        )}
                      </div>
                    </div>
                    {/* Margin % */}
                    <span className={`text-right text-[11px] font-semibold tabular-nums ${mrgPct === null ? "text-[var(--ink-muted)]/30" : mrgPct >= 0 ? "text-emerald-600" : "text-red-400"}`}>
                      {mrgPct !== null ? `${mrgPct}%` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

    </div>
  );
}
