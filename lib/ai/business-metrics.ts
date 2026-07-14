// orgDb is loosely typed; keep this module aligned with AI surfaces until scoper types land.
// @ts-nocheck
import { getClientBill, resolveTechCost } from "@/lib/billing";
import { getAppCurrency } from "@/lib/currency";
import { daysBetween, monthRangeFromDate, previousMonthRange } from "@/lib/date-ranges";
import { loadCashCollectionsByChannel } from "@/lib/finance/reconciliation";
import { orgDb, prisma } from "@/lib/prisma";

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
    openInvoices,
    expensesThisMonth,
    expensesPrevMonth,
    parts,
    openPurchaseOrders,
    supplierBills,
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
    db.invoice.findMany({
      where: { status: { in: ["DRAFT", "ISSUED"] } },
      select: { invoiceNumber: true, totalAmount: true, paidAmount: true, dueDate: true, issuedAt: true },
      orderBy: { issuedAt: "asc" },
      take: 500,
    }),
    db.expense.aggregate({ where: { paidAt: { gte: current.start, lte: current.end } }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { paidAt: { gte: previous.start, lte: previous.end } }, _sum: { amount: true } }),
    db.part.findMany({ where: { isActive: true }, select: { sku: true, name: true, qtyOnHand: true, reorderLevel: true, unitCost: true } }),
    db.purchaseOrder.count({ where: { status: { in: ["DRAFT", "ORDERED", "PARTIAL"] } } }),
    db.supplierBill.findMany({
      where: { status: { in: ["POSTED", "PART_PAID"] } },
      select: { billNumber: true, totalAmount: true, paidAmount: true, dueAt: true, supplier: { select: { name: true } } },
      orderBy: { issuedAt: "asc" },
      take: 500,
    }),
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
  const cashMarginSignal = cashReceived - externalRepairCost - expenses;
  const lowStockParts = parts.filter((part) => part.reorderLevel > 0 && part.qtyOnHand <= part.reorderLevel);
  const inventoryValue = sum(parts.map((part) => part.qtyOnHand * (part.unitCost ?? 0)));
  const overdueJobs = openJobs.filter((job) => daysBetween(job.receivedAt, asOf) >= 7);
  const staleJobs = openJobs.filter((job) => daysBetween(job.updatedAt, asOf) >= 3);
  const awaitingApproval = openJobs.filter((job) => job.status === "AWAITING_APPROVAL");
  const waitingForParts = openJobs.filter((job) => job.status === "WAITING_FOR_PARTS");
  const overdueInvoices = openInvoices.filter((invoice) => invoice.dueDate && invoice.dueDate < asOf);
  const receivables = sum(openInvoices.map((invoice) => Math.max(0, invoice.totalAmount - invoice.paidAmount)));
  const overdueSupplierBills = supplierBills.filter((bill) => bill.dueAt && bill.dueAt < asOf);
  const payables = sum(supplierBills.map((bill) => Math.max(0, bill.totalAmount - bill.paidAmount)));
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
      cashMarginSignal,
      receivables,
      overdueInvoices: overdueInvoices.length,
      payables,
      overdueSupplierBills: overdueSupplierBills.length,
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
      hasOverdueReceivables: overdueInvoices.length > 0,
      hasOverduePayables: overdueSupplierBills.length > 0,
    },
  };
}
