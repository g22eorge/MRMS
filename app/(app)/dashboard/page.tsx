import Link from "next/link";

import { PersistedDisclosure } from "@/components/mobile/PersistedDisclosure";
import { StickyKpiRow } from "@/components/mobile/StickyKpiRow";
import { ReportsCharts } from "@/components/reports/ReportsCharts";
import { MonthSelectForm } from "@/components/shared/MonthSelectForm";
import { getClientBill, getExternalTechBill } from "@/lib/billing";
import { formatMoney, getAppCurrency } from "@/lib/currency";
import { formatEATMonthLabel } from "@/lib/date-eat";
import { JOB_STATUSES, JobStatus } from "@/lib/job-status";
import { can } from "@/lib/permissions";
import { getJobPayoutsByIds } from "@/lib/payouts";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

type SearchParams = {
  month?: string;
  year?: string;
  period?: string;
};

function parseMonth(monthParam?: string) {
  if (!monthParam) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const [y, m] = monthParam.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year: y, month: m };
}

function monthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function yearRange(year: number) {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { start, end };
}

function monthLabel(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function asDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthOptions(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = monthLabel(date.getFullYear(), date.getMonth() + 1);
    const label = formatEATMonthLabel(date.getFullYear(), date.getMonth() + 1);
    return { value, label };
  });
}

function yearOptions(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const year = now.getFullYear() - index;
    return { value: String(year), label: `${year} Annual Package` };
  });
}

const statusLabel: Record<JobStatus, string> = {
  RECEIVED: "Received",
  DIAGNOSING: "Diagnosing",
  PENDING_EXTERNAL_ASSIGNMENT: "Pending External Assignment",
  ASSIGNED_ONE_TIME_EXTERNAL: "Assigned (One-Time External)",
  IN_EXTERNAL_REPAIR: "In External Repair",
  WAITING_FOR_PARTS: "Waiting for Parts",
  RETURNED_FROM_EXTERNAL: "Returned from External",
  AWAITING_APPROVAL: "Awaiting Approval",
  IN_REPAIR: "In Repair",
  READY_FOR_PICKUP: "Ready for Pickup",
  COMPLETED: "Completed",
  CLOSED: "Closed",
  DELIVERED: "Delivered",
};

const deviceLabel: Record<string, string> = {
  PHONE_ANDROID: "Android Phone",
  PHONE_IPHONE: "iPhone",
  TABLET: "Tablet",
  WINDOWS_PC: "Windows PC",
  MAC: "Mac",
  OTHER: "Other",
};

const repairFlowReference = [
  { key: "RECEIVED", label: "Received", href: "/jobs?status=RECEIVED", tone: "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink)]" },
  { key: "DIAGNOSING", label: "Diagnosing", href: "/jobs?status=DIAGNOSING", tone: "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink)]" },
  { key: "PENDING_EXTERNAL_ASSIGNMENT", label: "External Assign", href: "/jobs?status=PENDING_EXTERNAL_ASSIGNMENT", tone: "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink)]" },
  { key: "IN_EXTERNAL_REPAIR", label: "External Repair", href: "/jobs?status=IN_EXTERNAL_REPAIR", tone: "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink)]" },
  { key: "RETURNED_FROM_EXTERNAL", label: "Returned", href: "/jobs?status=RETURNED_FROM_EXTERNAL", tone: "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37]" },
  { key: "AWAITING_APPROVAL", label: "Awaiting Approval", href: "/jobs?status=AWAITING_APPROVAL", tone: "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37]" },
  { key: "IN_REPAIR", label: "In Repair", href: "/jobs?status=IN_REPAIR", tone: "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink)]" },
  { key: "READY_FOR_PICKUP", label: "Ready for Pickup", href: "/jobs?status=READY_FOR_PICKUP", tone: "border-[#D4AF37] bg-[#D4AF37] text-white" },
  { key: "COMPLETED", label: "Completed", href: "/jobs?status=COMPLETED", tone: "border-[#D4AF37] bg-[#D4AF37] text-white" },
  { key: "CLOSED", label: "Closed", href: "/jobs?status=CLOSED", tone: "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]" },
] as const;

