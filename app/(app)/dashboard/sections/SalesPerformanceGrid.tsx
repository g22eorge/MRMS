import Link from "next/link";

import { formatMoneyCompact } from "@/lib/currency";

export type SalesStaffRow = {
  name: string;
  repairRev: number;
  posRev: number;
  totalRev: number;
  jobCount: number;
  saleCount: number;
  target: number;
};

/** SALES dashboard lower grid: staff performance, revenue by channel, pending approvals. */
export function SalesPerformanceGrid({
  currency,
  periodKey,
  today,
  staffRows,
  myTargetRevenue,
  repairRevenueMtd,
  posRevenueMtd,
  invoiceRevenueMtd,
  totalRevenueMtd,
  wonMtd,
  salesCount,
  invoicesCount,
  quotedJobs,
  readyPickup,
}: {
  currency: string;
  periodKey: string;
  today: Date;
  staffRows: SalesStaffRow[];
  myTargetRevenue: number;
  repairRevenueMtd: number;
  posRevenueMtd: number;
  invoiceRevenueMtd: number;
  totalRevenueMtd: number;
  wonMtd: number;
  salesCount: number;
  invoicesCount: number;
  quotedJobs: Array<{ id: string; jobNumber: string; clientBill: number | null; client: { fullName: string } | null; receivedAt: Date }>;
  readyPickup: number;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {/* ── Individual staff performance ── */}
      <section className="dc-card px-3 py-2.5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[0.78125rem] font-bold tracking-[-0.01em] text-[var(--dc-ink)]">Staff Performance — {periodKey}</p>
          <Link href="/reports" className="text-[0.8125rem] font-semibold text-[var(--accent)] hover:underline">Full report →</Link>
        </div>
        {staffRows.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No sales activity this month yet.</p>
        ) : (
          <div className="space-y-2">
            {staffRows.map((s, i) => {
              const pct = s.target > 0 ? Math.min(100, Math.round((s.totalRev / s.target) * 100)) : null;
              return (
                <div key={s.name} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 text-[0.75rem] font-bold text-[var(--ink-muted)] w-4">{i + 1}</span>
                      <p className="truncate text-xs font-semibold text-[var(--ink)]">{s.name}</p>
                    </div>
                    <div className="ml-3 shrink-0 flex items-center gap-2">
                      {pct !== null && (
                        <span className={`text-[0.75rem] font-bold ${pct >= 100 ? "text-emerald-600" : pct >= 60 ? "text-[var(--accent)]" : "text-amber-600"}`}>{pct}%</span>
                      )}
                      <span className="text-xs font-bold text-[var(--ink)]">{formatMoneyCompact(s.totalRev, currency)}</span>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[0.75rem] text-[var(--ink-muted)]">
                    <span className="text-sky-600">{formatMoneyCompact(s.repairRev, currency)} repair</span>
                    <span className="text-[var(--accent)]">{formatMoneyCompact(s.posRev, currency)} POS</span>
                    {s.target > 0 && (
                      <>
                        <span>·</span>
                        <span>target {formatMoneyCompact(s.target, currency)}</span>
                      </>
                    )}
                  </div>
                  {pct !== null && (
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--line)]">
                      <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-[var(--accent)]"}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {/* My own target summary if viewer has a personal target */}
        {myTargetRevenue > 0 && (
          <div className="mt-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-3 py-2">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">My Target</p>
            <p className="mt-0.5 text-xs text-[var(--ink)]">{formatMoneyCompact(myTargetRevenue, currency)} this month</p>
          </div>
        )}
      </section>

      {/* ── Pending approvals + channel breakdown ── */}
      <div className="space-y-3">
        {/* Revenue by channel */}
        <section className="dc-card px-3 py-2.5">
          <p className="mb-3 text-[0.78125rem] font-bold tracking-[-0.01em] text-[var(--dc-ink)]">Revenue by Channel MTD</p>
          {[
            { label: "Repair Jobs",       amount: repairRevenueMtd,                    color: "bg-sky-500",    textColor: "text-sky-600",    count: `${wonMtd} completed` },
            { label: "POS Sales",         amount: posRevenueMtd,                       color: "bg-[var(--accent)]", textColor: "text-[var(--accent)]", count: `${salesCount} sales` },
            { label: "Invoice Payments",  amount: invoiceRevenueMtd,                   color: "bg-emerald-500",textColor: "text-emerald-600",count: `${invoicesCount} invoices` },
          ].map(ch => {
            const pct = totalRevenueMtd > 0 ? Math.round((ch.amount / totalRevenueMtd) * 100) : 0;
            return (
              <div key={ch.label} className="mb-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-[var(--ink)]">{ch.label}</span>
                  <span className={`font-bold ${ch.textColor}`}>{formatMoneyCompact(ch.amount, currency)} <span className="font-normal text-[var(--ink-muted)]">({pct}%)</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
                    <div className={`h-full rounded-full ${ch.color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="shrink-0 text-[0.75rem] text-[var(--ink-muted)]">{ch.count}</span>
                </div>
              </div>
            );
          })}
        </section>

        {/* Pending approvals */}
        <section className="dc-card px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[0.78125rem] font-bold tracking-[-0.01em] text-[var(--dc-ink)]">Pending Approvals</p>
            <Link href="/jobs?status=AWAITING_APPROVAL" className="text-[0.8125rem] font-semibold text-[var(--accent)] hover:underline">All →</Link>
          </div>
          {quotedJobs.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No quotes pending.</p>
          ) : (
            <div className="space-y-1.5">
              {quotedJobs.slice(0, 5).map(j => {
                const waitDays = Math.floor((today.getTime() - j.receivedAt.getTime()) / 86400000);
                return (
                  <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 transition hover:border-[var(--accent)]/35">
                    <div className="min-w-0">
                      <p className="mono truncate text-xs font-bold text-[var(--accent)]">{j.jobNumber}</p>
                      <p className="truncate text-[0.75rem] text-[var(--ink-muted)]">{j.client?.fullName ?? "—"}</p>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      {j.clientBill && <p className="text-xs font-semibold text-[var(--ink)]">{formatMoneyCompact(j.clientBill, currency)}</p>}
                      <span className={`text-[0.75rem] font-medium ${waitDays > 3 ? "text-amber-600" : "text-[var(--ink-muted)]"}`}>{waitDays}d wait</span>
                    </div>
                  </Link>
                );
              })}
              {readyPickup > 0 && (
                <Link href="/jobs?status=READY_FOR_PICKUP" className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 transition hover:border-emerald-500/50">
                  <p className="text-xs font-semibold text-emerald-600">{readyPickup} jobs ready for pickup</p>
                  <span className="text-[0.8125rem] font-bold text-emerald-600">→</span>
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
