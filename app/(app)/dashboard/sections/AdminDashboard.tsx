import Link from "next/link";
import React from "react";

import { MobileHomeDashboard } from "@/components/mobile/MobileHomeDashboard";
import { formatMoneyCompact } from "@/lib/currency";
import { routeLabel } from "@/lib/nav/registry";
import { can } from "@/lib/permissions";

import { loadAdminDashboardData } from "./admin-data";
import { AdminActionColumn, AdminNeedsAction } from "./AdminActionColumn";
import { AdminBankAccounts, AdminFinanceColumn } from "./AdminFinanceColumn";
import { AdminOpsColumn } from "./AdminOpsColumn";
import { AdminTechLeaderboard } from "./AdminTechLeaderboard";
import type { PermissionUser } from "./shared";

export async function AdminDashboard({
  userName,
  orgId,
  permissionUser,
}: {
  userName: string;
  orgId: string | null;
  permissionUser: PermissionUser;
}) {
  const data = await loadAdminDashboardData(orgId);
  const {
    currency, orgName, enabledModules,
    receivedToday, completedToday, receivedYesterday, completedYesterday,
    intakePendingCount, cashTodayValue, cashYesterdayValue, salesTodayValue,
    revenueTodayValue, expensesTodayValue, expensesYesterdayValue,
    outstandingValue, completedUnpaidCount, awaitingApprovalCount,
    overdueJobsCount, inRepairCount, readyForPickupCount, statusCount, totalMtd,
  } = data;

  const quickActions = [
    can.createJob(permissionUser) && enabledModules.has("JOBS") && {
      href: "/jobs/new",
      label: routeLabel("/jobs/new"),
      bg: "bg-[var(--accent)]",
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    },
    can.viewFinancials(permissionUser) && enabledModules.has("INVOICING") && {
      href: "/documents/receipts",
      label: routeLabel("/documents/receipts"),
      bg: "bg-emerald-500/15",
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    },
    can.openPosSession(permissionUser) && enabledModules.has("POS") && {
      href: "/pos",
      label: routeLabel("/pos"),
      bg: "bg-violet-500/15",
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
    },
    can.viewFinancials(permissionUser) && enabledModules.has("INVOICING") && {
      href: "/documents/invoices",
      label: routeLabel("/documents/invoices"),
      bg: "bg-amber-500/15",
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    },
  ].filter(Boolean) as React.ComponentProps<typeof MobileHomeDashboard>["quickActions"];

  return (
    <div className="space-y-5">

      {/* ── Mobile home screen (Airtel Money-inspired, hidden on desktop) ── */}
      <MobileHomeDashboard
        userName={userName}
        orgName={orgName ?? "Dduuka ProMax"}
        receivedToday={receivedToday}
        completedToday={completedToday}
        inRepairCount={inRepairCount}
        readyForPickupCount={readyForPickupCount}
        awaitingApprovalCount={awaitingApprovalCount}
        receivedCount={statusCount.get("RECEIVED") ?? 0}
        overdueCount={overdueJobsCount}
        completedUnpaidCount={completedUnpaidCount}
        cashTodayValue={cashTodayValue}
        cashYesterdayValue={cashYesterdayValue}
        salesTodayValue={salesTodayValue}
        revenueTodayValue={revenueTodayValue}
        outstandingValue={outstandingValue}
        revenueMtd={totalMtd}
        currency={currency}
        quickActions={quickActions}
      />

      {/* ── Desktop dashboard starts here (hidden on mobile) ── */}

      {/* ── a. Action chips — the single quick-actions surface ── */}
      <div className="hidden lg:flex items-center gap-2">
        <Link href="/jobs/new" className="btn-premium inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold">
          + {routeLabel("/jobs/new")}
        </Link>
        {[
          { href: "/documents/receipts?new=1", label: "Record Payment" },
          { href: "/intake",                   label: routeLabel("/intake") },
          { href: "/pos",                      label: routeLabel("/pos") },
          { href: "/finance/expenses",         label: routeLabel("/finance/expenses") },
          { href: "/reports",                  label: routeLabel("/reports") },
        ].map((a) => (
          <Link key={a.href} href={a.href}
            className="inline-flex items-center rounded-lg border border-[var(--line)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--ink-muted)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
            {a.label}
          </Link>
        ))}
      </div>

      {/* ── b. Today at a glance — 6 flat KPI cards ── */}
      <div className="hidden lg:grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {([
          { label: "Jobs In",      value: String(receivedToday),                            delta: `${receivedYesterday} yesterday`,                          href: "/jobs?status=RECEIVED",             tone: "text-[var(--ink)]" },
          { label: "Completed",    value: String(completedToday),                           delta: `${completedYesterday} yesterday`,                         href: "/jobs?status=COMPLETED",            tone: "text-emerald-600" },
          { label: "Intake Queue", value: String(intakePendingCount),                       delta: intakePendingCount > 0 ? "Action needed" : "Queue clear",  href: "/intake",                           tone: intakePendingCount > 0 ? "text-orange-500" : "text-[var(--ink-muted)]" },
          { label: "Cash Today",   value: formatMoneyCompact(cashTodayValue, currency),     delta: `${formatMoneyCompact(cashYesterdayValue, currency)} yesterday`,     href: "/documents/receipts",     tone: "text-violet-600" },
          { label: "Expenses",     value: formatMoneyCompact(expensesTodayValue, currency), delta: `${formatMoneyCompact(expensesYesterdayValue, currency)} yesterday`, href: "/finance/expenses",       tone: expensesTodayValue > 0 ? "text-red-500" : "text-[var(--ink-muted)]" },
          { label: "Balances Due", value: formatMoneyCompact(outstandingValue, currency),   delta: `${completedUnpaidCount} unpaid`,                          href: "/documents/invoices?status=ISSUED", tone: outstandingValue > 0 ? "text-amber-600" : "text-[var(--ink-muted)]" },
        ] as const).map((kpi) => (
          <Link key={kpi.label} href={kpi.href}
            className="flex flex-col gap-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4 transition hover:border-[var(--accent)]/40 hover:bg-[var(--panel-strong)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">{kpi.label}</p>
            <p className={`text-[20px] font-bold leading-tight tabular-nums ${kpi.tone}`}>{kpi.value}</p>
            <p className="text-[11px] text-[var(--ink-muted)]">{kpi.delta}</p>
          </Link>
        ))}
      </div>

      {/* ── c. Needs action — the key-actions card, full width ── */}
      <AdminNeedsAction data={data} />

      {/* ── d. Main 3-column grid — Finance | Pipeline + Trend | Funnel + Inventory ── */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        <AdminFinanceColumn data={data} />
        <AdminActionColumn data={data} />
        <AdminOpsColumn data={data} />
      </div>

      {/* ── e. Bank accounts + Technician leaderboard ── */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <AdminBankAccounts data={data} />
        <AdminTechLeaderboard data={data} />
      </div>

    </div>
  );
}
