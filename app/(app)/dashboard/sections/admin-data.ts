// @ts-nocheck
import { getClientBill, resolveTechCost } from "@/lib/billing";
import { getAppCurrency } from "@/lib/currency";
import { loadCashCollectionsByChannelWide, loadReceivablesTotal } from "@/lib/finance/reconciliation";
import { UI_JOB_STATUSES, JobStatus, normalizeJobStatus } from "@/lib/job-status";
import { filterSupportedJobStatuses } from "@/lib/job-status-server";
import { getTechnicianPayoutTotalsByJobIds } from "@/lib/payouts";
import { prisma } from "@/lib/prisma";
import { getOrgModules } from "@/lib/module-access";

import { loadTotalRevenueTrend, trendMonthsSinceStartOfYear } from "./data";
import { statusLabel } from "./shared";

/** All ADMIN dashboard queries + derivations, extracted from page.tsx unchanged. */
export async function loadAdminDashboardData(orgId: string | null) {
  const currency = getAppCurrency();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const yesterdayEnd = new Date(todayStart.getTime() - 1);
  const mtdStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
  const orgFilter = orgId ? { orgId } : {};
  // Compute trend months upfront so we can include trend query in the main batch
  const trendMonths = trendMonthsSinceStartOfYear(today);

  const [
    statusGroup,
    // Stream 1: Repairs MTD
    completedMtdJobs,
    // Financial position
    bankAccounts,
    expensesMtd,
    payablesAgg,
    // Operations
    awaitingApprovalCount,
    receivedToday,
    completedToday,
    receivedMtdCount,
    expensesToday,
    overdueJobsCount,
    jobsNoClientUpdateCount,
    completedUnpaidCount,
    payoutDueJobs,
    // Sales funnel
    leadFunnel,
    // Stock alerts
    lowStockParts,
    // Tech leaderboard
    techCompletedMtd,
    // Tech pending jobs (all active statuses)
    techPendingJobs,
    // Yesterday comparison
    receivedYesterday,
    completedYesterday,
    expensesYesterdayRaw,
    // Per-tech payout due
    techPayoutByTech,
    // Intake queue
    intakePendingCount,
    // Comms health
    failedOutboxByStatus,
    // Inventory: out-of-stock
    outOfStockCount,
    // Cash collections — single wide MTD fetch, sliced in memory (2 queries not 6)
    collectionsWide,
    receivables,
    // YTD revenue trend — merged from former serial await
    revenueTrend,
    // Org modules — merged from former serial await
    enabledModules,
    // Org name for mobile header — merged from former inline JSX query
    orgName,
  ] = await Promise.all([
    prisma.job.groupBy({ by: ["status"], where: orgFilter, _count: { status: true } }),

    prisma.job.count({
      where: { ...orgFilter, status: "COMPLETED", completedAt: { gte: mtdStart, lte: today } },
    }),

    prisma.bankAccount.findMany({
      where: { ...orgFilter, isActive: true },
      select: { name: true, currentBalance: true },
      orderBy: { currentBalance: "desc" },
      take: 20,
    }).catch(() => [] as { name: string; currentBalance: number }[]),

    prisma.expense.aggregate({
      where: { orgId: orgFilter.orgId ?? undefined, paidAt: { gte: mtdStart, lte: today } },
      _sum: { amount: true },
    }).catch(() => ({ _sum: { amount: null } })),

    prisma.supplierBill.aggregate({
      where: { ...orgFilter, status: { in: ["POSTED", "PART_PAID"] } },
      _sum: { totalAmount: true, paidAmount: true },
    }).catch(() => ({ _sum: { totalAmount: null, paidAmount: null } })),

    prisma.job.count({ where: { ...orgFilter, status: "AWAITING_APPROVAL" } }).catch(() => 0),

    prisma.job.count({ where: { ...orgFilter, receivedAt: { gte: todayStart } } }),
    prisma.job.count({ where: { ...orgFilter, completedAt: { gte: todayStart } } }),
    prisma.job.count({ where: { ...orgFilter, receivedAt: { gte: mtdStart, lte: today } } }),

    prisma.expense.aggregate({ where: { orgId: orgFilter.orgId ?? undefined, paidAt: { gte: todayStart } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: null } })),
    prisma.job.count({ where: { ...orgFilter, status: { in: filterSupportedJobStatuses(["RECEIVED", "DIAGNOSING", "REFERRED", "IN_EXTERNAL_REPAIR", "AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"]) as JobStatus[] }, receivedAt: { lt: new Date(today.getTime() - 3 * 86_400_000) } } }).catch(() => 0),
    prisma.job.count({ where: { ...orgFilter, status: { in: filterSupportedJobStatuses(["DIAGNOSING", "REFERRED", "IN_EXTERNAL_REPAIR", "AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"]) as JobStatus[] }, lastClientContactAt: null } }).catch(() => 0),
    prisma.job.count({ where: { ...orgFilter, status: "COMPLETED", clientBill: { gt: 0 }, clientPaid: false } }).catch(() => 0),
    prisma.job.findMany({ where: { ...orgFilter, repairPath: "EXTERNAL", status: { in: ["COMPLETED", "DELIVERED"] }, externalPaid: false }, select: { id: true, externalTechFee: true, externalTechBill: true } }).catch(() => [] as { id: string; externalTechFee: number | null; externalTechBill: number | null }[]),

    prisma.lead.groupBy({ by: ["status"], where: orgFilter, _count: { status: true } }).catch(() => [] as { status: string; _count: { status: number } }[]),

    prisma.part.findMany({
      where: { ...orgFilter, isActive: true, reorderLevel: { gt: 0 } },
      select: { id: true, name: true, sku: true, qtyOnHand: true, reorderLevel: true },
      take: 30,
    }).catch(() => [] as { id: string; name: string; sku: string; qtyOnHand: number; reorderLevel: number }[]),

    prisma.job.findMany({
      where: { ...orgFilter, status: "COMPLETED", completedAt: { gte: mtdStart }, assignedToId: { not: null } },
      select: { assignedToId: true, assignedTo: { select: { name: true } }, clientBill: true, receivedAt: true, completedAt: true },
      take: 500,
    }).catch(() => [] as { assignedToId: string | null; assignedTo: { name: string } | null; clientBill: number | null; receivedAt: Date; completedAt: Date | null }[]),

    // Tech pending jobs — groupBy to get counts without loading every job row
    prisma.job.groupBy({
      by: ["assignedToId"],
      where: { ...orgFilter, status: { in: filterSupportedJobStatuses(["RECEIVED", "DIAGNOSING", "REFERRED", "IN_EXTERNAL_REPAIR", "AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"]) as JobStatus[] }, assignedToId: { not: null } },
      _count: { assignedToId: true },
    }).catch(() => [] as { assignedToId: string | null; _count: { assignedToId: number } }[]),

    prisma.job.count({ where: { ...orgFilter, receivedAt: { gte: yesterdayStart, lte: yesterdayEnd } } }).catch(() => 0),
    prisma.job.count({ where: { ...orgFilter, completedAt: { gte: yesterdayStart, lte: yesterdayEnd } } }).catch(() => 0),
    prisma.expense.aggregate({ where: { orgId: orgFilter.orgId ?? undefined, paidAt: { gte: yesterdayStart, lte: yesterdayEnd } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: null } })),
    prisma.job.findMany({ where: { ...orgFilter, repairPath: "EXTERNAL", status: { in: filterSupportedJobStatuses(["COMPLETED", "DELIVERED"]) as JobStatus[] }, externalPaid: false, assignedToId: { not: null } }, select: { id: true, assignedToId: true, externalTechFee: true, externalTechBill: true }, take: 200 }).catch(() => [] as { id: string; assignedToId: string | null; externalTechFee: number | null; externalTechBill: number | null }[]),
    // Intake pending
    prisma.repairRequest.count({ where: { ...(orgFilter.orgId ? { orgId: orgFilter.orgId } : {}), requestStatus: { in: ["PENDING_INTAKE", "PENDING_FRONT_DESK"] as never[] } } }).catch(() => 0),
    // Failed / dead outbox messages — split by status so the UI can label them honestly
    prisma.outboundMessage.groupBy({
      by: ["status"],
      where: { ...(orgFilter.orgId ? { orgId: orgFilter.orgId } : {}), status: { in: ["FAILED", "DEAD"] as never[] } },
      _count: { _all: true },
    }).catch(() => [] as { status: string; _count: { _all: number } }[]),
    // Out-of-stock active parts
    prisma.part.count({ where: { ...orgFilter, isActive: true, qtyOnHand: { lte: 0 } } }).catch(() => 0),
    // Cash collections — single wide MTD fetch, sliced into today/yesterday/MTD in memory (2 queries not 6)
    orgId
      ? loadCashCollectionsByChannelWide({ orgId, baseCurrency: currency, mtdStart, todayStart, yesterdayStart, yesterdayEnd })
      : Promise.resolve({ mtd: { repairs: 0, products: 0, corporate: 0, unallocated: 0, total: 0 }, today: { repairs: 0, products: 0, corporate: 0, unallocated: 0, total: 0 }, yesterday: { repairs: 0, products: 0, corporate: 0, unallocated: 0, total: 0 } }),
    orgId
      ? loadReceivablesTotal(orgId)
      : Promise.resolve({ invoiceBalance: 0, saleBalance: 0, total: 0, invoiceCount: 0, saleCount: 0 }),
    // YTD revenue trend — now parallel
    orgId
      ? loadTotalRevenueTrend(trendMonths, orgId, currency).catch(() => trendMonths.map((m) => ({ key: m.key, revenue: 0, margin: 0 })))
      : Promise.resolve(trendMonths.map((m) => ({ key: m.key, revenue: 0, margin: 0 }))),
    // Org modules — now parallel
    orgId
      ? getOrgModules(orgId).catch(() => new Set(["JOBS", "INVOICING", "POS"]) as Set<string>)
      : Promise.resolve(new Set(["JOBS", "INVOICING", "POS"]) as Set<string>),
    // Org name for mobile header — lifted out of inline JSX
    orgId
      ? prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }).then(o => o?.name ?? null).catch(() => null)
      : Promise.resolve(null as string | null),
  ]);

  // Comms health: split failed vs dead so the dashboard matches the Outbox tabs
  const failedMsgCount = failedOutboxByStatus.find((r) => r.status === "FAILED")?._count._all ?? 0;
  const deadMsgCount   = failedOutboxByStatus.find((r) => r.status === "DEAD")?._count._all ?? 0;
  const failedOutboxCount = failedMsgCount + deadMsgCount;
  const failedOutboxLabel =
    failedMsgCount > 0 && deadMsgCount > 0
      ? `${failedMsgCount} failed · ${deadMsgCount} dead`
      : failedMsgCount > 0
        ? `${failedMsgCount} failed`
        : `${deadMsgCount} dead`;

  // Unpack wide collections result
  const collectionsMtd       = collectionsWide.mtd;
  const collectionsToday     = collectionsWide.today;
  const collectionsYesterday = collectionsWide.yesterday;

  // Revenue stream totals
  const repairsMtd   = collectionsMtd.repairs;
  const productsMtd  = collectionsMtd.products;
  const corporateMtd = collectionsMtd.corporate + collectionsMtd.unallocated;
  const totalMtd     = collectionsMtd.total;
  const conversionRate = receivedMtdCount > 0 ? Math.round(completedMtdJobs / receivedMtdCount * 100) : 0;

  // Financial position
  const totalBankBalance  = bankAccounts.reduce((s, a) => s + a.currentBalance, 0);
  const outstandingValue  = receivables.total;
  const outstandingCount  = receivables.invoiceCount + receivables.saleCount;
  const expensesValue     = expensesMtd._sum.amount ?? 0;
  const cashTodayValue    = collectionsToday.total;
  const salesTodayValue   = collectionsToday.products;
  const revenueTodayValue = collectionsToday.total;
  const expensesTodayValue = expensesToday._sum.amount ?? 0;
  const payablesValue     = (payablesAgg._sum.totalAmount ?? 0) - (payablesAgg._sum.paidAmount ?? 0);
  const payoutDueTotals = await getTechnicianPayoutTotalsByJobIds(payoutDueJobs.map((job) => job.id));
  const technicianPayoutsDue = payoutDueJobs.reduce((sum, job) => {
    const paid = payoutDueTotals.get(job.id)?.paidAmount ?? 0;
    return sum + Math.max(0, resolveTechCost(job.externalTechFee, job.externalTechBill) - paid);
  }, 0);

  // Yesterday comparison values
  const cashYesterdayValue = collectionsYesterday.total;
  const expensesYesterdayValue = expensesYesterdayRaw._sum.amount ?? 0;

  // Per-tech payout due map
  const techPayoutByTechTotals = await getTechnicianPayoutTotalsByJobIds(techPayoutByTech.map((job) => job.id));
  const techPayoutDueMap = new Map<string, number>();
  for (const j of techPayoutByTech) {
    if (!j.assignedToId) continue;
    const paid = techPayoutByTechTotals.get(j.id)?.paidAmount ?? 0;
    techPayoutDueMap.set(j.assignedToId, (techPayoutDueMap.get(j.assignedToId) ?? 0) + Math.max(0, resolveTechCost(j.externalTechFee, j.externalTechBill) - paid));
  }

  // Low stock
  const lowStockItems = lowStockParts.filter((p) => p.qtyOnHand <= p.reorderLevel);

  // Tech leaderboard — techPendingJobs is now a groupBy result (one row per tech)
  const techPendingMap = new Map<string, number>();
  for (const row of techPendingJobs) {
    if (!row.assignedToId) continue;
    techPendingMap.set(row.assignedToId, row._count.assignedToId);
  }
  const techMap = new Map<string, { name: string; count: number; pending: number; revenue: number; totalDays: number; payoutDue: number }>();
  for (const j of techCompletedMtd) {
    if (!j.assignedToId || !j.assignedTo) continue;
    const e = techMap.get(j.assignedToId) ?? { name: j.assignedTo.name, count: 0, pending: techPendingMap.get(j.assignedToId) ?? 0, revenue: 0, totalDays: 0, payoutDue: techPayoutDueMap.get(j.assignedToId) ?? 0 };
    e.count += 1;
    e.revenue += getClientBill(j) ?? 0;
    if (j.completedAt) e.totalDays += Math.round((new Date(j.completedAt).getTime() - new Date(j.receivedAt).getTime()) / 86_400_000);
    techMap.set(j.assignedToId, e);
  }
  const techLeaderboard = [...techMap.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  // Status pipeline
  const statusCount = new Map<string, number>();
  for (const item of statusGroup) {
    const key = normalizeJobStatus(item.status as JobStatus);
    statusCount.set(key, (statusCount.get(key) ?? 0) + item._count.status);
  }
  // Mobile-specific derived counts
  const inRepairCount      = statusCount.get("IN_REPAIR") ?? 0;
  const readyForPickupCount = statusCount.get("READY_FOR_PICKUP") ?? 0;
  const statusData = UI_JOB_STATUSES.map((status) => ({
    key: status, name: statusLabel[status], value: statusCount.get(status) ?? 0,
  }));

  // Sales funnel counts
  const leadCountMap = new Map<string, number>();
  for (const row of leadFunnel) leadCountMap.set(row.status, row._count.status);

  return {
    currency,
    today,
    orgName,
    enabledModules,
    // Today / yesterday
    receivedToday,
    completedToday,
    receivedYesterday,
    completedYesterday,
    intakePendingCount,
    cashTodayValue,
    cashYesterdayValue,
    salesTodayValue,
    revenueTodayValue,
    expensesTodayValue,
    expensesYesterdayValue,
    // Needs action
    awaitingApprovalCount,
    overdueJobsCount,
    jobsNoClientUpdateCount,
    completedUnpaidCount,
    failedOutboxCount,
    failedOutboxLabel,
    // Pipeline
    statusCount,
    statusData,
    inRepairCount,
    readyForPickupCount,
    conversionRate,
    // Revenue channels
    repairsMtd,
    productsMtd,
    corporateMtd,
    totalMtd,
    revenueTrend,
    // Financial position
    bankAccounts,
    totalBankBalance,
    outstandingValue,
    outstandingCount,
    expensesValue,
    payablesValue,
    technicianPayoutsDue,
    // Sales funnel
    leadFunnel,
    leadCountMap,
    // Inventory
    lowStockParts,
    lowStockItems,
    outOfStockCount,
    // Technicians
    techLeaderboard,
  };
}

export type AdminDashboardData = Awaited<ReturnType<typeof loadAdminDashboardData>>;
