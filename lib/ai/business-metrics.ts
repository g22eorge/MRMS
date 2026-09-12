// orgDb is loosely typed; keep this module aligned with AI surfaces until scoper types land.
import { getClientBill, resolveTechCost } from "@/lib/billing";
import { getAppCurrency } from "@/lib/currency";
import { dayRange, daysBetween, monthRangeFromDate, previousDayRange, previousMonthRange } from "@/lib/date-ranges";
import { loadCashCollectionsByChannel } from "@/lib/finance/reconciliation";
import { prisma } from "@/lib/prisma";
import { orgDb } from "@/lib/db";

export const OPEN_JOB_STATUSES = [
  "RECEIVED",
  "DIAGNOSING",
  "REFERRED",
  "PENDING_EXTERNAL_ASSIGNMENT",
  "ASSIGNED_ONE_TIME_EXTERNAL",
  "IN_EXTERNAL_REPAIR",
  "WAITING_FOR_PARTS",
  "RETURNED_FROM_EXTERNAL",
  "AWAITING_APPROVAL",
  "IN_REPAIR",
  "READY_FOR_PICKUP",
] as const;

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/** UI caption helper, e.g. "+12.3% vs previous month" */
export function trendLabel(current: number, previous: number, suffix = "%") {
  const change = pctChange(current, previous);
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}${suffix} vs previous month`;
}

export function changePhrase(current: number, previous: number) {
  const change = pctChange(current, previous);
  if (change === 0) return "flat versus last month";
  return `${change > 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}% versus last month`;
}

export type BusinessDataPack = Awaited<ReturnType<typeof buildBusinessDataPack>>;

/**
 * Tenant-scoped KPI pack shared by AI Insights, the business copilot, and cross-surface labels.
 *
 * Revenue semantics (explicit — do not merge):
 * - `finance.cashReceived*` — payments received in period (matches Dashboard + Reports collections)
 * - `finance.completedRepairValue*` — client bill on jobs completed in period (operations metric)
 */
export async function buildBusinessDataPack(orgId: string, asOf: Date = new Date()) {
  const db = orgDb(orgId);
  const current = monthRangeFromDate(asOf);
  const previous = previousMonthRange(asOf);
  // "How much have I collected today?" is the shortest question an owner asks
  // and the system could not answer it: every figure was a calendar month, so
  // the smallest window was "this month so far".
  const today = dayRange(asOf);
  const yesterday = previousDayRange(asOf);
  const monthKey = `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, "0")}`;
  const currency = getAppCurrency();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { baseCurrency: true },
  });
  const baseCurrency = org?.baseCurrency ?? currency;

  const [
    jobsThisMonth,
    jobsPrevMonth,
    completedThisMonth,
    completedPrevMonth,
    openJobs,
    jobsByStatus,
    cashCurrent,
    cashPrevious,
    cashToday,
    cashYesterday,
    [invoiceReceivableRows, overdueInvoicesCount],
    expensesThisMonth,
    expensesPrevMonth,
    expensesToday,
    supplierPaidThisMonth,
    supplierPaidToday,
    parts,
    openPurchaseOrders,
    [billPayableRows, overdueSupplierBillsCount],
    leadsByStatus,
    salesTargets,
  ] = await Promise.all([
    db.job.count({ where: { receivedAt: { gte: current.start, lte: current.end } } }),
    db.job.count({ where: { receivedAt: { gte: previous.start, lte: previous.end } } }),
    db.job.findMany({
      where: { status: "COMPLETED", completedAt: { gte: current.start, lte: current.end } },
      select: { clientBill: true, externalTechBill: true, externalTechFee: true, completedAt: true, receivedAt: true, repairPath: true },
    }),
    db.job.findMany({
      where: { status: "COMPLETED", completedAt: { gte: previous.start, lte: previous.end } },
      select: { clientBill: true, externalTechBill: true, externalTechFee: true },
    }),
    db.job.findMany({
      where: { status: { in: [...OPEN_JOB_STATUSES] } },
      select: { jobNumber: true, status: true, receivedAt: true, updatedAt: true, repairPath: true },
      orderBy: { receivedAt: "asc" },
      take: 500,
    }),
    db.job.groupBy({ by: ["status"], _count: { status: true } }),
    loadCashCollectionsByChannel({ orgId, baseCurrency, range: current }),
    loadCashCollectionsByChannel({ orgId, baseCurrency, range: previous }),
    loadCashCollectionsByChannel({ orgId, baseCurrency, range: today }),
    loadCashCollectionsByChannel({ orgId, baseCurrency, range: yesterday }),
    // Receivables total (DB SUM) + overdue count — not a truncated take:500 slice.
    Promise.all([
      prisma.$queryRaw<{ balance: number | null }[]>`
        SELECT COALESCE(SUM(CASE WHEN "totalAmount" > "paidAmount" THEN "totalAmount" - "paidAmount" ELSE 0 END), 0) AS balance
        FROM "Invoice" WHERE "orgId" = ${orgId} AND "status" IN ('DRAFT','ISSUED')`,
      db.invoice.count({ where: { status: { in: ["DRAFT", "ISSUED"] }, dueDate: { lt: asOf } } }),
    ]),
    db.expense.aggregate({ where: { paidAt: { gte: current.start, lte: current.end } }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { paidAt: { gte: previous.start, lte: previous.end } }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { paidAt: { gte: today.start, lte: today.end } }, _sum: { amount: true } }),
    // Cash actually paid to suppliers. baseAmountSent is what left the bank
    // including the transfer fee; amount is the sum the supplier received.
    db.supplierPayment.aggregate({ where: { paidAt: { gte: current.start, lte: current.end } }, _sum: { baseAmountSent: true, amount: true } }),
    db.supplierPayment.aggregate({ where: { paidAt: { gte: today.start, lte: today.end } }, _sum: { baseAmountSent: true, amount: true } }),
    db.part.findMany({ where: { isActive: true }, select: { sku: true, name: true, qtyOnHand: true, reorderLevel: true, unitCost: true } }),
    db.purchaseOrder.count({ where: { status: { in: ["DRAFT", "ORDERED", "PARTIAL"] } } }),
    // Payables total (DB SUM) + overdue count — not a truncated take:500 slice.
    Promise.all([
      prisma.$queryRaw<{ balance: number | null }[]>`
        SELECT COALESCE(SUM(CASE WHEN "totalAmount" > "paidAmount" THEN "totalAmount" - "paidAmount" ELSE 0 END), 0) AS balance
        FROM "SupplierBill" WHERE "orgId" = ${orgId} AND "status" IN ('POSTED','PART_PAID')`,
      db.supplierBill.count({ where: { status: { in: ["POSTED", "PART_PAID"] }, dueAt: { lt: asOf } } }),
    ]),
    db.lead.groupBy({ by: ["status"], _count: { status: true }, _sum: { estimatedValue: true } }),
    db.salesTarget.aggregate({ where: { period: monthKey }, _sum: { targetRevenue: true, targetValue: true, actualValue: true } }),
  ]);

  const completedRepairValue = sum(completedThisMonth.map((job) => getClientBill(job) ?? 0));
  const completedRepairValuePrev = sum(completedPrevMonth.map((job) => getClientBill(job) ?? 0));
  const externalRepairCost = sum(completedThisMonth.map((job) => resolveTechCost(job.externalTechFee, job.externalTechBill)));
  const cashReceived = cashCurrent.total;
  const cashReceivedPrev = cashPrevious.total;
  const expenses = expensesThisMonth._sum.amount ?? 0;
  const expensesPrev = expensesPrevMonth._sum.amount ?? 0;
  // Cash actually paid to suppliers this month. baseAmountSent is what left the
  // bank including the transfer fee; where it was not recorded, fall back to the
  // sum the supplier received.
  const supplierPaid =
    (supplierPaidThisMonth._sum.baseAmountSent ?? 0) || (supplierPaidThisMonth._sum.amount ?? 0);
  const supplierPaidTodayTotal =
    (supplierPaidToday._sum.baseAmountSent ?? 0) || (supplierPaidToday._sum.amount ?? 0);

  // Stock purchases are money out and were missing from this figure entirely.
  // A month with UGX 5M of parts bought did not move "cash after costs" at all,
  // which is the headline the insights page leads with and warns on — so it
  // read healthy in exactly the months when cash was tightest.
  const cashMarginSignal = cashReceived - externalRepairCost - expenses - supplierPaid;
  const lowStockParts = parts.filter((part) => part.reorderLevel > 0 && part.qtyOnHand <= part.reorderLevel);
  const inventoryValue = sum(parts.map((part) => part.qtyOnHand * (part.unitCost ?? 0)));
  const overdueJobs = openJobs.filter((job) => daysBetween(job.receivedAt, asOf) >= 7);
  const staleJobs = openJobs.filter((job) => daysBetween(job.updatedAt, asOf) >= 3);
  const awaitingApproval = openJobs.filter((job) => job.status === "AWAITING_APPROVAL");
  const waitingForParts = openJobs.filter((job) => job.status === "WAITING_FOR_PARTS");
  const receivables = Number(invoiceReceivableRows[0]?.balance ?? 0);
  const payables = Number(billPayableRows[0]?.balance ?? 0);
  const target = (salesTargets._sum.targetRevenue ?? 0) + (salesTargets._sum.targetValue ?? 0);
  const targetActual = salesTargets._sum.actualValue ?? cashReceived;

  return {
    generatedAt: asOf.toISOString(),
    period: monthKey,
    currency,
    repairs: {
      jobsThisMonth,
      jobsPrevMonth,
      jobVolumeChangePct: pctChange(jobsThisMonth, jobsPrevMonth),
      completedThisMonth: completedThisMonth.length,
      completedPrevMonth: completedPrevMonth.length,
      openJobs: openJobs.length,
      overdueJobs: overdueJobs.length,
      staleJobs: staleJobs.length,
      awaitingApproval: awaitingApproval.length,
      waitingForParts: waitingForParts.length,
      averageTurnaroundDays: completedThisMonth.length
        ? sum(completedThisMonth.map((job) => daysBetween(job.receivedAt, job.completedAt ?? asOf))) / completedThisMonth.length
        : 0,
      statusDistribution: jobsByStatus.map((item) => ({ status: item.status, count: item._count.status })),
    },
    sales: {
      posCashReceived: cashCurrent.products,
      posCashReceivedPrev: cashPrevious.products,
      invoiceCashReceived: cashCurrent.corporate + cashCurrent.unallocated,
      invoiceCashReceivedPrev: cashPrevious.corporate + cashPrevious.unallocated,
      openLeads: leadsByStatus.filter((lead) => !["WON", "LOST"].includes(lead.status)).reduce((count, lead) => count + lead._count.status, 0),
      wonLeads: leadsByStatus.find((lead) => lead.status === "WON")?._count.status ?? 0,
      pipelineValue: sum(leadsByStatus.map((lead) => lead._sum.estimatedValue ?? 0)),
      leadDistribution: leadsByStatus.map((lead) => ({ status: lead.status, count: lead._count.status, estimatedValue: lead._sum.estimatedValue ?? 0 })),
      target,
      targetActual,
      targetProgressPct: target > 0 ? (targetActual / target) * 100 : null,
    },
    // Today, so the shortest question has an answer. Same definitions as the
    // monthly figures, a different window — which is the whole point of making
    // period an argument rather than a hard-coded month.
    today: {
      date: asOf.toISOString().slice(0, 10),
      collected: cashToday.total,
      collectedYesterday: cashYesterday.total,
      collectedByChannel: {
        repairs: cashToday.repairs,
        products: cashToday.products,
        corporate: cashToday.corporate,
        unallocated: cashToday.unallocated,
      },
      spent: (expensesToday._sum.amount ?? 0) + supplierPaidTodayTotal,
      expensesPaid: expensesToday._sum.amount ?? 0,
      supplierPaid: supplierPaidTodayTotal,
      netCash: cashToday.total - (expensesToday._sum.amount ?? 0) - supplierPaidTodayTotal,
    },
    finance: {
      cashReceived,
      cashReceivedPrev,
      cashReceivedChangePct: pctChange(cashReceived, cashReceivedPrev),
      cashReceivedByChannel: {
        repairs: cashCurrent.repairs,
        products: cashCurrent.products,
        corporate: cashCurrent.corporate,
        unallocated: cashCurrent.unallocated,
      },
      completedRepairValue,
      completedRepairValuePrev,
      completedRepairValueChangePct: pctChange(completedRepairValue, completedRepairValuePrev),
      externalRepairCost,
      expenses,
      expensesPrev,
      expenseChangePct: pctChange(expenses, expensesPrev),
      supplierPaid,
      // Every way cash left the business this month, in one figure. Previously
      // there were three separate numbers and none of them answered "how much
      // have I spent".
      totalCashOut: expenses + supplierPaid + externalRepairCost,
      cashMarginSignal,
      receivables,
      overdueInvoices: overdueInvoicesCount,
      payables,
      overdueSupplierBills: overdueSupplierBillsCount,
    },
    inventory: {
      activeParts: parts.length,
      lowStockParts: lowStockParts.length,
      inventoryValue,
      openPurchaseOrders,
      topLowStockParts: lowStockParts.slice(0, 10).map((part) => ({
        sku: part.sku,
        name: part.name,
        qtyOnHand: part.qtyOnHand,
        reorderLevel: part.reorderLevel,
      })),
    },
    riskSignals: {
      revenueDown: cashReceived < cashReceivedPrev,
      negativeCashMargin: cashMarginSignal < 0,
      hasOverdueJobs: overdueJobs.length > 0,
      hasLowStock: lowStockParts.length > 0,
      hasOverdueReceivables: overdueInvoicesCount > 0,
      hasOverduePayables: overdueSupplierBillsCount > 0,
    },
  };
}
