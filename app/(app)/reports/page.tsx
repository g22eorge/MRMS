import Link from "next/link";
import { redirect } from "next/navigation";

import { PersistedDisclosure } from "@/components/mobile/PersistedDisclosure";
import { StickyKpiRow } from "@/components/mobile/StickyKpiRow";
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

function monthSequence(endYear: number, endMonth: number, count: number) {
  return Array.from({ length: count }, (_, idx) => {
    const d = new Date(endYear, endMonth - 1 - (count - 1 - idx), 1);
    return {
      key: monthLabel(d.getFullYear(), d.getMonth() + 1),
      start: new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  });
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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = await searchParams;
  const { user } = await getCurrentUserRole();
  if (user.role !== "ADMIN" && user.role !== "OPS") {
    redirect("/dashboard");
  }

  const selected = parseMonth(filters.month);
  const selectedRange = monthRange(selected.year, selected.month);
  const prevMonthDate = new Date(selected.year, selected.month - 2, 1);
  const prev = { year: prevMonthDate.getFullYear(), month: prevMonthDate.getMonth() + 1 };
  const prevRange = monthRange(prev.year, prev.month);

  const [
    statusGroup,
    completedAll,
    completedSelected,
    completedPrev,
    openJobs,
    externalCount,
    inHouseCount,
    externalPayoutOutstandingJobs,
  ] = await Promise.all([
    prisma.job.groupBy({ by: ["status"], _count: { status: true } }),
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
        status: { in: ["RECEIVED", "DIAGNOSING", "AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"] },
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
  ]);

  const externalPayoutMap = await getJobPayoutsByIds(externalPayoutOutstandingJobs.map((job) => job.id));
  const unpaidPayouts = externalPayoutOutstandingJobs
    .map((job) => externalPayoutMap.get(job.id))
    .filter((payout): payout is NonNullable<typeof payout> => Boolean(payout && !payout.externalPaid && payout.externalTechFee != null));

  const externalPayoutOutstandingCount = unpaidPayouts.length;
  const externalPayoutOutstandingTotal = unpaidPayouts.reduce((sum, payout) => sum + (payout.externalTechFee ?? 0), 0);

  const statusCount = new Map(statusGroup.map((s) => [s.status, s._count.status]));
  const statusData = JOB_STATUSES.map((status) => ({
    key: status,
    name: statusLabel[status],
    value: statusCount.get(status) ?? 0,
  }));

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
    diagnosing: statusData.find((s) => s.key === "DIAGNOSING")?.value ?? 0,
    awaitingApproval: statusData.find((s) => s.key === "AWAITING_APPROVAL")?.value ?? 0,
    inRepair: statusData.find((s) => s.key === "IN_REPAIR")?.value ?? 0,
    readyForPickup: statusData.find((s) => s.key === "READY_FOR_PICKUP")?.value ?? 0,
    completed: statusData.find((s) => s.key === "COMPLETED")?.value ?? 0,
  };

  const selectedMonthString = monthLabel(selected.year, selected.month);
  const prevMonthString = monthLabel(prev.year, prev.month);
  const currency = getAppCurrency();
  const selectableMonths = monthOptions(18);
  const trendMonths = monthSequence(selected.year, selected.month, 6);

  const trendJobs = await prisma.job.findMany({
    where: {
      receivedAt: {
        gte: trendMonths[0].start,
        lte: trendMonths[trendMonths.length - 1].end,
      },
    },
    select: {
      deviceType: true,
      receivedAt: true,
    },
  });

  const trendByDevice = new Map<string, Map<string, number>>();
  for (const job of trendJobs) {
    const device = deviceLabel[job.deviceType] ?? job.deviceType;
    const key = monthLabel(job.receivedAt.getFullYear(), job.receivedAt.getMonth() + 1);
    const monthMap = trendByDevice.get(device) ?? new Map<string, number>();
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
    trendByDevice.set(device, monthMap);
  }

  const jobsInSelectedMonth = await prisma.job.findMany({
    where: {
      receivedAt: { gte: selectedRange.start, lte: selectedRange.end },
    },
    select: {
      deviceType: true,
      status: true,
      receivedAt: true,
      completedAt: true,
      repairPath: true,
      assignedTo: { select: { name: true } },
      externalTechBill: true,
      clientBill: true,
    },
  });

  const deviceInsights = (() => {
    const map = new Map<
      string,
      {
        total: number;
        open: number;
        completed: number;
        cancelledOrClosed: number;
        ext: number;
        inHouse: number;
        turnaroundHoursSum: number;
        turnaroundCount: number;
        revenue: number;
        margin: number;
        techFreq: Map<string, number>;
      }
    >();

    const ensure = (device: string) => {
      const existing = map.get(device);
      if (existing) return existing;
      const created = {
        total: 0,
        open: 0,
        completed: 0,
        cancelledOrClosed: 0,
        ext: 0,
        inHouse: 0,
        turnaroundHoursSum: 0,
        turnaroundCount: 0,
        revenue: 0,
        margin: 0,
        techFreq: new Map<string, number>(),
      };
      map.set(device, created);
      return created;
    };

    for (const job of jobsInSelectedMonth) {
      const bucket = ensure(deviceLabel[job.deviceType] ?? job.deviceType);
      bucket.total += 1;
      if (["RECEIVED", "DIAGNOSING", "AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"].includes(job.status)) {
        bucket.open += 1;
      }
      if (job.status === "COMPLETED") {
        bucket.completed += 1;
        if (job.completedAt) {
          bucket.turnaroundHoursSum += (job.completedAt.getTime() - job.receivedAt.getTime()) / 36e5;
          bucket.turnaroundCount += 1;
        }
        const clientBill = getClientBill(job) ?? 0;
        const extBill = getExternalTechBill(job) ?? 0;
        bucket.revenue += clientBill;
        bucket.margin += clientBill - extBill;
      }
      if (job.status === "CLOSED") {
        bucket.cancelledOrClosed += 1;
      }
      if (job.repairPath === "EXTERNAL") bucket.ext += 1;
      if (job.repairPath === "IN_HOUSE") bucket.inHouse += 1;
      if (job.assignedTo?.name) {
        bucket.techFreq.set(job.assignedTo.name, (bucket.techFreq.get(job.assignedTo.name) ?? 0) + 1);
      }
    }

    return [...map.entries()]
      .map(([device, value]) => ({
        device,
        total: value.total,
        completed: value.completed,
        open: value.open,
        cancelledOrClosed: value.cancelledOrClosed,
        completionRate: value.total > 0 ? (value.completed / value.total) * 100 : 0,
        avgTurnaroundHours: value.turnaroundCount > 0 ? value.turnaroundHoursSum / value.turnaroundCount : 0,
        revenue: value.revenue,
        margin: value.margin,
        avgMarginPerCompleted: value.completed > 0 ? value.margin / value.completed : 0,
        ext: value.ext,
        inHouse: value.inHouse,
        topTech: [...value.techFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-",
        trend: trendMonths.map((m) => trendByDevice.get(device)?.get(m.key) ?? 0),
      }))
      .sort((a, b) => b.total - a.total);
  })();

  const topDevices = deviceInsights.slice(0, 5).map((item) => ({ name: item.device, value: item.total }));
  const queuePressure = funnel.diagnosing + funnel.awaitingApproval + funnel.inRepair;
  const completionMomentum = completedSelected.length - completedPrev.length;

  const exportItems = [
    {
      title: "Pipeline Aging",
      caption: "Queue delay risk by status bands",
      href: "/api/reports/export?type=pipeline-aging",
    },
    {
      title: "Repair Margin",
      caption: "Job-level client bill vs technician cost",
      href: `/api/reports/export?type=revenue-variance&month=${selectedMonthString}`,
    },
    {
      title: "Technician Performance",
      caption: "Throughput and completion mix per technician",
      href: "/api/reports/export?type=technician-performance",
    },
    {
      title: "External Payouts",
      caption: "Outstanding and paid external technician fees",
      href: "/api/reports/export?type=external-payouts",
    },
    {
      title: "Device Performance",
      caption: "Device type completion, margin, and trend",
      href: `/api/reports/export?type=device-performance&month=${selectedMonthString}`,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-end gap-3">
        <MonthSelectForm
          value={selectedMonthString}
          options={selectableMonths}
          className="flex items-center"
          selectClassName="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-sm"
        />
      </div>

      <StickyKpiRow
        items={[
          { label: "Revenue", value: formatMoney(revenueSelected, currency), tone: "brand" },
          { label: "Margin", value: formatMoney(marginSelected, currency), tone: marginSelected >= 0 ? "success" : "warning" },
          { label: "Completed", value: String(completedSelected.length), tone: "success" },
          { label: "Payouts", value: formatMoney(externalPayoutOutstandingTotal, currency), tone: "warning" },
        ]}
      />

      <PersistedDisclosure
        title="Report Export Center"
        defaultOpen
        storageKey="reports.exportCenter"
        groupName="reports-mobile-sections"
        className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:hidden"
      >
        <div className="grid gap-2">
          {exportItems.map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="rounded-lg border border-[var(--line)] bg-white p-3"
            >
              <p className="text-sm font-semibold text-[var(--ink)]">{item.title}</p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">{item.caption}</p>
            </a>
          ))}
        </div>
      </PersistedDisclosure>

      <div className="panel-shadow hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 md:block">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Downloads</p>
            <p className="text-sm font-semibold text-[var(--ink)]">Report Export Center</p>
          </div>
          <span className="rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1 text-xs text-[var(--ink-muted)]">
            CSV
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {exportItems.map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="group rounded-lg border border-[var(--line)] bg-white p-3 transition hover:-translate-y-[1px] hover:border-[var(--brand)]"
            >
              <p className="text-sm font-semibold text-[var(--ink)]">{item.title}</p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">{item.caption}</p>
              <p className="mt-2 text-xs font-medium text-[var(--brand)] group-hover:underline">Download CSV</p>
            </a>
          ))}
        </div>
      </div>

      <PersistedDisclosure
        title="Performance Metrics"
        defaultOpen
        storageKey="reports.performanceMetrics"
        groupName="reports-mobile-sections"
        className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:hidden"
      >
        <div className="grid gap-2">
          <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Revenue</p>
            <p className="text-sm font-semibold">{formatMoney(revenueSelected, currency)}</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Repair Margin</p>
            <p className={`text-sm font-semibold ${marginSelected >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {formatMoney(marginSelected, currency)}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Completed</p>
            <p className="text-sm font-semibold">{completedSelected.length}</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Avg Repair Time</p>
            <p className="text-sm font-semibold">{averageRepairTimeHours.toFixed(1)}h</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">External Ratio</p>
            <p className="text-sm font-semibold">{externalRatio.toFixed(0)}%</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Payouts Due</p>
            <p className="text-sm font-semibold text-amber-700">{formatMoney(externalPayoutOutstandingTotal, currency)}</p>
          </div>
        </div>
      </PersistedDisclosure>

      <div className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-3">
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
          <p className="mt-1 text-xs text-[var(--ink-muted)]">{externalCount} external / {inHouseCount} in-house ({selectedMonthString})</p>
        </div>
        <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">External payouts due</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(externalPayoutOutstandingTotal, currency)}</p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">{externalPayoutOutstandingCount} completed external jobs unpaid ({selectedMonthString})</p>
        </div>
      </div>

      <PersistedDisclosure
        title="Signal Tiles"
        storageKey="reports.signalTiles"
        groupName="reports-mobile-sections"
        className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:hidden"
      >
        <div className="grid gap-2">
          <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Completion Momentum</p>
            <p className={`text-sm font-semibold ${completionMomentum >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {completionMomentum >= 0 ? "+" : ""}
              {completionMomentum}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Queue Pressure</p>
            <p className="text-sm font-semibold text-amber-700">{queuePressure}</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Aging Risk</p>
            <p className={`text-sm font-semibold ${delayedJobs.length > 0 ? "text-rose-700" : "text-emerald-700"}`}>{delayedJobs.length}</p>
          </div>
        </div>
      </PersistedDisclosure>

      <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Completion Momentum</p>
          <p className={`mt-2 text-3xl font-semibold ${completionMomentum >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {completionMomentum >= 0 ? "+" : ""}
            {completionMomentum}
          </p>
          <p className="mt-2 text-xs text-[var(--ink-muted)]">Completed jobs vs previous month</p>
        </div>
        <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Queue Pressure</p>
          <p className="mt-2 text-3xl font-semibold text-amber-700">{queuePressure}</p>
          <p className="mt-2 text-xs text-[var(--ink-muted)]">Diagnosing + awaiting approval + in repair</p>
        </div>
        <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Aging Risk</p>
          <p className={`mt-2 text-3xl font-semibold ${delayedJobs.length > 0 ? "text-rose-700" : "text-emerald-700"}`}>
            {delayedJobs.length}
          </p>
          <p className="mt-2 text-xs text-[var(--ink-muted)]">Open jobs older than 3 days</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
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

      <PersistedDisclosure
        title="Device Performance Drill-down"
        storageKey="reports.deviceDrilldown"
        groupName="reports-mobile-sections"
        className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:hidden"
      >
        <div className="space-y-2">
          {deviceInsights.map((row) => (
            <details key={`${row.device}-mobile`} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3">
              <summary className="list-none">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--ink)]">{row.device}</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-[var(--ink-muted)]">{row.total} jobs</span>
                </div>
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-[var(--ink-muted)]">Open</p><p className="font-semibold">{row.open}</p></div>
                <div><p className="text-[var(--ink-muted)]">Completed</p><p className="font-semibold">{row.completed}</p></div>
                <div><p className="text-[var(--ink-muted)]">Closed</p><p className="font-semibold">{row.cancelledOrClosed}</p></div>
                <div><p className="text-[var(--ink-muted)]">Revenue</p><p className="font-semibold">{formatMoney(row.revenue, currency)}</p></div>
              </div>
            </details>
          ))}
        </div>
      </PersistedDisclosure>

      <div className="panel-shadow hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 md:block">
        <p className="mb-3 text-sm font-semibold">Device Performance Drill-down ({selectedMonthString})</p>
        {deviceInsights.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No jobs found for this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                <tr>
                  <th className="px-2 py-2">Device</th>
                  <th className="px-2 py-2">Total</th>
                  <th className="px-2 py-2">Open</th>
                  <th className="px-2 py-2">Completed</th>
                  <th className="px-2 py-2">Closed/Cancelled</th>
                  <th className="px-2 py-2">Completion %</th>
                  <th className="px-2 py-2">Avg Turnaround</th>
                  <th className="px-2 py-2">Revenue</th>
                  <th className="px-2 py-2">Margin</th>
                  <th className="px-2 py-2">Avg Margin</th>
                  <th className="px-2 py-2">Path Split</th>
                  <th className="px-2 py-2">Top Tech</th>
                  <th className="px-2 py-2">6-Month Trend</th>
                </tr>
              </thead>
              <tbody>
                {deviceInsights.map((row) => (
                  <tr key={row.device} className="border-t border-[var(--line)]">
                    <td className="px-2 py-2 font-medium">{row.device}</td>
                    <td className="px-2 py-2">{row.total}</td>
                    <td className="px-2 py-2">{row.open}</td>
                    <td className="px-2 py-2">{row.completed}</td>
                    <td className="px-2 py-2">{row.cancelledOrClosed}</td>
                    <td className="px-2 py-2">{row.completionRate.toFixed(1)}%</td>
                    <td className="px-2 py-2">{row.avgTurnaroundHours.toFixed(1)}h</td>
                    <td className="px-2 py-2">{formatMoney(row.revenue, currency)}</td>
                    <td className={`px-2 py-2 ${row.margin >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {formatMoney(row.margin, currency)}
                    </td>
                    <td className="px-2 py-2">{formatMoney(row.avgMarginPerCompleted, currency)}</td>
                    <td className="px-2 py-2">{row.ext} ext / {row.inHouse} in-house</td>
                    <td className="px-2 py-2">{row.topTech}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <svg width="68" height="28" viewBox="0 0 68 28" className="overflow-visible">
                          {(() => {
                            const max = Math.max(...row.trend, 1);
                            const points = row.trend
                              .map((value, index) => {
                                const x = (index / Math.max(row.trend.length - 1, 1)) * 64 + 2;
                                const y = 24 - (value / max) * 20;
                                return `${x},${y}`;
                              })
                              .join(" ");
                            return <polyline points={points} fill="none" stroke="#0f766e" strokeWidth="2" />;
                          })()}
                        </svg>
                        <span className={`text-xs ${(row.trend[row.trend.length - 1] ?? 0) - (row.trend[0] ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {(row.trend[row.trend.length - 1] ?? 0) - (row.trend[0] ?? 0) >= 0 ? "+" : ""}
                          {(row.trend[row.trend.length - 1] ?? 0) - (row.trend[0] ?? 0)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PersistedDisclosure
        title="Operational Risks"
        storageKey="reports.operationalRisks"
        groupName="reports-mobile-sections"
        className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:hidden"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3">
            <p className="mb-2 text-sm font-semibold">Aging Alerts</p>
            {agingRows.length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">No aging alerts. Open queue is healthy.</p>
            ) : (
              <div className="space-y-2">
                {agingRows.map((row) => (
                  <div key={`mobile-${row.status}`} className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">
                    <p className="font-medium">{row.status}</p>
                    <p className="text-[var(--ink-muted)]">3-7 days: {row.threeToSeven} • 8+ days: {row.eightPlus}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3">
            <p className="mb-2 text-sm font-semibold">Approval Funnel</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span>Diagnosing</span><span className="font-semibold">{funnel.diagnosing}</span></div>
              <div className="flex items-center justify-between"><span>Awaiting approval</span><span className="font-semibold">{funnel.awaitingApproval}</span></div>
              <div className="flex items-center justify-between"><span>In repair</span><span className="font-semibold">{funnel.inRepair}</span></div>
              <div className="flex items-center justify-between"><span>Ready for pickup</span><span className="font-semibold">{funnel.readyForPickup}</span></div>
              <div className="flex items-center justify-between"><span>Completed</span><span className="font-semibold text-emerald-700">{funnel.completed}</span></div>
            </div>
          </div>
        </div>
      </PersistedDisclosure>

      <div className="hidden gap-3 lg:grid lg:grid-cols-2">
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
              <span>Diagnosing</span>
              <span className="font-semibold">{funnel.diagnosing}</span>
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
              <span>Ready for pickup</span>
              <span className="font-semibold">{funnel.readyForPickup}</span>
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
