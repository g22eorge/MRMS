import Link from "next/link";

import { formatMoneyCompact } from "@/lib/currency";
import { monthLabel } from "@/lib/date-ranges";
import { routeLabel } from "@/lib/nav/registry";

import type { AdminDashboardData } from "./admin-data";

/** ADMIN left column: Cash received MTD + Financial position. */
export function AdminFinanceColumn({ data }: { data: AdminDashboardData }) {
  const {
    currency, today,
    repairsMtd, productsMtd, corporateMtd, totalMtd,
    bankAccounts, totalBankBalance,
    outstandingValue, outstandingCount,
    payablesValue, expensesValue, technicianPayoutsDue,
  } = data;

  return (
    <div className="flex h-full flex-col gap-4">

      {/* Cash received MTD */}
      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
          <p className="text-[13px] font-semibold text-[var(--ink)]">
            Cash received <span className="font-normal text-[var(--ink-muted)]">· {monthLabel(today.getFullYear(), today.getMonth() + 1)}</span>
          </p>
          <Link href="/reports" className="text-[12px] font-semibold text-[var(--accent)]">{routeLabel("/reports")} →</Link>
        </div>
        {/* Channels */}
        <div className="divide-y divide-[var(--line)]">
          {([
            { label: "Repairs",   value: repairsMtd,   pct: totalMtd > 0 ? Math.round(repairsMtd / totalMtd * 100) : 0,   bar: "bg-sky-500",     num: "text-sky-600",     href: "/jobs?status=COMPLETED" },
            { label: "Products",  value: productsMtd,  pct: totalMtd > 0 ? Math.round(productsMtd / totalMtd * 100) : 0,  bar: "bg-violet-500",  num: "text-violet-600",  href: "/pos" },
            { label: "Corporate", value: corporateMtd, pct: totalMtd > 0 ? Math.round(corporateMtd / totalMtd * 100) : 0, bar: "bg-emerald-500", num: "text-emerald-600", href: "/documents/invoices" },
          ] as const).map((s) => (
            <Link key={s.label} href={s.href} className="flex items-center gap-3 px-5 py-3 transition hover:bg-[var(--panel-strong)]">
              <span className={`h-2 w-2 shrink-0 rounded-full ${s.bar}`} />
              <p className="flex-1 text-[13px] text-[var(--ink-muted)]">{s.label}</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-[14px] font-bold tabular-nums ${s.num}`}>{formatMoneyCompact(s.value, currency)}</p>
                <p className="w-8 text-right text-[11px] text-[var(--ink-muted)]">{s.pct}%</p>
              </div>
            </Link>
          ))}
        </div>
        {/* Channel mix bar */}
        <div className="px-5 pb-4 pt-1">
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
            {[
              { w: totalMtd > 0 ? Math.round(repairsMtd / totalMtd * 100) : 33,   c: "bg-sky-500" },
              { w: totalMtd > 0 ? Math.round(productsMtd / totalMtd * 100) : 33,  c: "bg-violet-500" },
              { w: totalMtd > 0 ? Math.round(corporateMtd / totalMtd * 100) : 34, c: "bg-emerald-500" },
            ].map((seg, i) => <div key={i} className={`${seg.c} rounded-sm opacity-80`} style={{ width: `${seg.w}%` }} />)}
          </div>
        </div>
        {/* Total */}
        <Link href="/reports" className="flex items-center justify-between border-t border-[var(--line)] px-5 py-3 transition hover:bg-[var(--panel-strong)]">
          <p className="text-[12px] font-semibold text-[var(--ink)]">Cash received this month</p>
          <p className="text-[16px] font-bold tabular-nums text-[var(--accent)]">{formatMoneyCompact(totalMtd, currency)}</p>
        </Link>
      </section>

      {/* Financial position */}
      <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
          <p className="text-[13px] font-semibold text-[var(--ink)]">Financial position</p>
          <Link href="/reports" className="text-[12px] font-semibold text-[var(--accent)]">{routeLabel("/reports")} →</Link>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {([
            { dot: "bg-sky-500",     label: "Cash & bank",      sub: `${bankAccounts.length} account${bankAccounts.length !== 1 ? "s" : ""}`,                                    value: totalBankBalance,         tone: "text-[var(--ink)]",                                                   href: "/finance/bank" },
            { dot: "bg-amber-500",   label: "Receivables",      sub: `${outstandingCount} open`,                                                                                  value: outstandingValue,         tone: outstandingValue > 0 ? "text-amber-600" : "text-[var(--ink)]",         href: "/documents/invoices?status=ISSUED" },
            { dot: "bg-red-400",     label: "Payables",         sub: "to suppliers",                                                                                              value: payablesValue,            tone: payablesValue > 0 ? "text-red-500" : "text-[var(--ink)]",              href: "/inventory/supplier-bills?status=POSTED" },
            { dot: "bg-rose-500",    label: "Expenses MTD",     sub: null,                                                                                                        value: expensesValue,            tone: "text-red-600",                                                        href: "/finance/expenses" },
            { dot: "bg-emerald-500", label: "Gross margin",     sub: `${totalMtd > 0 ? Math.round((totalMtd - expensesValue) / totalMtd * 100) : 0}% margin`,                     value: totalMtd - expensesValue, tone: (totalMtd - expensesValue) >= 0 ? "text-emerald-600" : "text-red-500", href: "/reports" },
            { dot: "bg-amber-400",   label: "Tech payouts due", sub: technicianPayoutsDue > 0 ? "pending" : "all clear",                                                          value: technicianPayoutsDue,     tone: technicianPayoutsDue > 0 ? "text-amber-600" : "text-[var(--ink)]",     href: "/jobs?repairPath=EXTERNAL" },
          ] as const).map((item) => (
            <Link key={item.label} href={item.href} className="flex items-center gap-3 px-5 py-3 transition hover:bg-[var(--panel-strong)]">
              <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[var(--ink)]">{item.label}</p>
                {item.sub && <p className="text-[11px] text-[var(--ink-muted)]">{item.sub}</p>}
              </div>
              <p className={`shrink-0 text-[13px] font-bold tabular-nums ${item.tone}`}>{formatMoneyCompact(item.value, currency)}</p>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--ink-muted)]/30"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}

/** ADMIN bank accounts card — rendered in the bottom 2-col row next to the tech leaderboard. */
export function AdminBankAccounts({ data }: { data: AdminDashboardData }) {
  const { currency, bankAccounts } = data;
  const totalCash = bankAccounts.reduce((s, a) => s + a.currentBalance, 0);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
        <p className="text-[13px] font-semibold text-[var(--ink)]">Bank accounts</p>
        <Link href="/finance/bank" className="text-[12px] font-semibold text-[var(--accent)]">View →</Link>
      </div>
      {bankAccounts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ink-muted)]/40"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h2"/><path d="M12 15h5"/></svg>
          <p className="text-[12px] text-[var(--ink-muted)]">No bank accounts linked</p>
          <Link href="/finance/bank" className="text-[11px] font-semibold text-[var(--accent)] hover:underline">Add account →</Link>
        </div>
      ) : (
        <>
          <div className="flex-1 divide-y divide-[var(--line)]">
            {bankAccounts.map((acct) => {
              const pct = totalCash > 0 ? Math.round((acct.currentBalance / totalCash) * 100) : 0;
              const isPositive = acct.currentBalance >= 0;
              return (
                <Link key={acct.name} href="/finance/bank"
                  className="flex flex-col gap-1.5 px-5 py-3 transition hover:bg-[var(--panel-strong)]">
                  <div className="flex items-center justify-between">
                    <p className="max-w-[55%] truncate text-[13px] font-medium text-[var(--ink)]">{acct.name}</p>
                    <p className={`text-[13px] font-bold tabular-nums ${isPositive ? "text-[var(--ink)]" : "text-red-500"}`}>
                      {formatMoneyCompact(acct.currentBalance, currency)}
                    </p>
                  </div>
                  {/* Share-of-total bar */}
                  <div className="flex items-center gap-2">
                    <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--panel-strong)]">
                      <div className={`h-full rounded-full ${isPositive ? "bg-sky-500" : "bg-red-400"}`} style={{ width: `${Math.max(2, pct)}%` }} />
                    </div>
                    <span className="shrink-0 text-[11px] text-[var(--ink-muted)]">{pct}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
          {/* Total cash row */}
          <div className="flex items-center justify-between border-t border-[var(--line)] px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">Total cash</p>
            <p className={`text-[13px] font-bold tabular-nums ${totalCash >= 0 ? "text-sky-600" : "text-red-500"}`}>{formatMoneyCompact(totalCash, currency)}</p>
          </div>
        </>
      )}
    </section>
  );
}
