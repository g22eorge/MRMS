import Link from "next/link";

import { resolveTechCost } from "@/lib/billing";
import { formatMoneyCompact, getAppCurrency } from "@/lib/currency";
import { monthLabel, monthRange, yearRange } from "@/lib/date-ranges";
import { routeLabel } from "@/lib/nav/registry";
import { getJobPayoutsByIds, getTechnicianPayoutTotalsByJobIds } from "@/lib/payouts";
import { prisma } from "@/lib/prisma";

import { loadRepairRevenueTrend, monthOptions, parseMonth, trendMonthsForYear, yearOptions, type PeriodFilters } from "./data";
import { DashboardHero, DashboardPeriodBar, RevenueMarginTrendSection } from "./shared";

export async function OpsDashboard({
  orgId,
  period,
  filters,
}: {
  orgId: string | null;
  period: "month" | "year";
  filters: PeriodFilters;
}) {
  const currency = getAppCurrency();
  const selectedMonth = parseMonth(filters.month);
  const selectedYear = Number(filters.year) || new Date().getFullYear();
  const selectedRange = period === "year" ? yearRange(selectedYear) : monthRange(selectedMonth.year, selectedMonth.month);
  const selectedPeriodLabel = period === "year" ? String(selectedYear) : monthLabel(selectedMonth.year, selectedMonth.month);
  const selectablePeriods = period === "year" ? yearOptions(6) : monthOptions(18);
  const reportHref =
    period === "year"
      ? `/reports?period=year&year=${selectedYear}`
      : `/reports?period=month&month=${selectedPeriodLabel}`;

  const trendMonths = trendMonthsForYear(selectedRange.start.getFullYear(), period === "year" ? 12 : selectedMonth.month);

  const [completedThisMonth, pendingBilling, externalCompleted, revenueTrend] = await Promise.all([
    prisma.job.aggregate({
      where: { orgId, status: "COMPLETED", completedAt: { gte: selectedRange.start, lte: selectedRange.end } },
      _sum: { clientBill: true },
      _count: true,
    }),
    prisma.job.count({
      where: {
        orgId,
        status: { in: ["IN_REPAIR", "READY_FOR_PICKUP", "AWAITING_APPROVAL"] },
      },
    }),
    prisma.job.findMany({
      where: {
        orgId,
        repairPath: "EXTERNAL",
        externalPaid: false,
        status: { in: ["READY_FOR_PICKUP", "COMPLETED", "DELIVERED"] },
      },
      select: { id: true, externalTechFee: true, externalTechBill: true },
      take: 200,
    }),
    loadRepairRevenueTrend(trendMonths, orgId),
  ]);

  const monthRevenue = completedThisMonth._sum.clientBill ?? 0;

  const payoutMap = await getJobPayoutsByIds(externalCompleted.map((job) => job.id)).catch(() => new Map());
  const payoutTotals = await getTechnicianPayoutTotalsByJobIds(externalCompleted.map((job) => job.id)).catch(() => new Map());
  // externalCompleted already pre-filtered to externalPaid=false in the DB query
  const payoutOutstanding = externalCompleted
    .reduce((sum, job) => {
      const cost = resolveTechCost(payoutMap.get(job.id)?.externalTechFee ?? job.externalTechFee, job.externalTechBill);
      const paid = payoutTotals.get(job.id)?.paidAmount ?? 0;
      return sum + Math.max(0, cost - paid);
    }, 0);

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
        title="Operations Overview"
        summary={`${completedThisMonth._count} completed · ${pendingBilling} pending billing · revenue ${formatMoneyCompact(monthRevenue, currency)} · payouts ${formatMoneyCompact(payoutOutstanding, currency)}`}
        primaryHref="/jobs"
        primaryLabel={routeLabel("/jobs")}
        secondaryHref={reportHref}
        secondaryLabel="Reports"
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="dc-card px-3 py-2.5">
          <p className="text-[0.78125rem] font-bold tracking-[-0.01em] text-[var(--dc-ink)]">Billing Queue</p>
          <div className="mt-3 space-y-2">
            <Link href="/jobs?status=IN_REPAIR,READY_FOR_PICKUP,AWAITING_APPROVAL" className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm hover:border-[var(--accent)]/30">
              <span>Pending billing jobs</span>
              <span className="font-semibold">{pendingBilling}</span>
            </Link>
            <Link href="/jobs?status=COMPLETED" className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm hover:border-[var(--accent)]/30">
              <span>Completed ({selectedPeriodLabel})</span>
              <span className="font-semibold">{completedThisMonth._count}</span>
            </Link>
          </div>
        </section>
        <section className="dc-card px-3 py-2.5">
          <p className="text-[0.78125rem] font-bold tracking-[-0.01em] text-[var(--dc-ink)]">Cash Exposure</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm">
              <span>Revenue ({selectedPeriodLabel})</span>
              <span className="font-semibold">{formatMoneyCompact(monthRevenue, currency)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm">
              <span>External payouts due</span>
              <span className="font-semibold">{formatMoneyCompact(payoutOutstanding, currency)}</span>
            </div>
            <Link href={reportHref} className="mt-1 inline-flex text-xs font-semibold text-[var(--accent)] hover:underline">Open detailed finance reports →</Link>
          </div>
        </section>
      </div>

      <RevenueMarginTrendSection trendMonths={trendMonths} revenueTrend={revenueTrend} currency={currency} label="Repair Revenue & Margin Trend" emptyMessage="No completed repair jobs yet for this period." />

    </div>
  );
}
