import Link from "next/link";

import { PersistedDisclosure } from "@/components/mobile/PersistedDisclosure";
import { resolveTechCost } from "@/lib/billing";
import { formatMoney, formatMoneyCompact, getAppCurrency } from "@/lib/currency";
import { monthLabel, monthRange, yearRange } from "@/lib/date-ranges";
import { isOpenJobStatus } from "@/lib/job-status";
import { routeLabel } from "@/lib/nav/registry";
import { getJobPayoutsByIds, getTechnicianPayoutTotalsByJobIds } from "@/lib/payouts";
import { prisma } from "@/lib/prisma";

import { monthOptions, parseMonth, yearOptions, type PeriodFilters } from "./data";
import { DashboardHero, DashboardPeriodBar, statusLabel } from "./shared";

export async function ExternalTechDashboard({
  userId,
  orgId,
  period,
  filters,
}: {
  userId: string;
  orgId: string | null;
  period: "month" | "year";
  filters: PeriodFilters;
}) {
  const selectedMonth = parseMonth(filters.month);
  const selectedYear = Number(filters.year) || new Date().getFullYear();
  const selectedRange = period === "year" ? yearRange(selectedYear) : monthRange(selectedMonth.year, selectedMonth.month);
  const selectedPeriodLabel = period === "year" ? String(selectedYear) : monthLabel(selectedMonth.year, selectedMonth.month);
  const selectablePeriods = period === "year" ? yearOptions(6) : monthOptions(18);

  const jobs = await prisma.job.findMany({
    where: {
      ...(orgId ? { orgId } : {}),
      assignedToId: userId,
      OR: [
        { receivedAt: { gte: selectedRange.start, lte: selectedRange.end } },
        { updatedAt: { gte: selectedRange.start, lte: selectedRange.end } },
        { completedAt: { gte: selectedRange.start, lte: selectedRange.end } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      jobNumber: true,
      status: true,
      repairPath: true,
      externalTechFee: true,
      externalTechBill: true,
    },
  });

  const payouts = await getJobPayoutsByIds(jobs.map((job) => job.id)).catch(() => new Map());
  const payoutTotals = await getTechnicianPayoutTotalsByJobIds(jobs.map((job) => job.id)).catch(() => new Map());

  const currency = getAppCurrency();
  const openCount = jobs.filter((job) => isOpenJobStatus(job.status)).length;
  const completedCount = jobs.filter((job) => job.status === "COMPLETED").length;
  const paidForJob = (job: typeof jobs[number]) => {
    const cost = resolveTechCost(payouts.get(job.id)?.externalTechFee ?? job.externalTechFee, job.externalTechBill);
    return Math.max(payoutTotals.get(job.id)?.paidAmount ?? 0, payouts.get(job.id)?.externalPaid && cost > 0 ? cost : 0);
  };
  const paidTotal = jobs.reduce((sum, job) => {
    const cost = resolveTechCost(payouts.get(job.id)?.externalTechFee ?? job.externalTechFee, job.externalTechBill);
    return sum + Math.min(cost, paidForJob(job));
  }, 0);
  const outstandingTotal = jobs
    .filter((job) => job.status === "COMPLETED")
    .reduce((sum, job) => {
      const cost = resolveTechCost(payouts.get(job.id)?.externalTechFee ?? job.externalTechFee, job.externalTechBill);
      return sum + Math.max(0, cost - paidForJob(job));
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
        title="External Technician Control Board"
        summary={`${jobs.length} assigned · ${openCount} open · ${completedCount} completed · ${formatMoneyCompact(outstandingTotal, currency)} payout pending`}
        primaryHref="/technicians"
        primaryLabel={routeLabel("/technicians")}
        secondaryHref="/technicians/payouts"
        secondaryLabel={routeLabel("/technicians/payouts")}
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>}
      />

      <div className="hidden gap-3 2xl:grid 2xl:grid-cols-4">
        <Link href="/technicians" className="dc-card px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Assigned Jobs ({selectedPeriodLabel})</p>
          <p className="mt-1 text-xl font-semibold">{jobs.length}</p>
          <p className="mt-3 text-xs font-medium text-[var(--accent)]">Open queue →</p>
        </Link>
        <Link href="/technicians?ready=1" className="dc-card px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Open Jobs ({selectedPeriodLabel})</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{openCount}</p>
          <p className="mt-3 text-xs font-medium text-[var(--accent)]">Jobs needing action →</p>
        </Link>
        <Link href="/jobs?status=COMPLETED" className="dc-card px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Completed ({selectedPeriodLabel})</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{completedCount}</p>
          <p className="mt-3 text-xs font-medium text-[var(--accent)]">Completed jobs →</p>
        </Link>
        <div className="dc-card px-3 py-2.5 sm:p-5">
          <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Payout Outstanding</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{formatMoneyCompact(outstandingTotal, currency)}</p>
          <p className="mt-2 text-xs text-[var(--ink-muted)]">Paid to date: {formatMoneyCompact(paidTotal, currency)}</p>
          <p className="mt-3 text-xs font-medium text-[var(--accent)]">
            <Link href="/technicians/payouts">View payout breakdown →</Link>
          </p>
        </div>
      </div>

      <PersistedDisclosure
        title="Recent Assigned Jobs"
        storageKey="dashboard.external.recentAssigned"
        groupName="mobile-dashboard-sections"
        className="dc-card p-3 lg:hidden"
      >
        {jobs.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No assigned jobs yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {jobs.slice(0, 6).map((job) => (
              <li key={job.id} className="flex flex-col items-start justify-between gap-2 border-b border-[var(--line)] py-2">
                <div className="min-w-0">
                  <p className="mono truncate font-bold text-[var(--accent)]">{job.jobNumber}</p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {statusLabel[job.status as keyof typeof statusLabel] ?? job.status}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--ink-muted)]">Fee</p>
                  <p className="font-medium">{formatMoney(resolveTechCost(payouts.get(job.id)?.externalTechFee ?? job.externalTechFee, job.externalTechBill), currency)}</p>
                  <p className="text-xs text-[var(--accent)]">
                    {(() => {
                      const cost = resolveTechCost(payouts.get(job.id)?.externalTechFee ?? job.externalTechFee, job.externalTechBill);
                      const paid = paidForJob(job);
                      if (cost > 0 && paid >= cost) return "Paid";
                      if (paid > 0) return "Partially paid";
                      return "Unpaid";
                    })()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PersistedDisclosure>
    </div>
  );
}
