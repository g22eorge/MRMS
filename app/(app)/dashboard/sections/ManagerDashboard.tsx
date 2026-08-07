import Link from "next/link";

import { formatMoneyCompact, getAppCurrency } from "@/lib/currency";
import { monthLabel } from "@/lib/date-ranges";
import { UI_JOB_STATUSES, JobStatus, normalizeJobStatus } from "@/lib/job-status";
import { filterSupportedJobStatuses } from "@/lib/job-status-server";
import { routeLabel } from "@/lib/nav/registry";
import { prisma } from "@/lib/prisma";

import { loadTotalRevenueTrend, trendMonthsSinceStartOfYear } from "./data";
import { DashboardHero, RevenueMarginTrendSection, statusLabel } from "./shared";

export async function ManagerDashboard({ orgId }: { orgId: string | null }) {
  const currency = getAppCurrency();
  const today = new Date();
  const mtdStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
  const mtdLabel = monthLabel(today.getFullYear(), today.getMonth() + 1);
  // Tenant scope for every job query. Empty string fails closed (matches no rows)
  // rather than leaking across orgs if orgId is ever absent.
  const org = orgId ?? "";

  const [statusGroup, completedMtd, overdueJobs, techWorkloadJobs, unassignedCount, receivedToday, completedToday, awaitingApprovalCount, revenueTrend] = await Promise.all([
    prisma.job.groupBy({ by: ["status"], where: { orgId: org }, _count: { status: true } }),
    prisma.job.aggregate({
      where: { orgId: org, status: "COMPLETED", completedAt: { gte: mtdStart } },
      _sum: { clientBill: true },
      _count: true,
    }),
    prisma.job.findMany({
      where: {
        orgId: org,
        status: { in: filterSupportedJobStatuses(["RECEIVED", "DIAGNOSING", "REFERRED", "AWAITING_APPROVAL", "IN_REPAIR"]) as JobStatus[] },
        receivedAt: { lt: threeDaysAgo },
      },
      select: { id: true, jobNumber: true, status: true, receivedAt: true, device: { select: { brand: true, model: true } } },
      orderBy: { receivedAt: "asc" },
      take: 8,
    }).catch(async () => {
      const fb = await prisma.job.findMany({
        where: { orgId: org, status: { in: filterSupportedJobStatuses(["RECEIVED", "DIAGNOSING", "REFERRED", "AWAITING_APPROVAL", "IN_REPAIR"]) as JobStatus[] }, receivedAt: { lt: threeDaysAgo } },
        select: { id: true, jobNumber: true, status: true, receivedAt: true },
        orderBy: { receivedAt: "asc" }, take: 8,
      });
      return fb.map(j => ({ ...j, device: null }));
    }),
    prisma.job.findMany({
      where: {
        orgId: org,
        status: { in: filterSupportedJobStatuses(["DIAGNOSING", "IN_REPAIR", "REFERRED", "AWAITING_APPROVAL", "READY_FOR_PICKUP"]) as JobStatus[] },
        assignedToId: { not: null },
      },
      select: { assignedTo: { select: { id: true, name: true, role: true } } },
    }),
    prisma.job.count({
      where: {
        orgId: org,
        status: { in: filterSupportedJobStatuses(["RECEIVED", "DIAGNOSING", "REFERRED", "IN_REPAIR"]) as JobStatus[] },
        assignedToId: null,
      },
    }),
    prisma.job.count({ where: { orgId: org, receivedAt: { gte: todayStart } } }),
    prisma.job.count({ where: { orgId: org, completedAt: { gte: todayStart } } }),
    prisma.job.count({ where: { orgId: org, status: "AWAITING_APPROVAL" } }),
    loadTotalRevenueTrend(trendMonthsSinceStartOfYear(today), orgId, currency),
  ]);

  const revenueMtd = completedMtd._sum.clientBill ?? 0;
  const statusCount = new Map<string, number>();
  for (const item of statusGroup) {
    const key = normalizeJobStatus(item.status as JobStatus);
    statusCount.set(key, (statusCount.get(key) ?? 0) + item._count.status);
  }
  const overdueWithDays = overdueJobs.map(j => ({ ...j, ageDays: Math.floor((today.getTime() - j.receivedAt.getTime()) / 86400000) }));
  const techMap = new Map<string, { id: string; name: string; role: string; count: number }>();
  for (const j of techWorkloadJobs) {
    if (!j.assignedTo) continue;
    const e = techMap.get(j.assignedTo.id) ?? { ...j.assignedTo, count: 0 };
    e.count += 1;
    techMap.set(j.assignedTo.id, e);
  }
  const techRows = [...techMap.values()].sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <div className="space-y-4">
      <DashboardHero
        title="Manager Overview"
        summary={`${receivedToday} in · ${completedToday} out today · ${overdueWithDays.length} overdue · revenue ${formatMoneyCompact(revenueMtd, currency)} MTD`}
        primaryHref="/reports"
        primaryLabel={routeLabel("/reports")}
        secondaryHref="/jobs"
        secondaryLabel={routeLabel("/jobs")}
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
      />

      {(overdueWithDays.length > 0 || awaitingApprovalCount > 0 || unassignedCount > 0) && (
        <section className="panel-shadow rounded-xl border border-[var(--accent)]/25 bg-[var(--panel)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">Attention Required</span>
            {awaitingApprovalCount > 0 && <Link href="/jobs?status=AWAITING_APPROVAL" className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2.5 py-1 text-[13px] font-medium text-[var(--accent)]">{awaitingApprovalCount} awaiting approval</Link>}
            {overdueWithDays.length > 0 && <span className="rounded-full border border-white/10 bg-[#0b0b0b] px-2.5 py-1 text-[13px] font-medium text-white/90">{overdueWithDays.length} overdue 3+ days</span>}
            {unassignedCount > 0 && <Link href="/jobs?assignedToId=unassigned" className="rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1 text-[13px] font-medium text-[var(--ink)]">{unassignedCount} unassigned</Link>}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Revenue MTD", val: formatMoneyCompact(revenueMtd, currency), href: `/reports?period=month&month=${mtdLabel}`, color: "text-[var(--accent)]" },
          { label: "Completed MTD", val: String(completedMtd._count ?? 0), href: "/jobs?status=COMPLETED", color: "text-emerald-600" },
          { label: "In Pipeline", val: String((statusCount.get("DIAGNOSING") ?? 0) + (statusCount.get("IN_REPAIR") ?? 0) + (statusCount.get("AWAITING_APPROVAL") ?? 0)), href: "/jobs?status=DIAGNOSING,IN_REPAIR,AWAITING_APPROVAL", color: "text-[var(--ink)]" },
          { label: "Ready Pickup", val: String(statusCount.get("READY_FOR_PICKUP") ?? 0), href: "/jobs?status=READY_FOR_PICKUP", color: "text-[var(--accent)]" },
        ].map(t => (
          <Link key={t.label} href={t.href} className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px]">
            <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">{t.label}</p>
            <p className={`mt-1 text-[15px] font-black leading-tight ${t.color}`}>{t.val}</p>
          </Link>
        ))}
      </div>

      <RevenueMarginTrendSection trendMonths={trendMonthsSinceStartOfYear(today)} revenueTrend={revenueTrend} currency={currency} label="Total Revenue & Margin (Repairs + Sales)" emptyMessage="No revenue recorded yet for this period." />

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Live Pipeline</p>
          <div className="space-y-1.5">
            {UI_JOB_STATUSES.filter(s => s !== "CLOSED" && s !== "COMPLETED").map(s => {
              const count = statusCount.get(s) ?? 0;
              return (
                <Link key={s} href={`/jobs?status=${s}`} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 transition hover:border-[var(--accent)]/35">
                  <p className="text-xs font-medium text-[var(--ink)]">{statusLabel[s]}</p>
                  <span className={`text-sm font-bold ${count > 0 ? "text-[var(--accent)]" : "text-[var(--ink-muted)]"}`}>{count}</span>
                </Link>
              );
            })}
          </div>
        </section>
        <section className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Staff Workload</p>
            {unassignedCount > 0 && <Link href="/jobs?assignedToId=unassigned" className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[12px] font-bold text-amber-600">{unassignedCount} unassigned</Link>}
          </div>
          {techRows.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No active assignments.</p>
          ) : (
            <div className="space-y-1.5">
              {techRows.map(t => (
                <Link key={t.id} href={`/jobs?assignedToId=${t.id}`} className="group flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 transition hover:border-[var(--accent)]/35">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold group-hover:text-[var(--accent)] transition-colors">{t.name}</p>
                    <p className="text-[12px] text-[var(--ink-muted)]">{t.role === "TECHNICIAN_EXTERNAL" ? "External" : t.role === "TECHNICIAN_INTERNAL" ? "Internal" : t.role}</p>
                  </div>
                  <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${t.role === "TECHNICIAN_EXTERNAL" ? "bg-slate-500/15 text-slate-400" : "bg-sky-500/15 text-sky-500"}`}>{t.count} active</span>
                </Link>
              ))}
              {overdueWithDays.length > 0 && (
                <div className="mt-2 border-t border-[var(--line)] pt-2">
                  <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Overdue Jobs</p>
                  {overdueWithDays.slice(0, 4).map(j => (
                    <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 transition hover:border-amber-500/30 mb-1">
                      <div className="min-w-0">
                        <p className="mono truncate text-xs font-bold text-[var(--accent)]">{j.jobNumber}</p>
                        <p className="truncate text-[12px] text-[var(--ink-muted)]">{statusLabel[j.status as keyof typeof statusLabel] ?? j.status}</p>
                      </div>
                      <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${j.ageDays >= 8 ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-600"}`}>{j.ageDays}d</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
