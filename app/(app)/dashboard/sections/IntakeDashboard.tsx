import Link from "next/link";

import { monthLabel, monthRange, yearRange } from "@/lib/date-ranges";
import { JobStatus } from "@/lib/job-status";
import { filterSupportedJobStatuses } from "@/lib/job-status-server";
import { routeLabel } from "@/lib/nav/registry";
import { prisma } from "@/lib/prisma";

import { monthOptions, parseMonth, yearOptions, type PeriodFilters } from "./data";
import { DashboardHero, DashboardPeriodBar, RepairStatusReference } from "./shared";

/** FRONT_DESK / INTAKE dashboard. */
export async function IntakeDashboard({
  userId,
  orgId,
  period,
  filters,
}: {
  userId: string;
  orgId: string;
  period: "month" | "year";
  filters: PeriodFilters;
}) {
  const selectedMonth = parseMonth(filters.month);
  const selectedYear = Number(filters.year) || new Date().getFullYear();
  const selectedRange = period === "year" ? yearRange(selectedYear) : monthRange(selectedMonth.year, selectedMonth.month);
  const selectedPeriodLabel = period === "year" ? String(selectedYear) : monthLabel(selectedMonth.year, selectedMonth.month);
  const selectablePeriods = period === "year" ? yearOptions(6) : monthOptions(18);

  const [capturedThisMonth, openFromIntake, awaitingApproval, readyForPickup] = await Promise.all([
    prisma.job.count({
      where: {
        createdById: userId,
        receivedAt: { gte: selectedRange.start, lte: selectedRange.end },
      },
    }),
    prisma.job.count({
      where: {
        createdById: userId,
        status: { in: filterSupportedJobStatuses(["RECEIVED", "DIAGNOSING", "REFERRED", "IN_EXTERNAL_REPAIR", "AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"]) as JobStatus[] },
      },
    }),
    prisma.job.count({ where: { orgId, status: "AWAITING_APPROVAL" } }),
    prisma.job.count({ where: { orgId, status: "READY_FOR_PICKUP" } }),
  ]);

  return (
    <div className="space-y-4">
      <DashboardPeriodBar
        period={period}
        monthHref={`/dashboard?period=month&month=${monthLabel(new Date().getFullYear(), new Date().getMonth() + 1)}`}
        yearHref={`/dashboard?period=year&year=${new Date().getFullYear()}`}
        selectorName={period === "year" ? "year" : "month"}
        selectorValue={selectedPeriodLabel}
        selectorOptions={selectablePeriods}
      />

      <DashboardHero
        title="Client Intake Console"
        summary="Capture requests quickly and move each intake through approval to handover."
        primaryHref="/jobs/new"
        primaryLabel={routeLabel("/jobs/new")}
        secondaryHref="/jobs?status=AWAITING_APPROVAL"
        secondaryLabel="Open Approval Queue"
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>}
      />

      <div className="hidden 2xl:block">
        <RepairStatusReference
          title="Intake to Delivery Flow"
          guidance="Keep this sequence in view when briefing clients so status updates are clear and consistent."
        />
      </div>

      {/* Compact inline KPI strip — replaces 2×2 mobile card grid */}
      <div className="panel-shadow grid grid-cols-4 divide-x divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] lg:hidden">
        {[
          { label: "Captured",  value: capturedThisMonth, href: "/jobs/new",                                                                          color: "text-[var(--ink)]" },
          { label: "Open",      value: openFromIntake,    href: "/jobs?status=RECEIVED,DIAGNOSING,AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP",       color: "text-[var(--accent)]" },
          { label: "Approval",  value: awaitingApproval,  href: "/jobs?status=AWAITING_APPROVAL",                                                      color: awaitingApproval > 0 ? "text-amber-500" : "text-[var(--ink-muted)]" },
          { label: "Ready",     value: readyForPickup,    href: "/jobs?status=READY_FOR_PICKUP",                                                       color: readyForPickup > 0 ? "text-[var(--accent)]" : "text-[var(--ink-muted)]" },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="flex flex-col items-center justify-center gap-0.5 py-3 transition hover:bg-[var(--panel-strong)]">
            <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[13px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">{item.label}</p>
          </Link>
        ))}
      </div>

      {/* Compact 4-stat strip for desktop */}
      <div className="panel-shadow hidden grid-cols-4 divide-x divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] lg:grid">
        {[
          { label: `Captured (${selectedPeriodLabel})`, value: capturedThisMonth, href: "/jobs/new",                                                                          color: "text-[var(--ink)]" },
          { label: "Open queue",                        value: openFromIntake,    href: "/jobs?status=RECEIVED,DIAGNOSING,AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP",       color: "text-[var(--accent)]" },
          { label: "Awaiting approval",                 value: awaitingApproval,  href: "/jobs?status=AWAITING_APPROVAL",                                                      color: awaitingApproval > 0 ? "text-amber-500" : "text-[var(--ink-muted)]" },
          { label: "Ready for pickup",                  value: readyForPickup,    href: "/jobs?status=READY_FOR_PICKUP",                                                       color: readyForPickup > 0 ? "text-[var(--accent)]" : "text-[var(--ink-muted)]" },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="flex flex-col items-center justify-center gap-0.5 py-3 transition hover:bg-[var(--panel-strong)]">
            <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[13px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">{item.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
