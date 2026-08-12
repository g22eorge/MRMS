import Link from "next/link";

import { getAppCurrency } from "@/lib/currency";
import { JobStatus } from "@/lib/job-status";
import { filterSupportedJobStatuses } from "@/lib/job-status-server";
import { routeLabel } from "@/lib/nav/registry";
import { prisma } from "@/lib/prisma";

import { loadRepairRevenueTrend, trendMonthsSinceStartOfYear } from "./data";
import { DashboardHero, RevenueMarginTrendSection } from "./shared";

export async function TechManagerDashboard({ orgId }: { orgId: string | null }) {
  const today = new Date();
  const mtdStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);

  const orgFilter = orgId ? { orgId } : {};

  const [
    completedMtd,
    openJobs,
    techWorkloadJobs,
    overdueJobs,
    unassignedCount,
    receivedToday,
    completedToday,
    diagnosingCount,
    partsActivity,
  ] = await Promise.all([
    prisma.job.findMany({
      where: { ...orgFilter, completedAt: { gte: mtdStart }, status: "COMPLETED" },
      select: { completedAt: true, receivedAt: true, assignedTo: { select: { id: true, name: true } } },
    }),
    prisma.job.count({
      where: { ...orgFilter, status: { in: filterSupportedJobStatuses(["RECEIVED","DIAGNOSING","REFERRED","AWAITING_APPROVAL","IN_REPAIR","READY_FOR_PICKUP"]) as JobStatus[] } },
    }),
    prisma.job.findMany({
      where: {
        ...orgFilter,
        status: { in: filterSupportedJobStatuses(["DIAGNOSING","IN_REPAIR","REFERRED","AWAITING_APPROVAL","READY_FOR_PICKUP"]) as JobStatus[] },
        assignedToId: { not: null },
      },
      select: { assignedTo: { select: { id: true, name: true, role: true } } },
    }),
    prisma.job.findMany({
      where: {
        ...orgFilter,
        status: { in: filterSupportedJobStatuses(["RECEIVED","DIAGNOSING","REFERRED","AWAITING_APPROVAL","IN_REPAIR"]) as JobStatus[] },
        receivedAt: { lt: threeDaysAgo },
      },
      select: { id: true, jobNumber: true, status: true, receivedAt: true },
      orderBy: { receivedAt: "asc" },
      take: 8,
    }),
    prisma.job.count({
      where: { ...orgFilter, status: { in: filterSupportedJobStatuses(["RECEIVED","DIAGNOSING","REFERRED","IN_REPAIR"]) as JobStatus[] }, assignedToId: null },
    }),
    prisma.job.count({ where: { ...orgFilter, receivedAt: { gte: todayStart } } }),
    prisma.job.count({ where: { ...orgFilter, completedAt: { gte: todayStart } } }),
    prisma.job.count({ where: { ...orgFilter, status: "DIAGNOSING" } }),
    prisma.partStockTransaction.findMany({
      where: { createdAt: { gte: mtdStart } },
      select: { type: true, quantity: true },
    }).catch(() => [] as Array<{ type: string; quantity: number }>),
  ]);

  // Compute tech workload map
  const techMap = new Map<string, { id: string; name: string; role: string; count: number }>();
  for (const j of techWorkloadJobs) {
    if (!j.assignedTo) continue;
    const e = techMap.get(j.assignedTo.id) ?? { ...j.assignedTo, count: 0 };
    e.count += 1;
    techMap.set(j.assignedTo.id, e);
  }
  const techRows = [...techMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  // Compute per-tech completions this month
  const techCompletions = new Map<string, { name: string; count: number; avgDays: number; totalDays: number }>();
  for (const j of completedMtd) {
    if (!j.assignedTo) continue;
    const e = techCompletions.get(j.assignedTo.id) ?? { name: j.assignedTo.name, count: 0, avgDays: 0, totalDays: 0 };
    const days = j.completedAt && j.receivedAt ? (new Date(j.completedAt).getTime() - new Date(j.receivedAt).getTime()) / 86400000 : 0;
    e.count += 1;
    e.totalDays += days;
    e.avgDays = e.totalDays / e.count;
    techCompletions.set(j.assignedTo.id, e);
  }
  const topTechs = [...techCompletions.values()].sort((a, b) => b.count - a.count).slice(0, 6);

  // Avg turnaround for completed MTD
  const avgTurnaround = completedMtd.length > 0
    ? completedMtd.reduce((sum, j) => {
        if (!j.completedAt || !j.receivedAt) return sum;
        return sum + (new Date(j.completedAt).getTime() - new Date(j.receivedAt).getTime()) / 86400000;
      }, 0) / completedMtd.length
    : 0;

  const partsConsumed = partsActivity.filter(p => p.type === "OUT").reduce((s, p) => s + p.quantity, 0);
  const overdueWithDays = overdueJobs.map(j => ({ ...j, ageDays: Math.floor((today.getTime() - new Date(j.receivedAt).getTime()) / 86400000) }));

  const trendMonths = trendMonthsSinceStartOfYear(today);
  const currency = getAppCurrency();
  const repairTrend = await loadRepairRevenueTrend(trendMonths, orgId);

  return (
    <div className="space-y-4">
      <DashboardHero
        title="Tech Operations"
        summary={`${receivedToday} in · ${completedToday} out today · ${overdueWithDays.length} overdue · avg ${avgTurnaround.toFixed(1)}d turnaround`}
        primaryHref="/jobs"
        primaryLabel={routeLabel("/jobs")}
        secondaryHref="/technicians"
        secondaryLabel={routeLabel("/technicians")}
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Completed MTD", val: String(completedMtd.length), sub: `avg ${avgTurnaround.toFixed(1)}d turnaround`, href: "/jobs?status=COMPLETED", color: "text-emerald-600" },
          { label: "Open Jobs", val: String(openJobs), sub: `${diagnosingCount} diagnosing`, href: "/jobs", color: "text-[var(--ink)]" },
          { label: "Overdue (3d+)", val: String(overdueWithDays.length), sub: `${unassignedCount} unassigned`, href: "/jobs", color: overdueWithDays.length > 0 ? "text-amber-600" : "text-[var(--ink-muted)]" },
          { label: "Parts Used MTD", val: String(partsConsumed), sub: "units consumed", href: "/inventory", color: "text-[var(--ink)]" },
        ].map(t => (
          <Link key={t.label} href={t.href} className="dc-card px-3 py-2.5 transition hover:-translate-y-[2px]">
            <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">{t.label}</p>
            <p className={`mt-1 text-[0.9375rem] font-black leading-tight ${t.color}`}>{t.val}</p>
            <p className="mt-1 text-[0.75rem] text-[var(--ink-muted)]">{t.sub}</p>
          </Link>
        ))}
      </div>

      {/* Attention banner */}
      {(overdueWithDays.length > 0 || unassignedCount > 0) && (
        <section className="panel-shadow rounded-xl border border-[var(--accent)]/25 bg-[var(--panel)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-[0.8125rem] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">Attention Required</span>
            {unassignedCount > 0 && <Link href="/jobs?assignedToId=unassigned" className="rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1 text-[0.8125rem] font-medium text-[var(--ink)]">{unassignedCount} unassigned</Link>}
            {overdueWithDays.length > 0 && <span className="rounded-full border border-white/10 bg-[#0b0b0b] px-2.5 py-1 text-[0.8125rem] font-medium text-white/90">{overdueWithDays.length} overdue 3+ days</span>}
          </div>
        </section>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Technician completions leaderboard */}
        <section className="dc-card px-3 py-2.5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Completions This Month</p>
          {topTechs.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No completed jobs this month.</p>
          ) : (
            <div className="space-y-1.5">
              {topTechs.map((t, i) => (
                <div key={t.name} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[0.75rem] font-bold text-[var(--ink-muted)] w-4">{i + 1}</span>
                    <p className="truncate text-xs font-semibold text-[var(--ink)]">{t.name}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[0.75rem] text-[var(--ink-muted)]">{t.avgDays.toFixed(1)}d avg</span>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.75rem] font-bold text-emerald-600">{t.count} done</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active workload */}
        <section className="dc-card px-3 py-2.5" id="tech-workload">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Active Workload</p>
            {unassignedCount > 0 && <Link href="/jobs?assignedToId=unassigned" className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[0.75rem] font-bold text-amber-600">{unassignedCount} unassigned</Link>}
          </div>
          {techRows.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No active assignments.</p>
          ) : (
            <div className="space-y-1.5">
              {techRows.map(t => (
                <Link key={t.id} href={`/jobs?assignedToId=${t.id}`} className="group flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 transition hover:border-[var(--accent)]/35">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold group-hover:text-[var(--accent)] transition-colors">{t.name}</p>
                    <p className="text-[0.75rem] text-[var(--ink-muted)]">{t.role === "TECHNICIAN_EXTERNAL" ? "External" : "Internal"}</p>
                  </div>
                  <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[0.75rem] font-bold ${t.role === "TECHNICIAN_EXTERNAL" ? "bg-slate-500/15 text-slate-400" : "bg-sky-500/15 text-sky-500"}`}>{t.count} active</span>
                </Link>
              ))}
              {overdueWithDays.length > 0 && (
                <div className="mt-2 border-t border-[var(--line)] pt-2">
                  <p className="mb-1.5 text-[0.75rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Overdue Jobs</p>
                  {overdueWithDays.slice(0, 4).map(j => (
                    <Link key={j.id} href={`/jobs/${j.id}`} className="mb-1 flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 transition hover:border-amber-500/30">
                      <p className="mono truncate text-xs font-bold text-[var(--accent)]">{j.jobNumber}</p>
                      <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[0.75rem] font-bold ${j.ageDays >= 8 ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-600"}`}>{j.ageDays}d</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <RevenueMarginTrendSection trendMonths={trendMonths} revenueTrend={repairTrend} currency={currency} label="Repair Revenue & Margin Trend" emptyMessage="No completed repair jobs yet for this period." />
    </div>
  );
}
