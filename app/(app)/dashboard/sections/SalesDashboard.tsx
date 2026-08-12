import Link from "next/link";

import { getClientBill } from "@/lib/billing";
import { formatMoneyCompact, getAppCurrency } from "@/lib/currency";
import { routeLabel } from "@/lib/nav/registry";
import { prisma } from "@/lib/prisma";

import { loadTotalRevenueTrend, trendMonthsSinceStartOfYear } from "./data";
import { DashboardHero, RevenueMarginTrendSection } from "./shared";
import { SalesPerformanceGrid, type SalesStaffRow } from "./SalesPerformanceGrid";

export async function SalesDashboard({ userId, orgId }: { userId: string | undefined; orgId: string | null }) {
  const currency = getAppCurrency();
  const today    = new Date();
  const period   = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const mtdStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1, 0, 0, 0, 0);
  const prevMonthEnd   = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
  const orgFilter = orgId ? { orgId } : {};

  const [
    completedJobsMtd,
    allJobsMtd,
    prevMonthJobCount,
    paidSalesMtd,
    paidInvoicesMtd,
    awaitingApproval,
    readyPickup,
    quotedJobs,
    salesMtdByStaff,
    jobsMtdByStaff,
    teamTarget,
    myTarget,
    revenueTrend,
  ] = await Promise.all([
    // Completed jobs MTD for repair revenue
    prisma.job.findMany({
      where: { ...orgFilter, status: "COMPLETED", completedAt: { gte: mtdStart } },
      select: { id: true, clientBill: true, externalTechBill: true, createdById: true, createdBy: { select: { id: true, name: true } } },
    }),
    // All jobs received MTD for funnel stats
    prisma.job.count({ where: { ...orgFilter, receivedAt: { gte: mtdStart } } }),
    prisma.job.count({ where: { ...orgFilter, receivedAt: { gte: prevMonthStart, lte: prevMonthEnd } } }),
    // POS sales paid MTD
    prisma.sale.findMany({
      where: { ...orgFilter, status: "PAID", paidAt: { gte: mtdStart } },
      select: { totalAmount: true, createdById: true, createdBy: { select: { id: true, name: true } } },
    }),
    // Invoice payments MTD
    prisma.invoice.findMany({
      where: { ...orgFilter, status: "PAID", paidAt: { gte: mtdStart } },
      select: { totalAmount: true, job: { select: { createdById: true, createdBy: { select: { id: true, name: true } } } } },
    }),
    prisma.job.count({ where: { ...orgFilter, status: "AWAITING_APPROVAL" } }),
    prisma.job.count({ where: { ...orgFilter, status: "READY_FOR_PICKUP" } }),
    prisma.job.findMany({
      where: { ...orgFilter, status: "AWAITING_APPROVAL" },
      select: { id: true, jobNumber: true, clientBill: true, client: { select: { fullName: true } }, receivedAt: true },
      orderBy: { receivedAt: "asc" },
      take: 8,
    }),
    // POS sales per staff this month
    prisma.sale.groupBy({
      by: ["createdById"],
      where: { ...orgFilter, status: "PAID", paidAt: { gte: mtdStart }, createdById: { not: null } },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    // Jobs created per staff this month (for repair revenue attribution)
    prisma.job.findMany({
      where: { ...orgFilter, status: "COMPLETED", completedAt: { gte: mtdStart }, createdById: { not: undefined } },
      select: { createdById: true, createdBy: { select: { name: true } }, clientBill: true },
    }),
    // Team target for current month
    prisma.salesTarget.findFirst({ where: { ...orgFilter, userId: null, period } }).catch(() => null),
    // My own target
    userId ? prisma.salesTarget.findFirst({ where: { ...orgFilter, userId, period } }).catch(() => null) : Promise.resolve(null),
    // Revenue trend — run in parallel with other queries
    loadTotalRevenueTrend(trendMonthsSinceStartOfYear(today), orgId, currency),
  ]);

  // ── Revenue aggregation ─────────────────────────────────────────────────
  const repairRevenueMtd = completedJobsMtd.reduce((s, j) => s + (getClientBill(j) ?? 0), 0);
  const posRevenueMtd    = paidSalesMtd.reduce((s, r) => s + r.totalAmount, 0);
  const invoiceRevenueMtd = paidInvoicesMtd.reduce((s, i) => s + i.totalAmount, 0);
  const totalRevenueMtd  = repairRevenueMtd + posRevenueMtd + invoiceRevenueMtd;
  const teamTargetRevenue = teamTarget?.targetRevenue ?? 0;
  const targetPct = teamTargetRevenue > 0 ? Math.round((totalRevenueMtd / teamTargetRevenue) * 100) : null;
  const myTargetRevenue = myTarget?.targetRevenue ?? 0;

  // ── Per-staff performance ────────────────────────────────────────────────
  // Build a map: staffId → { name, repairRev, posRev, totalRev, jobCount, saleCount }
  const staffMap = new Map<string, SalesStaffRow>();

  for (const j of jobsMtdByStaff) {
    if (!j.createdById || !j.createdBy) continue;
    const e = staffMap.get(j.createdById) ?? { name: j.createdBy.name, repairRev: 0, posRev: 0, totalRev: 0, jobCount: 0, saleCount: 0, target: 0 };
    e.repairRev += getClientBill(j) ?? 0;
    e.jobCount  += 1;
    e.totalRev   = e.repairRev + e.posRev;
    staffMap.set(j.createdById, e);
  }
  for (const s of salesMtdByStaff) {
    if (!s.createdById) continue;
    // Need name — find from paidSalesMtd
    const saleRecord = paidSalesMtd.find(r => r.createdById === s.createdById);
    const name = saleRecord?.createdBy?.name ?? s.createdById;
    const e = staffMap.get(s.createdById) ?? { name, repairRev: 0, posRev: 0, totalRev: 0, jobCount: 0, saleCount: 0, target: 0 };
    e.posRev   += s._sum.totalAmount ?? 0;
    e.saleCount += s._count.id;
    e.totalRev  = e.repairRev + e.posRev;
    staffMap.set(s.createdById, e);
  }
  // Fetch individual targets for all staff in map
  const staffIds = [...staffMap.keys()];
  if (staffIds.length > 0) {
    const indivTargets = await prisma.salesTarget.findMany({
      where: { ...orgFilter, userId: { in: staffIds }, period },
      select: { userId: true, targetRevenue: true },
    }).catch(() => [] as { userId: string | null; targetRevenue: number }[]);
    for (const t of indivTargets) {
      if (!t.userId) continue;
      const e = staffMap.get(t.userId);
      if (e) { e.target = t.targetRevenue; staffMap.set(t.userId, e); }
    }
  }

  const staffRows = [...staffMap.values()].sort((a, b) => b.totalRev - a.totalRev);
  const wonMtd = completedJobsMtd.length;
  const conversionRate = allJobsMtd > 0 ? Math.round((wonMtd / allJobsMtd) * 100) : 0;

  return (
    <div className="space-y-4">
      <DashboardHero
        title="Sales Performance"
        summary={`${formatMoneyCompact(totalRevenueMtd, currency)} total revenue MTD${teamTargetRevenue > 0 ? ` · ${targetPct}% of target` : ""} · ${awaitingApproval} awaiting approval`}
        primaryHref="/jobs/new"
        primaryLabel={routeLabel("/jobs/new")}
        secondaryHref="/jobs?status=AWAITING_APPROVAL"
        secondaryLabel="Approval Queue"
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
      />

      {/* ── Team target progress bar ── */}
      {teamTargetRevenue > 0 && (
        <section className="dc-card px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Team Target — {period}</p>
            <span className={`text-sm font-black ${(targetPct ?? 0) >= 100 ? "text-emerald-600" : (targetPct ?? 0) >= 60 ? "text-[var(--accent)]" : "text-amber-600"}`}>
              {targetPct ?? 0}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--panel-strong)]">
            <div
              className={`h-full rounded-full transition-colors ${(targetPct ?? 0) >= 100 ? "bg-emerald-500" : "bg-[var(--accent)]"}`}
              style={{ width: `${Math.min(100, targetPct ?? 0)}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[0.75rem] text-[var(--ink-muted)]">
            <span>{formatMoneyCompact(totalRevenueMtd, currency)} achieved</span>
            <span>target {formatMoneyCompact(teamTargetRevenue, currency)}</span>
          </div>
        </section>
      )}

      {/* ── 4 KPI tiles ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Total Revenue MTD",  val: formatMoneyCompact(totalRevenueMtd, currency),   sub: teamTargetRevenue > 0 ? `${targetPct}% of ${formatMoneyCompact(teamTargetRevenue, currency)} target` : "all channels",      href: "/reports",                                      color: "text-[var(--accent)]" },
          { label: "Repair Revenue",     val: formatMoneyCompact(repairRevenueMtd, currency),  sub: `${wonMtd} completed jobs`,                                                                                                    href: "/jobs?status=COMPLETED",                        color: "text-sky-600" },
          { label: "POS + Invoices",     val: formatMoneyCompact(posRevenueMtd + invoiceRevenueMtd, currency), sub: `${paidSalesMtd.length} sales · ${paidInvoicesMtd.length} invoices`,                                          href: "/documents/invoices",                           color: "text-[var(--accent)]" },
          { label: "Conversion Rate",    val: `${conversionRate}%`,                            sub: `${wonMtd} won vs ${prevMonthJobCount} last month`,                                                                             href: "/jobs?status=COMPLETED,READY_FOR_PICKUP",       color: conversionRate >= 50 ? "text-emerald-600" : "text-amber-600" },
        ].map(t => (
          <Link key={t.label} href={t.href} className="dc-card px-3 py-2.5 transition hover:-translate-y-[2px]">
            <p className="text-[0.75rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">{t.label}</p>
            <p className={`mt-1 text-[0.9375rem] font-black leading-tight ${t.color}`}>{t.val}</p>
            <p className="mt-1 text-[0.75rem] text-[var(--ink-muted)]">{t.sub}</p>
          </Link>
        ))}
      </div>

      <SalesPerformanceGrid
        currency={currency}
        periodKey={period}
        today={today}
        staffRows={staffRows}
        myTargetRevenue={myTargetRevenue}
        repairRevenueMtd={repairRevenueMtd}
        posRevenueMtd={posRevenueMtd}
        invoiceRevenueMtd={invoiceRevenueMtd}
        totalRevenueMtd={totalRevenueMtd}
        wonMtd={wonMtd}
        salesCount={paidSalesMtd.length}
        invoicesCount={paidInvoicesMtd.length}
        quotedJobs={quotedJobs}
        readyPickup={readyPickup}
      />

      <RevenueMarginTrendSection trendMonths={trendMonthsSinceStartOfYear(today)} revenueTrend={revenueTrend} currency={currency} label="Total Revenue Trend (All Channels)" emptyMessage="No revenue recorded yet for this period." />
    </div>
  );
}
