import Link from "next/link";

import { PersistedDisclosure } from "@/components/mobile/PersistedDisclosure";
import { formatMoneyCompact, getAppCurrency } from "@/lib/currency";
import { monthLabel, monthRange, yearRange } from "@/lib/date-ranges";
import { routeLabel } from "@/lib/nav/registry";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { monthOptions, parseMonth, yearOptions, type PeriodFilters } from "./data";
import { DashboardHero, DashboardPeriodBar, RepairStatusReference, statusLabel, type PermissionUser } from "./shared";

export async function InternalTechDashboard({
  userId,
  orgId,
  permissionUser,
  period,
  filters,
}: {
  userId: string;
  orgId: string;
  permissionUser: PermissionUser;
  period: "month" | "year";
  filters: PeriodFilters;
}) {
  const selectedMonth = parseMonth(filters.month);
  const selectedYear = Number(filters.year) || new Date().getFullYear();
  const selectedRange = period === "year" ? yearRange(selectedYear) : monthRange(selectedMonth.year, selectedMonth.month);
  const selectedPeriodLabel = period === "year" ? String(selectedYear) : monthLabel(selectedMonth.year, selectedMonth.month);
  const selectablePeriods = period === "year" ? yearOptions(6) : monthOptions(18);

  const assignedJobs = await prisma.job.findMany({
    where: {
      assignedToId: userId,
      OR: [
        { receivedAt: { gte: selectedRange.start, lte: selectedRange.end } },
        { updatedAt: { gte: selectedRange.start, lte: selectedRange.end } },
        { completedAt: { gte: selectedRange.start, lte: selectedRange.end } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, jobNumber: true, status: true, device: { select: { brand: true, model: true } } },
  }).catch(async () => {
    const fallback = await prisma.job.findMany({
      where: {
        assignedToId: userId,
        OR: [
          { receivedAt: { gte: selectedRange.start, lte: selectedRange.end } },
          { updatedAt: { gte: selectedRange.start, lte: selectedRange.end } },
          { completedAt: { gte: selectedRange.start, lte: selectedRange.end } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, jobNumber: true, status: true },
    });

    return fallback.map((job) => ({ ...job, device: null }));
  });

  const diagnosing = assignedJobs.filter((job) => job.status === "DIAGNOSING").length;
  const inRepair = assignedJobs.filter((job) => job.status === "IN_REPAIR").length;
  const completed = assignedJobs.filter((job) => job.status === "COMPLETED").length;
  const canUpdatePricing = can.approveInvoices(permissionUser);
  // Always tenant-scoped. When the viewer can price org-wide (approveInvoices)
  // we drop the assignee filter but MUST keep orgId, or the billing aggregate
  // would sum across every tenant.
  const pricingScopeWhere = {
    orgId,
    ...(canUpdatePricing ? {} : { assignedToId: userId }),
  };
  const [pricingPendingCount, pricedCount, assignedFinancials] = canUpdatePricing
    ? await Promise.all([
        prisma.job.count({
          where: {
            ...pricingScopeWhere,
            status: { in: ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"] },
            clientBill: null,
          },
        }),
        prisma.job.count({
          where: {
            ...pricingScopeWhere,
            status: { in: ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP", "COMPLETED", "CLOSED"] },
            clientBill: { not: null },
          },
        }),
        prisma.job.aggregate({
          where: {
            ...pricingScopeWhere,
            status: { in: ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP", "COMPLETED", "CLOSED"] },
            clientBill: { not: null },
          },
          _sum: { clientBill: true, externalTechBill: true },
        }),
      ])
    : [0, 0, { _sum: { clientBill: null, externalTechBill: null } }];
  const clientBillingTotal = assignedFinancials._sum.clientBill ?? 0;
  const externalCostTotal = assignedFinancials._sum.externalTechBill ?? 0;
  const marginTotal = clientBillingTotal - externalCostTotal;

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
        title="Internal Bench Workspace"
        summary="Keep diagnostics, repairs, and handoffs flowing · jump directly into the next action queue."
        primaryHref="/jobs"
        primaryLabel={routeLabel("/jobs")}
        secondaryHref={canUpdatePricing ? "/jobs?pricing=needs&status=AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP" : "/jobs?status=DIAGNOSING"}
        secondaryLabel={canUpdatePricing ? "Resolve Pricing Queue" : "Focus Diagnosis Queue"}
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="7" height="9" rx="1"/><rect x="15" y="3" width="7" height="5" rx="1"/><rect x="15" y="12" width="7" height="9" rx="1"/><rect x="2" y="16" width="7" height="5" rx="1"/></svg>}
      />

      <div className="hidden 2xl:block">
        <RepairStatusReference
          title="Full Repair Journey"
          guidance="Use this quick lane map while updating jobs so each handoff follows the standard process."
        />
      </div>

      {canUpdatePricing ? (
        <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)] sm:text-[13px]">Pricing Controls</p>
            <p className="mt-0.5 text-xs text-[var(--ink)] sm:text-sm">You can update client pricing directly from job Financials.</p>
          </div>
          <div className="grid gap-2 p-3 grid-cols-2 sm:grid-cols-3">
            <Link href="/jobs?status=AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP" className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-center">
              <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--accent)]">Needs Pricing</p>
              <p className="mt-1 text-lg font-semibold text-[var(--accent)]">{pricingPendingCount}</p>
            </Link>
            <Link href="/jobs?status=AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP,COMPLETED" className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-center">
              <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--accent)]">Priced Jobs</p>
              <p className="mt-1 text-lg font-semibold text-[var(--accent)]">{pricedCount}</p>
            </Link>
            <Link href="/jobs?pricing=priced" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-center col-span-2 sm:col-span-1">
              <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">Margin</p>
              <p className={`mt-1 text-sm font-semibold ${marginTotal >= 0 ? "text-[var(--accent)]" : "text-red-500"}`}>
                {marginTotal >= 0 ? "+" : ""}{formatMoneyCompact(marginTotal, getAppCurrency())}
              </p>
            </Link>
          </div>
        </section>
      ) : null}

      <PersistedDisclosure
        title="Recent Assigned Jobs"
        storageKey="dashboard.internal.recentAssigned"
        groupName="mobile-dashboard-sections"
        className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 lg:hidden"
      >
        {assignedJobs.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No assigned jobs yet.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {assignedJobs.slice(0, 6).map((job) => (
              <li key={job.id} className="border-b border-[var(--line)] pb-1.5 last:border-0 last:pb-0">
                <Link href={`/jobs/${job.id}`} className="flex items-center justify-between gap-2 group">
                  <p className="truncate text-xs font-medium text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors">{job.jobNumber}</p>
                  <span className="shrink-0 text-[12px] text-[var(--ink-muted)]">
                    {statusLabel[job.status as keyof typeof statusLabel] ?? job.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PersistedDisclosure>

      <div className="hidden gap-3 2xl:grid 2xl:grid-cols-4">
        <Link href="/jobs" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Assigned ({selectedPeriodLabel})</p>
          <p className="mt-1 text-xl font-semibold">{assignedJobs.length}</p>
          <p className="mt-3 text-xs font-medium text-[var(--accent)]">View my jobs →</p>
        </Link>
        <Link href="/jobs?status=DIAGNOSING" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Diagnosing ({selectedPeriodLabel})</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{diagnosing}</p>
          <p className="mt-3 text-xs font-medium text-[var(--accent)]">Needs diagnosis work →</p>
        </Link>
        <Link href="/jobs?status=IN_REPAIR" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">In Repair ({selectedPeriodLabel})</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{inRepair}</p>
          <p className="mt-3 text-xs font-medium text-[var(--accent)]">Active repairs →</p>
        </Link>
        <Link href="/jobs?status=COMPLETED" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Completed ({selectedPeriodLabel})</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{completed}</p>
          <p className="mt-3 text-xs font-medium text-[var(--accent)]">Completed repairs →</p>
        </Link>
      </div>

      <div className="panel-shadow hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 2xl:block">
        <p className="mb-2 text-sm font-semibold">Recent Assigned Jobs</p>
        {assignedJobs.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No assigned jobs yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {assignedJobs.slice(0, 6).map((job) => (
              <li key={job.id} className="border-b border-[var(--line)] py-2 last:border-0 last:pb-0">
                <Link href={`/jobs/${job.id}`} className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center group">
                  <p className="truncate font-medium text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors">{job.jobNumber} — {[job.device?.brand, job.device?.model].filter(v => v && v !== "Unknown").join(" ") || "Device"}</p>
                  <span className="text-xs text-[var(--ink-muted)]">
                    {statusLabel[job.status as keyof typeof statusLabel] ?? job.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