function RepairStatusReference({
  title,
  guidance,
}: {
  title: string;
  guidance: string;
}) {
  return (
    <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[linear-gradient(135deg,rgba(212,175,55,0.06),rgba(212,175,55,0.02))]">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Repair Status Guide</p>
        <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{title}</p>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">{guidance}</p>
      </div>
      <div className="flex snap-x gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:thin]">
        {repairFlowReference.map((step, index) => (
          <div key={step.key} className="flex shrink-0 items-center gap-2">
            <Link href={step.href} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition hover:-translate-y-[1px] ${step.tone}`}>
              {step.label}
            </Link>
            {index < repairFlowReference.length - 1 ? <span className="text-[10px] text-[var(--ink-muted)]">→</span> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardPeriodBar({
  period,
  monthHref,
  yearHref,
  selectorName,
  selectorValue,
  selectorOptions,
  actionHref,
  actionLabel,
}: {
  period: "month" | "year";
  monthHref: string;
  yearHref: string;
  selectorName: "month" | "year";
  selectorValue: string;
  selectorOptions: Array<{ value: string; label: string }>;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="panel-shadow flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[var(--line)] bg-[linear-gradient(180deg,rgba(212,175,55,0.1),rgba(245,245,245,0.95))] p-3">
      <div className="flex items-center gap-2">
        <Link
          href={monthHref}
          className={`rounded-lg px-2.5 py-1.5 text-xs ${period === "month" ? "btn-premium text-white" : "btn-premium-secondary"}`}
        >
          Monthly
        </Link>
        <Link
          href={yearHref}
          className={`rounded-lg px-2.5 py-1.5 text-xs ${period === "year" ? "btn-premium text-white" : "btn-premium-secondary"}`}
        >
          Annual
        </Link>
      </div>
      <MonthSelectForm
        name={selectorName}
        value={selectorValue}
        options={selectorOptions}
        hiddenFields={{ period }}
        className="flex items-center"
        selectClassName="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-sm"
      />
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-sm">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function DashboardHero({
  title,
  summary,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  summary: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[linear-gradient(135deg,rgba(212,175,55,0.12),rgba(15,23,42,0.02),rgba(212,175,55,0.08))]">
      <div className="px-3 py-3 sm:px-5 sm:py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)] sm:text-[11px]">Operations Snapshot</p>
        <p className="mt-1 text-sm font-semibold text-[var(--ink)] sm:text-base">{title}</p>
        <p className="mt-1 text-xs text-[var(--ink-muted)] [overflow-wrap:anywhere] sm:text-sm">{summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={primaryHref} className="btn-premium rounded-lg px-3 py-1.5 text-xs text-white sm:text-sm">
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link href={secondaryHref} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-xs sm:text-sm">
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { session, user } = await getCurrentUserRole();
  const permissionUser = { role: user.role, permissions: user.permissions };
  const filters = await searchParams;
  const period: "month" | "year" = filters.period === "year" ? "year" : "month";

  if (user.role === "TECHNICIAN_EXTERNAL") {
    const selectedMonth = parseMonth(filters.month);
    const selectedYear = Number(filters.year) || new Date().getFullYear();
    const selectedRange = period === "year" ? yearRange(selectedYear) : monthRange(selectedMonth.year, selectedMonth.month);
    const selectedPeriodLabel = period === "year" ? String(selectedYear) : monthLabel(selectedMonth.year, selectedMonth.month);
    const selectablePeriods = period === "year" ? yearOptions(6) : monthOptions(18);

    const jobs = await prisma.job.findMany({
      where: {
        assignedToId: session.user.id,
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
      },
    });

    const payouts = await getJobPayoutsByIds(jobs.map((job) => job.id));

    const currency = getAppCurrency();
    const openCount = jobs.filter((job) => [
      "RECEIVED",
      "DIAGNOSING",
      "PENDING_EXTERNAL_ASSIGNMENT",
      "ASSIGNED_ONE_TIME_EXTERNAL",
      "IN_EXTERNAL_REPAIR",
      "WAITING_FOR_PARTS",
      "RETURNED_FROM_EXTERNAL",
      "AWAITING_APPROVAL",
      "IN_REPAIR",
      "READY_FOR_PICKUP",
      "DELIVERED",
    ].includes(job.status)).length;
    const completedCount = jobs.filter((job) => job.status === "COMPLETED").length;
    const paidTotal = jobs
      .filter((job) => payouts.get(job.id)?.externalPaid && typeof payouts.get(job.id)?.externalTechFee === "number")
      .reduce((sum, job) => sum + (payouts.get(job.id)?.externalTechFee ?? 0), 0);
    const outstandingTotal = jobs
      .filter(
        (job) =>
          job.status === "COMPLETED" &&
          !payouts.get(job.id)?.externalPaid &&
          typeof payouts.get(job.id)?.externalTechFee === "number",
      )
      .reduce((sum, job) => sum + (payouts.get(job.id)?.externalTechFee ?? 0), 0);

    return (
      <div className="space-y-5">
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
          summary="Use this board to progress active work orders quickly and keep payout clearance in sync from one workspace."
          primaryHref="/technicians"
          primaryLabel="Open Work Queue"
          secondaryHref="/technicians/payouts"
          secondaryLabel="Review Payouts"
        />

        <StickyKpiRow
          items={[
            { label: "Assigned", value: String(jobs.length), href: "/technicians" },
            { label: "Open", value: String(openCount), href: "/technicians?ready=1", tone: "brand" },
            { label: "Completed", value: String(completedCount), href: "/jobs?status=COMPLETED", tone: "success" },
            { label: "Outstanding", value: formatMoney(outstandingTotal, currency), href: "/technicians/payouts", tone: "warning" },
          ]}
        />

        <div className="hidden gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-4">
          <Link href="/technicians" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Assigned Jobs ({selectedPeriodLabel})</p>
            <p className="mt-2 text-3xl font-semibold sm:text-4xl">{jobs.length}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Open queue →</p>
          </Link>
          <Link href="/technicians?ready=1" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Open Jobs ({selectedPeriodLabel})</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--brand)] sm:text-4xl">{openCount}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Jobs needing action →</p>
          </Link>
          <Link href="/jobs?status=COMPLETED" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Completed ({selectedPeriodLabel})</p>
            <p className="mt-2 text-3xl font-semibold text-[#D4AF37] sm:text-4xl">{completedCount}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Completed jobs →</p>
          </Link>
          <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Payout Outstanding</p>
            <p className="mt-2 text-3xl font-semibold text-[#D4AF37]">{formatMoney(outstandingTotal, currency)}</p>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">Paid to date: {formatMoney(paidTotal, currency)}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">
              <Link href="/technicians/payouts">View payout breakdown →</Link>
            </p>
          </div>
        </div>

        <PersistedDisclosure
          title="Recent Assigned Jobs"
          storageKey="dashboard.external.recentAssigned"
          groupName="mobile-dashboard-sections"
          className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 lg:hidden"
        >
          {jobs.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No assigned jobs yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {jobs.slice(0, 6).map((job) => (
                <li key={job.id} className="flex flex-col items-start justify-between gap-2 border-b border-[var(--line)] py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{job.jobNumber}</p>
                    <p className="text-xs text-[var(--ink-muted)]">{statusLabel[job.status]}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--ink-muted)]">Fee</p>
                    <p className="font-medium">{formatMoney(payouts.get(job.id)?.externalTechFee ?? 0, currency)}</p>
                    <p className={`text-xs ${payouts.get(job.id)?.externalPaid ? "text-[#D4AF37]" : "text-[#D4AF37]"}`}>
                      {payouts.get(job.id)?.externalPaid ? "Paid" : "Unpaid"}
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

  if (user.role === "TECHNICIAN_INTERNAL") {
    const selectedMonth = parseMonth(filters.month);
    const selectedYear = Number(filters.year) || new Date().getFullYear();
    const selectedRange = period === "year" ? yearRange(selectedYear) : monthRange(selectedMonth.year, selectedMonth.month);
    const selectedPeriodLabel = period === "year" ? String(selectedYear) : monthLabel(selectedMonth.year, selectedMonth.month);
    const selectablePeriods = period === "year" ? yearOptions(6) : monthOptions(18);

    const assignedJobs = await prisma.job.findMany({
      where: {
        assignedToId: session.user.id,
        OR: [
          { receivedAt: { gte: selectedRange.start, lte: selectedRange.end } },
          { updatedAt: { gte: selectedRange.start, lte: selectedRange.end } },
          { completedAt: { gte: selectedRange.start, lte: selectedRange.end } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, jobNumber: true, status: true, brand: true, model: true },
    });

    const diagnosing = assignedJobs.filter((job) => job.status === "DIAGNOSING").length;
    const inRepair = assignedJobs.filter((job) => job.status === "IN_REPAIR").length;
    const completed = assignedJobs.filter((job) => job.status === "COMPLETED").length;
    const canUpdatePricing = can.approveInvoices(permissionUser);
    const pricingScopeWhere = {
      ...(canUpdatePricing ? {} : { assignedToId: session.user.id }),
    };
    const [pricingPendingCount, pricedCount, assignedFinancials] = canUpdatePricing
      ? await Promise.all([
          prisma.job.count({
            where: {
              ...pricingScopeWhere,
              status: { in: ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP", "DELIVERED"] },
              clientBill: null,
            },
          }),
          prisma.job.count({
            where: {
              ...pricingScopeWhere,
              status: { in: ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP", "DELIVERED", "COMPLETED", "CLOSED"] },
              clientBill: { not: null },
            },
          }),
          prisma.job.findMany({
            where: {
              ...pricingScopeWhere,
              status: { in: ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP", "DELIVERED", "COMPLETED", "CLOSED"] },
              clientBill: { not: null },
            },
            select: {
              clientBill: true,
              externalTechBill: true,
            },
          }),
        ])
      : [0, 0, []];
    const clientBillingTotal = assignedFinancials.reduce((sum, job) => sum + (job.clientBill ?? 0), 0);
    const externalCostTotal = assignedFinancials.reduce((sum, job) => sum + (job.externalTechBill ?? 0), 0);
    const marginTotal = clientBillingTotal - externalCostTotal;

    return (
      <div className="space-y-3 sm:space-y-5">
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
          summary="Keep diagnostics, repairs, and handoffs flowing from this workspace, then jump directly into the next action queue."
          primaryHref="/jobs"
          primaryLabel="Open Assigned Jobs"
          secondaryHref={canUpdatePricing ? "/jobs?pricing=needs&status=AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP" : "/jobs?status=DIAGNOSING"}
          secondaryLabel={canUpdatePricing ? "Resolve Pricing Queue" : "Focus Diagnosis Queue"}
        />

        <div className="hidden lg:block">
          <RepairStatusReference
            title="Full Repair Journey"
            guidance="Use this quick lane map while updating jobs so each handoff follows the standard process."
          />
        </div>

        {canUpdatePricing ? (
          <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="border-b border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37] sm:text-[11px]">Pricing Controls</p>
              <p className="mt-0.5 text-xs text-[var(--ink)] sm:text-sm">You can update client pricing directly from job Financials.</p>
            </div>
            <div className="grid gap-2 p-3 grid-cols-2 sm:grid-cols-3">
              <Link href="/jobs?status=AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP" className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.08em] text-[#D4AF37]">Needs Pricing</p>
                <p className="mt-1 text-lg font-semibold text-[#D4AF37]">{pricingPendingCount}</p>
              </Link>
              <Link href="/jobs?status=AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP,COMPLETED" className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.08em] text-[#D4AF37]">Priced Jobs</p>
                <p className="mt-1 text-lg font-semibold text-[#D4AF37]">{pricedCount}</p>
              </Link>
              <Link href="/jobs?pricing=priced" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-center col-span-2 sm:col-span-1">
                <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">Margin</p>
                <p className={`mt-1 text-sm font-semibold ${marginTotal >= 0 ? "text-[#D4AF37]" : "text-black"}`}>
                  {marginTotal >= 0 ? "+" : ""}{formatMoney(marginTotal, getAppCurrency())}
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
                    <p className="truncate text-xs font-medium text-[var(--ink)] group-hover:text-[var(--brand)] transition-colors">{job.jobNumber}</p>
                    <span className="shrink-0 text-[10px] text-[var(--ink-muted)]">{statusLabel[job.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PersistedDisclosure>

        <div className="hidden gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-4">
          <Link href="/jobs" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Assigned ({selectedPeriodLabel})</p>
            <p className="mt-2 text-3xl font-semibold sm:text-4xl">{assignedJobs.length}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">View my jobs →</p>
          </Link>
          <Link href="/jobs?status=DIAGNOSING" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Diagnosing ({selectedPeriodLabel})</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--brand)] sm:text-4xl">{diagnosing}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Needs diagnosis work →</p>
          </Link>
          <Link href="/jobs?status=IN_REPAIR" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">In Repair ({selectedPeriodLabel})</p>
            <p className="mt-2 text-3xl font-semibold text-[#D4AF37] sm:text-4xl">{inRepair}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Active repairs →</p>
          </Link>
          <Link href="/jobs?status=COMPLETED" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Completed ({selectedPeriodLabel})</p>
            <p className="mt-2 text-3xl font-semibold text-[#D4AF37] sm:text-4xl">{completed}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Completed repairs →</p>
          </Link>
        </div>

        <div className="panel-shadow hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 lg:block">
          <p className="mb-2 text-sm font-semibold">Recent Assigned Jobs</p>
          {assignedJobs.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No assigned jobs yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {assignedJobs.slice(0, 6).map((job) => (
                <li key={job.id} className="border-b border-[var(--line)] py-2 last:border-0 last:pb-0">
                  <Link href={`/jobs/${job.id}`} className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center group">
                    <p className="truncate font-medium text-[var(--ink)] group-hover:text-[var(--brand)] transition-colors">{job.jobNumber} - {job.brand} {job.model}</p>
                    <span className="text-xs text-[var(--ink-muted)]">{statusLabel[job.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (user.role === "ADMIN") {
    const selectedMonth = parseMonth(filters.month);
    const selectedYear = Number(filters.year) || new Date().getFullYear();
    const selectedRange = period === "year" ? yearRange(selectedYear) : monthRange(selectedMonth.year, selectedMonth.month);
    const prevRange =
      period === "year"
        ? yearRange(selectedYear - 1)
        : monthRange(new Date(selectedMonth.year, selectedMonth.month - 2, 1).getFullYear(), new Date(selectedMonth.year, selectedMonth.month - 2, 1).getMonth() + 1);
    const currency = getAppCurrency();

    const [
      statusGroup,
      deviceGroup,
      completedSelected,
      completedPrev,
      receivedSelectedCount,
      receivedPrevCount,
      closedSelectedCount,
      closedPrevCount,
      externalCount,
      inHouseCount,
      externalCompleted,
    ] = await Promise.all([
      prisma.job.groupBy({ by: ["status"], _count: { status: true } }),
      prisma.job.groupBy({ by: ["deviceType"], _count: { deviceType: true } }),
      prisma.job.findMany({
        where: {
          status: "COMPLETED",
          completedAt: { gte: selectedRange.start, lte: selectedRange.end },
        },
      }),
      prisma.job.findMany({
        where: {
          status: "COMPLETED",
          completedAt: { gte: prevRange.start, lte: prevRange.end },
        },
      }),
      prisma.job.count({ where: { receivedAt: { gte: selectedRange.start, lte: selectedRange.end } } }),
      prisma.job.count({ where: { receivedAt: { gte: prevRange.start, lte: prevRange.end } } }),
      prisma.job.count({ where: { status: "CLOSED", closedAt: { gte: selectedRange.start, lte: selectedRange.end } } }),
      prisma.job.count({ where: { status: "CLOSED", closedAt: { gte: prevRange.start, lte: prevRange.end } } }),
      prisma.job.count({ where: { repairPath: "EXTERNAL", receivedAt: { gte: selectedRange.start, lte: selectedRange.end } } }),
      prisma.job.count({ where: { repairPath: "IN_HOUSE", receivedAt: { gte: selectedRange.start, lte: selectedRange.end } } }),
      prisma.job.findMany({
        where: {
          repairPath: "EXTERNAL",
          assignedTo: { is: { role: "TECHNICIAN_EXTERNAL" } },
          status: "COMPLETED",
        },
        select: { id: true, externalTechBill: true },
      }),
    ]);

    const completedSelectedCount = completedSelected.length;
    const completedPrevCount = completedPrev.length;

    const payoutMap = await getJobPayoutsByIds(externalCompleted.map((job) => job.id));
    const payoutOutstanding = externalCompleted
      .filter((job) => !payoutMap.get(job.id)?.externalPaid)
      .reduce((sum, job) => sum + (payoutMap.get(job.id)?.externalTechFee ?? job.externalTechBill ?? 0), 0);

    const pricedSubset = <T extends typeof completedSelected[number]>(jobs: T[]) =>
      jobs.filter((job) => getClientBill(job) !== null);

    const revenueFor = (jobs: typeof completedSelected) => pricedSubset(jobs).reduce((sum, job) => sum + (getClientBill(job) ?? 0), 0);
    const revenueSelected = revenueFor(completedSelected);
    const revenuePrev = revenueFor(completedPrev);
    const revenueDelta = revenueSelected - revenuePrev;
    const marginSelected = pricedSubset(completedSelected).reduce(
      (sum, job) => sum + ((getClientBill(job) ?? 0) - (getExternalTechBill(job) ?? 0)),
      0,
    );
    const marginRate = revenueSelected > 0 ? (marginSelected / revenueSelected) * 100 : 0;

    const statusCount = new Map(statusGroup.map((s) => [s.status, s._count.status]));
    const statusData = JOB_STATUSES.map((status) => ({
      key: status,
      name: statusLabel[status],
      value: statusCount.get(status) ?? 0,
    }));
    const deviceData = deviceGroup.map((d) => ({
      name: deviceLabel[d.deviceType] ?? d.deviceType,
      value: d._count.deviceType,
    }));

    const selectedMonthString = period === "year" ? String(selectedYear) : monthLabel(selectedMonth.year, selectedMonth.month);
    const prevMonthString =
      period === "year"
        ? String(selectedYear - 1)
        : monthLabel(new Date(selectedMonth.year, selectedMonth.month - 2, 1).getFullYear(), new Date(selectedMonth.year, selectedMonth.month - 2, 1).getMonth() + 1);
    const selectedFrom = asDateInputValue(selectedRange.start);
    const selectedTo = asDateInputValue(selectedRange.end);
    const totalPath = inHouseCount + externalCount;
    const externalRatio = totalPath > 0 ? (externalCount / totalPath) * 100 : 0;
    const selectableMonths = period === "year" ? yearOptions(6) : monthOptions(18);
    const receivedDelta = receivedSelectedCount - receivedPrevCount;
    const completedDeltaCount = completedSelectedCount - completedPrevCount;
    const closedDelta = closedSelectedCount - closedPrevCount;
    const reportHref =
      period === "year"
        ? `/reports?period=year&year=${selectedYear}`
        : `/reports?period=month&month=${selectedMonthString}`;

    return (
      <div className="space-y-5">
        <DashboardHero
          title="Executive Command Center"
          summary="Monitor operational momentum, financial health, and conversion trends here before drilling into detailed reports."
          primaryHref="/reports"
          primaryLabel="Open Reports"
          secondaryHref={`/jobs?from=${selectedFrom}&to=${selectedTo}`}
          secondaryLabel="Open Period Queue"
        />

        <StickyKpiRow
          items={[
            { label: "Received", value: String(receivedSelectedCount), href: `/jobs?from=${selectedFrom}&to=${selectedTo}` },
            { label: "Completed", value: String(completedSelectedCount), href: `/jobs?status=COMPLETED&from=${selectedFrom}&to=${selectedTo}`, tone: "success" },
            { label: "Closed", value: String(closedSelectedCount), href: `/jobs?status=CLOSED&from=${selectedFrom}&to=${selectedTo}`, tone: "warning" },
            { label: "Revenue", value: formatMoney(revenueSelected, currency), href: reportHref, tone: "brand" },
          ]}
        />

        <div className="hidden gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-4">
          <Link href="/jobs" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Jobs Received ({selectedMonthString})</p>
            <p className="mt-2 text-3xl font-semibold sm:text-4xl">{receivedSelectedCount}</p>
            <p className={`mt-1 text-xs ${receivedDelta >= 0 ? "text-[#D4AF37]" : "text-black"}`}>
              {receivedDelta >= 0 ? "+" : ""}
              {receivedDelta} vs {prevMonthString}
            </p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Open intake view →</p>
          </Link>
          <Link href={`/jobs?status=COMPLETED&from=${selectedFrom}&to=${selectedTo}`} className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Jobs Completed ({selectedMonthString})</p>
            <p className="mt-2 text-3xl font-semibold text-[#D4AF37] sm:text-4xl">{completedSelectedCount}</p>
            <p className={`mt-1 text-xs ${completedDeltaCount >= 0 ? "text-[#D4AF37]" : "text-black"}`}>
              {completedDeltaCount >= 0 ? "+" : ""}
              {completedDeltaCount} vs {prevMonthString}
            </p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Open completion view →</p>
          </Link>
          <Link href={`/jobs?status=CLOSED&from=${selectedFrom}&to=${selectedTo}`} className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Jobs Closed ({selectedMonthString})</p>
            <p className="mt-2 text-3xl font-semibold text-[#D4AF37] sm:text-4xl">{closedSelectedCount}</p>
            <p className={`mt-1 text-xs ${closedDelta >= 0 ? "text-[#D4AF37]" : "text-black"}`}>
              {closedDelta >= 0 ? "+" : ""}
              {closedDelta} vs {prevMonthString}
            </p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Open closure view →</p>
          </Link>
          <Link href={reportHref} className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Revenue ({selectedMonthString})</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--brand)] sm:text-4xl">{formatMoney(revenueSelected, currency)}</p>
            <p className={`mt-1 text-xs ${revenueDelta >= 0 ? "text-[#D4AF37]" : "text-black"}`}>
              {revenueDelta >= 0 ? "+" : "-"}
              {formatMoney(Math.abs(revenueDelta), currency)} vs {prevMonthString}
            </p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Open report workspace →</p>
          </Link>
        </div>

        <DashboardPeriodBar
          period={period}
          monthHref={`/dashboard?period=month&month=${monthLabel(new Date().getFullYear(), new Date().getMonth() + 1)}`}
          yearHref={`/dashboard?period=year&year=${new Date().getFullYear()}`}
          selectorName={period === "year" ? "year" : "month"}
          selectorValue={selectedMonthString}
          selectorOptions={selectableMonths}
          actionHref={reportHref}
          actionLabel="Open Report Downloads"
        />

        <PersistedDisclosure
          title="Monthly Financial Signals"
          defaultOpen
          storageKey="dashboard.admin.monthlySignals"
          groupName="mobile-dashboard-sections"
          className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 lg:hidden"
        >
          <div className="grid gap-2">
            <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Revenue</p>
              <p className="text-sm font-semibold">{formatMoney(revenueSelected, currency)}</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Repair Margin</p>
              <p className={`text-sm font-semibold ${marginSelected >= 0 ? "text-[#D4AF37]" : "text-black"}`}>
                {formatMoney(marginSelected, currency)}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">External Ratio</p>
              <p className="text-sm font-semibold">{externalRatio.toFixed(0)}%</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Payouts Due</p>
              <p className="text-sm font-semibold text-black">{formatMoney(payoutOutstanding, currency)}</p>
            </div>
          </div>
        </PersistedDisclosure>

        <div className="hidden gap-4 lg:grid lg:grid-cols-4">
          <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Revenue ({selectedMonthString})</p>
            <p className="mt-1 text-2xl font-semibold">{formatMoney(revenueSelected, currency)}</p>
            <p className={`mt-1 text-xs ${revenueDelta >= 0 ? "text-[#D4AF37]" : "text-black"}`}>{revenueDelta >= 0 ? "+" : "-"}{formatMoney(Math.abs(revenueDelta), currency)} vs {prevMonthString}</p>
          </div>
          <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Repair Margin</p>
            <p className={`mt-1 text-2xl font-semibold ${marginSelected >= 0 ? "text-[#D4AF37]" : "text-black"}`}>{formatMoney(marginSelected, currency)}</p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">Margin rate {marginRate.toFixed(1)}%</p>
          </div>
          <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">External Ratio</p>
            <p className="mt-1 text-2xl font-semibold">{externalRatio.toFixed(0)}%</p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">{externalCount} external / {inHouseCount} in-house ({selectedMonthString})</p>
          </div>
          <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">External Payouts Due</p>
            <p className="mt-1 text-2xl font-semibold text-black">{formatMoney(payoutOutstanding, currency)}</p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">Unpaid completed external jobs (all months)</p>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 text-sm lg:hidden">
          <p className="font-semibold text-[var(--ink)]">Quick mobile briefing</p>
          <p className="mt-1 text-[var(--ink-muted)]">
            For full trend charts and downloadable packs, use the Reports workspace.
          </p>
          <Link href={reportHref} className="mt-2 inline-block text-xs font-medium text-[var(--brand)] hover:underline">
            Open Reports →
          </Link>
        </div>

        <div className="hidden lg:block">
          <ReportsCharts statusData={statusData} deviceData={deviceData} from={selectedFrom} to={selectedTo} />
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 text-sm text-[var(--ink-muted)]">
          Insight: {marginSelected >= 0 ? "Margins are positive for the selected month." : "Margins are negative for the selected month."} Download detailed CSV packs from <Link href={reportHref} className="text-[var(--brand)] hover:underline">Reports</Link>.
        </div>
      </div>
    );
  }

  if (user.role === "OPS") {
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

    const [completedThisMonth, pendingBilling, externalCompleted] = await Promise.all([
      prisma.job.findMany({
        where: { status: "COMPLETED", completedAt: { gte: selectedRange.start, lte: selectedRange.end } },
        select: { id: true, jobNumber: true, completedAt: true },
      }),
      prisma.job.count({
        where: {
          status: { in: ["IN_REPAIR", "READY_FOR_PICKUP", "DELIVERED", "AWAITING_APPROVAL"] },
        },
      }),
      prisma.job.findMany({
        where: {
          status: "COMPLETED",
          repairPath: "EXTERNAL",
          assignedTo: { is: { role: "TECHNICIAN_EXTERNAL" } },
        },
        select: { id: true, externalTechBill: true },
      }),
    ]);

    const completedRows = await prisma.job.findMany({
      where: { id: { in: completedThisMonth.map((job) => job.id) } },
    });
    const monthRevenue = completedRows.reduce((sum, job) => sum + (getClientBill(job) ?? 0), 0);

    const payoutMap = await getJobPayoutsByIds(externalCompleted.map((job) => job.id));
    const payoutOutstanding = externalCompleted
      .filter((job) => !payoutMap.get(job.id)?.externalPaid)
      .reduce((sum, job) => sum + (payoutMap.get(job.id)?.externalTechFee ?? job.externalTechBill ?? 0), 0);

    return (
      <div className="space-y-5">
        <DashboardPeriodBar
          period={period}
          monthHref={`/dashboard?period=month&month=${monthLabel(new Date().getFullYear(), new Date().getMonth() + 1)}`}
          yearHref={`/dashboard?period=year&year=${new Date().getFullYear()}`}
          selectorName={period === "year" ? "year" : "month"}
          selectorValue={selectedPeriodLabel}
          selectorOptions={selectablePeriods}
        />

        <DashboardHero
          title="Operations Billing Monitor"
          summary="Use this workspace to close billing loops, coordinate payout checks, and keep completion flow moving without backlog."
          primaryHref={reportHref}
          primaryLabel="Open Reports"
          secondaryHref="/jobs?status=IN_REPAIR,READY_FOR_PICKUP,AWAITING_APPROVAL"
          secondaryLabel="Open Pending Billing"
        />

        <StickyKpiRow
          items={[
            { label: "Revenue", value: formatMoney(monthRevenue, currency), href: "/reports" },
            { label: "Completed", value: String(completedThisMonth.length), href: "/jobs?status=COMPLETED", tone: "success" },
            { label: "Pending", value: String(pendingBilling), href: "/jobs?status=IN_REPAIR,READY_FOR_PICKUP,AWAITING_APPROVAL", tone: "warning" },
            { label: "Payouts", value: formatMoney(payoutOutstanding, currency), href: "/reports", tone: "brand" },
          ]}
        />

        <div className="hidden gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-4">
          <Link href={reportHref} className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Revenue ({selectedPeriodLabel})</p>
            <p className="mt-2 text-3xl font-semibold">{formatMoney(monthRevenue, currency)}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Open reports →</p>
          </Link>
          <Link href="/jobs?status=COMPLETED" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Completed ({selectedPeriodLabel})</p>
            <p className="mt-2 text-3xl font-semibold text-[#D4AF37] sm:text-4xl">{completedThisMonth.length}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Review completed jobs →</p>
          </Link>
          <Link href="/jobs?status=IN_REPAIR,READY_FOR_PICKUP,AWAITING_APPROVAL" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Pending billing path</p>
            <p className="mt-2 text-3xl font-semibold text-[#D4AF37] sm:text-4xl">{pendingBilling}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Jobs before completion →</p>
          </Link>
          <Link href={reportHref} className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">External payouts due</p>
            <p className="mt-2 text-3xl font-semibold text-black">{formatMoney(payoutOutstanding, currency)}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Track payouts →</p>
          </Link>
        </div>
      </div>
    );
  }

  if (user.role === "INTAKE") {
    const selectedMonth = parseMonth(filters.month);
    const selectedYear = Number(filters.year) || new Date().getFullYear();
    const selectedRange = period === "year" ? yearRange(selectedYear) : monthRange(selectedMonth.year, selectedMonth.month);
    const selectedPeriodLabel = period === "year" ? String(selectedYear) : monthLabel(selectedMonth.year, selectedMonth.month);
    const selectablePeriods = period === "year" ? yearOptions(6) : monthOptions(18);

    const [capturedThisMonth, openFromIntake, awaitingApproval, readyForPickup] = await Promise.all([
      prisma.job.count({
        where: {
          createdById: session.user.id,
          receivedAt: { gte: selectedRange.start, lte: selectedRange.end },
        },
      }),
      prisma.job.count({
        where: {
          createdById: session.user.id,
          status: {
            in: [
              "RECEIVED",
              "DIAGNOSING",
              "PENDING_EXTERNAL_ASSIGNMENT",
              "ASSIGNED_ONE_TIME_EXTERNAL",
              "IN_EXTERNAL_REPAIR",
              "WAITING_FOR_PARTS",
              "RETURNED_FROM_EXTERNAL",
              "AWAITING_APPROVAL",
              "IN_REPAIR",
              "READY_FOR_PICKUP",
              "DELIVERED",
            ],
          },
        },
      }),
      prisma.job.count({ where: { status: "AWAITING_APPROVAL" } }),
      prisma.job.count({ where: { status: "READY_FOR_PICKUP" } }),
    ]);

    return (
      <div className="space-y-3 sm:space-y-5">
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
          summary="Capture requests quickly, keep client communication consistent, and move each intake through approval to handover."
          primaryHref="/jobs/new"
          primaryLabel="Capture New Job"
          secondaryHref="/jobs?status=AWAITING_APPROVAL"
          secondaryLabel="Open Approval Queue"
        />

        <div className="hidden lg:block">
          <RepairStatusReference
            title="Intake to Delivery Flow"
            guidance="Keep this sequence in view when briefing clients so status updates are clear and consistent."
          />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:hidden">
          <Link href="/jobs/new" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-center transition hover:-translate-y-[1px]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Captured</p>
            <p className="mt-1 text-3xl font-semibold">{capturedThisMonth}</p>
            <p className="mt-1 text-[11px] font-medium text-[var(--brand)]">New intake →</p>
          </Link>
          <Link href="/jobs?status=RECEIVED,DIAGNOSING,AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-center transition hover:-translate-y-[1px]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Open</p>
            <p className="mt-1 text-3xl font-semibold text-[var(--brand)]">{openFromIntake}</p>
            <p className="mt-1 text-[11px] font-medium text-[var(--brand)]">In progress →</p>
          </Link>
          <Link href="/jobs?status=AWAITING_APPROVAL" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-center transition hover:-translate-y-[1px]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Approval</p>
            <p className="mt-1 text-3xl font-semibold text-[#D4AF37]">{awaitingApproval}</p>
            <p className="mt-1 text-[11px] font-medium text-[var(--brand)]">Follow up →</p>
          </Link>
          <Link href="/jobs?status=READY_FOR_PICKUP" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-center transition hover:-translate-y-[1px]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Ready</p>
            <p className="mt-1 text-3xl font-semibold text-[#D4AF37]">{readyForPickup}</p>
            <p className="mt-1 text-[11px] font-medium text-[var(--brand)]">Pickup →</p>
          </Link>
        </div>

        <div className="hidden gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-4">
          <Link href="/jobs/new" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Captured ({selectedPeriodLabel})</p>
            <p className="mt-2 text-3xl font-semibold sm:text-4xl">{capturedThisMonth}</p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">Jobs registered by front desk intake</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Open intake form →</p>
          </Link>
          <Link href="/jobs?status=RECEIVED,DIAGNOSING,AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Open client queue</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--brand)] sm:text-4xl">{openFromIntake}</p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">Jobs still in progress after intake</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">View open jobs →</p>
          </Link>
          <Link href="/jobs?status=AWAITING_APPROVAL" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Awaiting approval</p>
            <p className="mt-2 text-3xl font-semibold text-[#D4AF37] sm:text-4xl">{awaitingApproval}</p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">Follow up with clients for decisions</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Open approval queue →</p>
          </Link>
          <Link href="/jobs?status=READY_FOR_PICKUP" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Ready for pickup</p>
            <p className="mt-2 text-3xl font-semibold text-[#D4AF37] sm:text-4xl">{readyForPickup}</p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">Clients to notify for collection</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Open pickup list →</p>
          </Link>
        </div>
      </div>
    );
  }

  const [totalJobs, openJobs, completedJobs] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({
      where: {
        status: {
          in: [
            "RECEIVED",
            "DIAGNOSING",
            "PENDING_EXTERNAL_ASSIGNMENT",
            "ASSIGNED_ONE_TIME_EXTERNAL",
            "IN_EXTERNAL_REPAIR",
            "WAITING_FOR_PARTS",
            "RETURNED_FROM_EXTERNAL",
            "IN_REPAIR",
            "READY_FOR_PICKUP",
            "DELIVERED",
            "AWAITING_APPROVAL",
          ],
        },
      },
    }),
    prisma.job.count({ where: { status: "COMPLETED" } }),
  ]);

    return (
      <div className="space-y-4">
      <DashboardHero
        title="System Overview"
        summary="Use this overview to orient team focus, then open the queue and reporting workspaces for deeper action."
        primaryHref="/jobs"
        primaryLabel="Open Jobs"
        secondaryHref="/reports"
        secondaryLabel="Open Reports"
      />

      <StickyKpiRow
        items={[
          { label: "Total", value: String(totalJobs), href: "/jobs" },
          { label: "Open", value: String(openJobs), href: "/jobs?status=RECEIVED,DIAGNOSING,AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP", tone: "brand" },
          { label: "Completed", value: String(completedJobs), href: "/jobs?status=COMPLETED", tone: "success" },
        ]}
      />

      <div className="hidden gap-3 lg:grid lg:grid-cols-3">
        <Link href="/jobs" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Total Jobs</p>
          <p className="mt-2 text-3xl font-semibold sm:text-4xl">{totalJobs}</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">All time recorded repairs</p>
          <p className="mt-3 text-xs font-medium text-[var(--brand)]">View all jobs →</p>
        </Link>
        <Link
          href="/jobs?status=RECEIVED,DIAGNOSING,AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP"
          className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Open Jobs</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--brand)] sm:text-4xl">{openJobs}</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Awaiting active team action</p>
          <p className="mt-3 text-xs font-medium text-[var(--brand)]">View open queue →</p>
        </Link>
        <Link
          href="/jobs?status=COMPLETED"
          className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-[2px] sm:p-5"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Completed</p>
          <p className="mt-2 text-3xl font-semibold text-[#D4AF37] sm:text-4xl">{completedJobs}</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Delivered successfully</p>
          <p className="mt-3 text-xs font-medium text-[var(--brand)]">View completed jobs →</p>
        </Link>
      </div>
    </div>
  );
}
