import Link from "next/link";
import { JobStatus } from "@prisma/client";
import { redirect } from "next/navigation";

import { ReportsCharts } from "@/components/reports/ReportsCharts";
import { getClientBill, getExternalTechBill } from "@/lib/billing";
import { formatMoney, getAppCurrency } from "@/lib/currency";
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

const statusLabel: Record<JobStatus, string> = {
  RECEIVED: "Received",
  DIAGNOSING: "Diagnosing",
  REFERRED: "Referred",
  AWAITING_APPROVAL: "Awaiting Approval",
  IN_REPAIR: "In Repair",
  COMPLETED: "Completed",
  CLOSED: "Closed",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user } = await getCurrentUserRole();
  if (!(user.role === "ADMIN" || user.role === "ACCOUNTS")) {
    redirect("/dashboard");
  }

  const filters = await searchParams;
  const selected = parseMonth(filters.month);
  const selectedRange = monthRange(selected.year, selected.month);
  const prevMonthDate = new Date(selected.year, selected.month - 2, 1);
  const prev = { year: prevMonthDate.getFullYear(), month: prevMonthDate.getMonth() + 1 };
  const prevRange = monthRange(prev.year, prev.month);

  const [
    statusGroup,
    deviceGroup,
    completedAll,
    completedSelected,
    completedPrev,
    openJobs,
    externalCount,
    inHouseCount,
    externalPayoutOutstandingJobs,
  ] = await Promise.all([
    prisma.job.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.job.groupBy({ by: ["deviceType"], _count: { deviceType: true } }),
    prisma.job.findMany({ where: { status: "COMPLETED" } }),
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
    prisma.job.findMany({
      where: {
        status: { in: ["RECEIVED", "DIAGNOSING", "REFERRED", "AWAITING_APPROVAL", "IN_REPAIR"] },
      },
      select: { jobNumber: true, status: true, receivedAt: true, updatedAt: true },
    }),
    prisma.job.count({ where: { repairPath: "EXTERNAL" } }),
    prisma.job.count({ where: { repairPath: "IN_HOUSE" } }),
    prisma.job.findMany({
      where: {
        repairPath: "EXTERNAL",
        status: "COMPLETED",
      },
      select: { id: true },
    }),
  ]);

  const externalPayoutMap = await getJobPayoutsByIds(externalPayoutOutstandingJobs.map((job) => job.id));
  const unpaidPayouts = externalPayoutOutstandingJobs
    .map((job) => externalPayoutMap.get(job.id))
    .filter((payout): payout is NonNullable<typeof payout> => Boolean(payout && !payout.externalPaid && payout.externalTechFee != null));

  const externalPayoutOutstandingCount = unpaidPayouts.length;
  const externalPayoutOutstandingTotal = unpaidPayouts.reduce((sum, payout) => sum + (payout.externalTechFee ?? 0), 0);

  const statusCount = new Map(statusGroup.map((s) => [s.status, s._count.status]));
  const statusData = (Object.values(JobStatus) as JobStatus[]).map((status) => ({
    key: status,
    name: statusLabel[status],
    value: statusCount.get(status) ?? 0,
  }));
  const deviceData = deviceGroup.map((d) => ({ name: d.deviceType, value: d._count.deviceType }));

  const revenueFor = (jobs: typeof completedSelected) =>
    jobs.reduce((sum, job) => sum + (getClientBill(job) ?? 0), 0);
  const revenueSelected = revenueFor(completedSelected);
  const revenuePrev = revenueFor(completedPrev);
  const revenueDelta = revenueSelected - revenuePrev;
  const marginSelected = completedSelected.reduce(
    (sum, job) => sum + ((getClientBill(job) ?? 0) - (getExternalTechBill(job) ?? 0)),
    0,
  );
  const marginRate = revenueSelected > 0 ? (marginSelected / revenueSelected) * 100 : 0;

  const averageRepairTimeHours = (() => {
    const values = completedAll
      .filter((job) => job.completedAt)
      .map((job) => (job.completedAt!.getTime() - job.receivedAt.getTime()) / 36e5);
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  })();

  const commonFaults = (() => {
    const source = completedAll
      .map((job) => `${job.diagnosisNotes ?? ""} ${job.externalDiagnosis ?? ""}`.toLowerCase())
      .join(" ");
    const tokens = source
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 4 && !["there", "about", "their", "after", "before", "issue"].includes(word));
    const freq = new Map<string, number>();
    for (const token of tokens) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  })();

  const topDevices = [...deviceData].sort((a, b) => b.value - a.value).slice(0, 5);
  const totalPath = inHouseCount + externalCount;
  const externalRatio = totalPath > 0 ? (externalCount / totalPath) * 100 : 0;

  const now =
    openJobs.length > 0
      ? Math.max(...openJobs.map((job) => job.updatedAt.getTime()))
      : selectedRange.end.getTime();
  const agingByStatus = new Map<string, { threeToSeven: number; eightPlus: number }>();
  const delayedJobs = openJobs
    .map((job) => {
      const ageDays = Math.floor((now - job.receivedAt.getTime()) / (1000 * 60 * 60 * 24));
      return { ...job, ageDays };
    })
    .filter((job) => job.ageDays >= 3)
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 6);

  for (const job of openJobs) {
    const ageDays = Math.floor((now - job.receivedAt.getTime()) / (1000 * 60 * 60 * 24));
    const current = agingByStatus.get(job.status) ?? { threeToSeven: 0, eightPlus: 0 };
    if (ageDays >= 3 && ageDays <= 7) current.threeToSeven += 1;
    if (ageDays >= 8) current.eightPlus += 1;
    agingByStatus.set(job.status, current);
  }

  const agingRows = [...agingByStatus.entries()]
    .map(([status, buckets]) => ({ status, ...buckets }))
    .filter((row) => row.threeToSeven > 0 || row.eightPlus > 0)
    .sort((a, b) => b.eightPlus - a.eightPlus || b.threeToSeven - a.threeToSeven);

  const funnel = {
    referred: statusData.find((s) => s.key === "REFERRED")?.value ?? 0,
    awaitingApproval: statusData.find((s) => s.key === "AWAITING_APPROVAL")?.value ?? 0,
    inRepair: statusData.find((s) => s.key === "IN_REPAIR")?.value ?? 0,
    completed: statusData.find((s) => s.key === "COMPLETED")?.value ?? 0,
  };

  const selectedMonthString = monthLabel(selected.year, selected.month);
  const prevMonthString = monthLabel(prev.year, prev.month);
  const currency = getAppCurrency();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-[var(--ink-muted)]">Operational and financial insights for repair performance.</p>
        </div>
        <form className="flex items-center gap-2">
          <input
            type="month"
            name="month"
            defaultValue={selectedMonthString}
            className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-sm"
          />
          <button className="rounded-md border border-[var(--line)] bg-white px-3 py-1 text-sm">Go</button>
        </form>
      </div>

      <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
        <p className="mb-2 text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Export</p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/reports/export?type=pipeline-aging"
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm hover:border-[var(--brand)]"
          >
            Pipeline Aging CSV
          </a>
          <a
            href={`/api/reports/export?type=revenue-variance&month=${selectedMonthString}`}
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm hover:border-[var(--brand)]"
          >
            Repair Margin CSV
          </a>
          <a
            href="/api/reports/export?type=technician-performance"
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm hover:border-[var(--brand)]"
          >
            Technician Performance CSV
          </a>
          <a
            href="/api/reports/export?type=external-payouts"
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm hover:border-[var(--brand)]"
          >
            External Payouts CSV
          </a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-6">
        <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Revenue ({selectedMonthString})</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(revenueSelected, currency)}</p>
          <p className={`mt-1 text-xs ${revenueDelta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {revenueDelta >= 0 ? "+" : "-"}{formatMoney(Math.abs(revenueDelta), currency)} vs {prevMonthString}
          </p>
        </div>
        <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Repair margin ({selectedMonthString})</p>
          <p className={`mt-1 text-2xl font-semibold ${marginSelected >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {formatMoney(marginSelected, currency)}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">Margin rate {marginRate.toFixed(1)}%</p>
        </div>
        <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Completed jobs</p>
          <p className="mt-1 text-2xl font-semibold">{completedSelected.length}</p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">In selected month</p>
        </div>
        <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Avg repair time</p>
          <p className="mt-1 text-2xl font-semibold">{averageRepairTimeHours.toFixed(1)}h</p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">Across all completed jobs</p>
        </div>
        <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">External ratio</p>
          <p className="mt-1 text-2xl font-semibold">{externalRatio.toFixed(0)}%</p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">{externalCount} external / {inHouseCount} in-house</p>
        </div>
        <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">External payouts due</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(externalPayoutOutstandingTotal, currency)}</p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">{externalPayoutOutstandingCount} completed external jobs unpaid</p>
        </div>
      </div>

      <ReportsCharts statusData={statusData} deviceData={deviceData} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 lg:col-span-2">
          <p className="mb-2 text-sm font-semibold">Most Common Fault Keywords</p>
          {commonFaults.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No diagnosis text available yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {commonFaults.map(([word, count]) => (
                <span key={word} className="rounded-full bg-[var(--panel-strong)] px-3 py-1 text-sm text-[var(--ink)]">
                  {word} ({count})
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-sm font-semibold">Top Device Types</p>
          <ul className="space-y-1 text-sm">
            {topDevices.map((item) => (
              <li key={item.name} className="flex items-center justify-between">
                <span>{item.name}</span>
                <span className="font-semibold">{item.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-sm font-semibold">Aging Alerts (Open Jobs)</p>
          {agingRows.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No aging alerts. Open queue is healthy.</p>
          ) : (
            <div className="space-y-2">
              {agingRows.map((row) => (
                <div key={row.status} className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm">
                  <p className="font-medium">{row.status}</p>
                  <p className="text-[var(--ink-muted)]">3-7 days: {row.threeToSeven} • 8+ days: {row.eightPlus}</p>
                </div>
              ))}
              {delayedJobs.length > 0 ? (
                <div className="pt-1 text-xs text-[var(--ink-muted)]">
                  Oldest jobs: {delayedJobs.map((job) => `${job.jobNumber} (${job.ageDays}d)`).join(", ")}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-sm font-semibold">Approval Funnel</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <span>Referred</span>
              <span className="font-semibold">{funnel.referred}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <span>Awaiting approval</span>
              <span className="font-semibold">{funnel.awaitingApproval}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <span>In repair</span>
              <span className="font-semibold">{funnel.inRepair}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <span>Completed</span>
              <span className="font-semibold text-emerald-700">{funnel.completed}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 text-sm text-[var(--ink-muted)]">
        Insight: {marginSelected >= 0 ? "Margins are positive for the selected month." : "Margins are negative for the selected month."} Use
        {" "}
        <Link href={`/api/reports/export?type=revenue-variance&month=${selectedMonthString}`} className="text-[var(--brand)] hover:underline">
          Repair Margin CSV
        </Link>
        {" "}
        to investigate client bill vs external tech bill variance.
      </div>
    </div>
  );
}
