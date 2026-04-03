import Link from "next/link";

import { ReportsCharts } from "@/components/reports/ReportsCharts";
import { MonthSelectForm } from "@/components/shared/MonthSelectForm";
import { getClientBill, getExternalTechBill } from "@/lib/billing";
import { formatMoney, getAppCurrency } from "@/lib/currency";
import { JOB_STATUSES, JobStatus } from "@/lib/job-status";
import { getJobPayoutsByIds } from "@/lib/payouts";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

type SearchParams = {
  month?: string;
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

function monthLabel(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthOptions(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = monthLabel(date.getFullYear(), date.getMonth() + 1);
    const label = date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    return { value, label };
  });
}

const statusLabel: Record<JobStatus, string> = {
  RECEIVED: "Received",
  DIAGNOSING: "Diagnosing",
  AWAITING_APPROVAL: "Awaiting Approval",
  IN_REPAIR: "In Repair",
  READY_FOR_PICKUP: "Ready for Pickup",
  COMPLETED: "Completed",
  CLOSED: "Closed",
};

const deviceLabel: Record<string, string> = {
  PHONE_ANDROID: "Android Phone",
  PHONE_IPHONE: "iPhone",
  TABLET: "Tablet",
  WINDOWS_PC: "Windows PC",
  MAC: "Mac",
  OTHER: "Other",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { session, user } = await getCurrentUserRole();
  const filters = await searchParams;

  if (user.role === "TECHNICIAN_EXTERNAL") {
    const jobs = await prisma.job.findMany({
      where: { assignedToId: session.user.id },
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
    const openCount = jobs.filter((job) => ["RECEIVED", "DIAGNOSING", "AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"].includes(job.status)).length;
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
        <div className="grid gap-4 md:grid-cols-4">
          <Link href="/technicians" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Assigned Jobs</p>
            <p className="mt-2 text-4xl font-semibold">{jobs.length}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Open queue →</p>
          </Link>
          <Link href="/technicians?ready=1" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Open Jobs</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--brand)]">{openCount}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Jobs needing action →</p>
          </Link>
          <Link href="/jobs?status=COMPLETED" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Completed</p>
            <p className="mt-2 text-4xl font-semibold text-emerald-700">{completedCount}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Completed jobs →</p>
          </Link>
          <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Payout Outstanding</p>
            <p className="mt-2 text-3xl font-semibold text-amber-700">{formatMoney(outstandingTotal, currency)}</p>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">Paid to date: {formatMoney(paidTotal, currency)}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">
              <Link href="/technicians/payouts">View payout breakdown →</Link>
            </p>
          </div>
        </div>

        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-sm font-semibold">Recent Assigned Jobs</p>
          {jobs.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No assigned jobs yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {jobs.slice(0, 6).map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{job.jobNumber}</p>
                    <p className="text-xs text-[var(--ink-muted)]">{job.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--ink-muted)]">Fee</p>
                    <p className="font-medium">{formatMoney(payouts.get(job.id)?.externalTechFee ?? 0, currency)}</p>
                    <p className={`text-xs ${payouts.get(job.id)?.externalPaid ? "text-emerald-700" : "text-amber-700"}`}>
                      {payouts.get(job.id)?.externalPaid ? "Paid" : "Unpaid"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (user.role === "TECHNICIAN_INTERNAL") {
    const assignedJobs = await prisma.job.findMany({
      where: { assignedToId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, jobNumber: true, status: true, brand: true, model: true },
    });

    const diagnosing = assignedJobs.filter((job) => job.status === "DIAGNOSING").length;
    const inRepair = assignedJobs.filter((job) => job.status === "IN_REPAIR").length;
    const completed = assignedJobs.filter((job) => job.status === "COMPLETED").length;

    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Link href="/jobs" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Assigned</p>
            <p className="mt-2 text-4xl font-semibold">{assignedJobs.length}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">View my jobs →</p>
          </Link>
          <Link href="/jobs?status=DIAGNOSING" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Diagnosing</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--brand)]">{diagnosing}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Needs diagnosis work →</p>
          </Link>
          <Link href="/jobs?status=IN_REPAIR" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">In Repair</p>
            <p className="mt-2 text-4xl font-semibold text-amber-700">{inRepair}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Active repairs →</p>
          </Link>
          <Link href="/jobs?status=COMPLETED" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Completed</p>
            <p className="mt-2 text-4xl font-semibold text-emerald-700">{completed}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Completed repairs →</p>
          </Link>
        </div>

        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-sm font-semibold">Recent Assigned Jobs</p>
          {assignedJobs.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No assigned jobs yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {assignedJobs.slice(0, 6).map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-2">
                  <p className="truncate font-medium">{job.jobNumber} - {job.brand} {job.model}</p>
                  <span className="text-xs text-[var(--ink-muted)]">{job.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (user.role === "ADMIN") {
    const selected = parseMonth(filters.month);
    const selectedRange = monthRange(selected.year, selected.month);
    const prevMonthDate = new Date(selected.year, selected.month - 2, 1);
    const prev = { year: prevMonthDate.getFullYear(), month: prevMonthDate.getMonth() + 1 };
    const prevRange = monthRange(prev.year, prev.month);
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
      openJobs,
      externalCount,
      inHouseCount,
      externalCompleted,
      totalJobs,
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
      prisma.job.findMany({
        where: {
          status: { in: ["RECEIVED", "DIAGNOSING", "AWAITING_APPROVAL", "IN_REPAIR"] },
        },
        select: { jobNumber: true, status: true, receivedAt: true, updatedAt: true },
      }),
      prisma.job.count({ where: { repairPath: "EXTERNAL", receivedAt: { gte: selectedRange.start, lte: selectedRange.end } } }),
      prisma.job.count({ where: { repairPath: "IN_HOUSE", receivedAt: { gte: selectedRange.start, lte: selectedRange.end } } }),
      prisma.job.findMany({
        where: {
          repairPath: "EXTERNAL",
          assignedTo: { is: { role: "TECHNICIAN_EXTERNAL" } },
          status: "COMPLETED",
          completedAt: { gte: selectedRange.start, lte: selectedRange.end },
        },
        select: { id: true },
      }),
      prisma.job.count(),
    ]);

    const openCount = openJobs.length;
    const completedCount = statusGroup.find((s) => s.status === "COMPLETED")?._count.status ?? 0;
    const awaitingApproval = statusGroup.find((s) => s.status === "AWAITING_APPROVAL")?._count.status ?? 0;
    const completedSelectedCount = completedSelected.length;
    const completedPrevCount = completedPrev.length;

    const payoutMap = await getJobPayoutsByIds(externalCompleted.map((job) => job.id));
    const payoutOutstanding = externalCompleted
      .map((job) => payoutMap.get(job.id))
      .filter((row) => row && !row.externalPaid)
      .reduce((sum, row) => sum + (row?.externalTechFee ?? 0), 0);

    const revenueFor = (jobs: typeof completedSelected) => jobs.reduce((sum, job) => sum + (getClientBill(job) ?? 0), 0);
    const revenueSelected = revenueFor(completedSelected);
    const revenuePrev = revenueFor(completedPrev);
    const revenueDelta = revenueSelected - revenuePrev;
    const marginSelected = completedSelected.reduce(
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

    const selectedMonthString = monthLabel(selected.year, selected.month);
    const prevMonthString = monthLabel(prev.year, prev.month);
    const totalPath = inHouseCount + externalCount;
    const externalRatio = totalPath > 0 ? (externalCount / totalPath) * 100 : 0;
    const selectableMonths = monthOptions(18);
    const receivedDelta = receivedSelectedCount - receivedPrevCount;
    const completedDeltaCount = completedSelectedCount - completedPrevCount;
    const closedDelta = closedSelectedCount - closedPrevCount;

    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Link href="/jobs" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Total Jobs (All Time)</p>
            <p className="mt-2 text-4xl font-semibold">{totalJobs}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">View all jobs →</p>
          </Link>
          <Link href="/jobs?status=RECEIVED,DIAGNOSING,AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Open Queue (Now)</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--brand)]">{openCount}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Needs team action →</p>
          </Link>
          <Link href="/jobs?status=COMPLETED" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Completed (All Time)</p>
            <p className="mt-2 text-4xl font-semibold text-emerald-700">{completedCount}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Completed jobs →</p>
          </Link>
          <Link href="/jobs?status=AWAITING_APPROVAL" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Awaiting Approval (Now)</p>
            <p className="mt-2 text-4xl font-semibold text-amber-700">{awaitingApproval}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Client approvals →</p>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Jobs Received ({selectedMonthString})</p>
            <p className="mt-1 text-2xl font-semibold">{receivedSelectedCount}</p>
            <p className={`mt-1 text-xs ${receivedDelta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {receivedDelta >= 0 ? "+" : ""}{receivedDelta} vs {prevMonthString}
            </p>
          </div>
          <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Jobs Completed ({selectedMonthString})</p>
            <p className="mt-1 text-2xl font-semibold">{completedSelectedCount}</p>
            <p className={`mt-1 text-xs ${completedDeltaCount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {completedDeltaCount >= 0 ? "+" : ""}{completedDeltaCount} vs {prevMonthString}
            </p>
          </div>
          <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Jobs Closed ({selectedMonthString})</p>
            <p className="mt-1 text-2xl font-semibold">{closedSelectedCount}</p>
            <p className={`mt-1 text-xs ${closedDelta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {closedDelta >= 0 ? "+" : ""}{closedDelta} vs {prevMonthString}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <MonthSelectForm
            value={selectedMonthString}
            options={selectableMonths}
            className="flex items-center"
            selectClassName="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-sm"
          />
          <Link href={`/reports?month=${selectedMonthString}`} className="btn-premium-secondary rounded-md px-3 py-1.5 text-sm">
            Open Report Downloads
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Revenue ({selectedMonthString})</p>
            <p className="mt-1 text-2xl font-semibold">{formatMoney(revenueSelected, currency)}</p>
            <p className={`mt-1 text-xs ${revenueDelta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{revenueDelta >= 0 ? "+" : "-"}{formatMoney(Math.abs(revenueDelta), currency)} vs {prevMonthString}</p>
          </div>
          <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Repair Margin</p>
            <p className={`mt-1 text-2xl font-semibold ${marginSelected >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatMoney(marginSelected, currency)}</p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">Margin rate {marginRate.toFixed(1)}%</p>
          </div>
          <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">External Ratio</p>
            <p className="mt-1 text-2xl font-semibold">{externalRatio.toFixed(0)}%</p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">{externalCount} external / {inHouseCount} in-house ({selectedMonthString})</p>
          </div>
          <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">External Payouts Due</p>
            <p className="mt-1 text-2xl font-semibold text-rose-700">{formatMoney(payoutOutstanding, currency)}</p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">Unpaid completed external jobs ({selectedMonthString})</p>
          </div>
        </div>

        <ReportsCharts statusData={statusData} deviceData={deviceData} />

        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 text-sm text-[var(--ink-muted)]">
          Insight: {marginSelected >= 0 ? "Margins are positive for the selected month." : "Margins are negative for the selected month."} Download detailed CSV packs from <Link href={`/reports?month=${selectedMonthString}`} className="text-[var(--brand)] hover:underline">Reports</Link>.
        </div>
      </div>
    );
  }

  if (user.role === "OPS") {
    const currency = getAppCurrency();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [completedThisMonth, pendingBilling, externalCompleted] = await Promise.all([
      prisma.job.findMany({
        where: { status: "COMPLETED", completedAt: { gte: monthStart, lte: monthEnd } },
        select: { id: true, jobNumber: true, completedAt: true },
      }),
      prisma.job.count({
        where: {
          status: { in: ["IN_REPAIR", "READY_FOR_PICKUP", "AWAITING_APPROVAL"] },
        },
      }),
      prisma.job.findMany({
        where: {
          status: "COMPLETED",
          repairPath: "EXTERNAL",
          assignedTo: { is: { role: "TECHNICIAN_EXTERNAL" } },
        },
        select: { id: true },
      }),
    ]);

    const completedRows = await prisma.job.findMany({
      where: { id: { in: completedThisMonth.map((job) => job.id) } },
    });
    const monthRevenue = completedRows.reduce((sum, job) => sum + (getClientBill(job) ?? 0), 0);

    const payoutMap = await getJobPayoutsByIds(externalCompleted.map((job) => job.id));
    const payoutOutstanding = externalCompleted
      .map((job) => payoutMap.get(job.id))
      .filter((row) => row && !row.externalPaid)
      .reduce((sum, row) => sum + (row?.externalTechFee ?? 0), 0);

    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Link href="/reports" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Revenue this month</p>
            <p className="mt-2 text-3xl font-semibold">{formatMoney(monthRevenue, currency)}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Open reports →</p>
          </Link>
          <Link href="/jobs?status=COMPLETED" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Completed this month</p>
            <p className="mt-2 text-4xl font-semibold text-emerald-700">{completedThisMonth.length}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Review completed jobs →</p>
          </Link>
          <Link href="/jobs?status=IN_REPAIR,READY_FOR_PICKUP,AWAITING_APPROVAL" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Pending billing path</p>
            <p className="mt-2 text-4xl font-semibold text-amber-700">{pendingBilling}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Jobs before completion →</p>
          </Link>
          <Link href="/reports" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">External payouts due</p>
            <p className="mt-2 text-3xl font-semibold text-rose-700">{formatMoney(payoutOutstanding, currency)}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Track payouts →</p>
          </Link>
        </div>
      </div>
    );
  }

  const [totalJobs, openJobs, completedJobs] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({ where: { status: { in: ["RECEIVED", "DIAGNOSING", "IN_REPAIR", "READY_FOR_PICKUP", "AWAITING_APPROVAL"] } } }),
    prisma.job.count({ where: { status: "COMPLETED" } }),
  ]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/jobs" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Total Jobs</p>
          <p className="mt-2 text-4xl font-semibold">{totalJobs}</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">All time recorded repairs</p>
          <p className="mt-3 text-xs font-medium text-[var(--brand)]">View all jobs →</p>
        </Link>
        <Link
          href="/jobs?status=RECEIVED,DIAGNOSING,AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP"
          className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Open Jobs</p>
          <p className="mt-2 text-4xl font-semibold text-[var(--brand)]">{openJobs}</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Awaiting active team action</p>
          <p className="mt-3 text-xs font-medium text-[var(--brand)]">View open queue →</p>
        </Link>
        <Link
          href="/jobs?status=COMPLETED"
          className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Completed</p>
          <p className="mt-2 text-4xl font-semibold text-emerald-700">{completedJobs}</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Delivered successfully</p>
          <p className="mt-3 text-xs font-medium text-[var(--brand)]">View completed jobs →</p>
        </Link>
      </div>
    </div>
  );
}
