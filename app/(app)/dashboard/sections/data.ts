import { getClientBill, resolveTechCost } from "@/lib/billing";
import { getAppCurrency, toBaseAmount } from "@/lib/currency";
import { formatEATMonthLabel } from "@/lib/date-eat";
import { monthLabel, monthSequence } from "@/lib/date-ranges";
import { prisma } from "@/lib/prisma";

/** Shared dashboard period/trend helpers — extracted from page.tsx unchanged. */

export type PeriodFilters = {
  month?: string;
  year?: string;
  period?: string;
};

export type TrendMonth = { key: string; start: Date; end: Date };

export function parseMonth(monthParam?: string) {
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

export function asDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthCountInclusive(startYear: number, startMonth: number, endYear: number, endMonth: number) {
  const startIndex = startYear * 12 + (startMonth - 1);
  const endIndex = endYear * 12 + (endMonth - 1);
  return Math.max(1, endIndex - startIndex + 1);
}

export function trendMonthsSinceStartOfYear(end: Date) {
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;
  const count = monthCountInclusive(endYear, 1, endYear, endMonth);
  return monthSequence(endYear, endMonth, count);
}

export function trendMonthsForYear(year: number, endMonth: number) {
  const safeMonth = Math.min(12, Math.max(1, endMonth));
  const count = monthCountInclusive(year, 1, year, safeMonth);
  return monthSequence(year, safeMonth, count);
}

/** Repair revenue only — job clientBill on COMPLETED jobs (used by TECH_MANAGER) */
export async function loadRepairRevenueTrend(trendMonths: TrendMonth[], orgId?: string | null) {
  // Single query — externalTechFee (admin override) and externalTechBill both selected directly,
  // eliminating the second getJobPayoutsByIds round-trip
  const completed = await prisma.job.findMany({
    where: {
      ...(orgId ? { orgId } : {}),
      status: "COMPLETED",
      completedAt: { gte: trendMonths[0].start, lte: trendMonths[trendMonths.length - 1].end },
    },
    select: { id: true, clientBill: true, externalTechFee: true, externalTechBill: true, completedAt: true },
  });

  return trendMonths.map((m) => {
    const monthJobs = completed.filter((j) => j.completedAt && j.completedAt >= m.start && j.completedAt <= m.end);
    const revenue = monthJobs.reduce((sum, j) => sum + (getClientBill(j) ?? 0), 0);
    const cost = monthJobs.reduce((sum, j) => sum + resolveTechCost(j.externalTechFee, j.externalTechBill), 0);
    return { key: m.key, revenue, margin: revenue - cost };
  });
}

/** Sales revenue only — single wide-range fetch, bucketed in memory (2 queries total, not N×2) */
export async function loadSalesRevenueTrend(trendMonths: TrendMonth[], orgId?: string | null, currency = getAppCurrency()) {
  if (!orgId || trendMonths.length === 0) return trendMonths.map((m) => ({ key: m.key, revenue: 0, margin: 0 }));
  const rangeStart = trendMonths[0].start;
  const rangeEnd   = trendMonths[trendMonths.length - 1].end;

  const [payments] = await Promise.all([
    prisma.payment.findMany({
      where: { orgId, kind: "PAYMENT", receivedAt: { gte: rangeStart, lte: rangeEnd } },
      select: { amount: true, currency: true, exchangeRateToBase: true, saleId: true, receivedAt: true, invoice: { select: { invoiceType: true } } },
    }),
  ]);

  return trendMonths.map((m) => {
    let revenue = 0;
    for (const p of payments) {
      if (!p.receivedAt || p.receivedAt < m.start || p.receivedAt > m.end) continue;
      const amt = toBaseAmount({ amount: p.amount, currency: p.currency, baseCurrency: currency, exchangeRateToBase: p.exchangeRateToBase });
      // sales channel = POS sales or non-repair invoices
      if (p.saleId || (p.invoice && p.invoice.invoiceType !== "REPAIR")) revenue += amt;
    }
    return { key: m.key, revenue, margin: revenue };
  });
}

/** Total revenue — repairs + POS + invoices combined (used by ADMIN) */
export async function loadTotalRevenueTrend(trendMonths: TrendMonth[], orgId?: string | null, currency = getAppCurrency()) {
  const [repairTrend, salesTrend] = await Promise.all([
    loadRepairRevenueTrend(trendMonths, orgId),
    loadSalesRevenueTrend(trendMonths, orgId, currency),
  ]);

  return trendMonths.map((m, i) => ({
    key: m.key,
    revenue: (repairTrend[i]?.revenue ?? 0) + (salesTrend[i]?.revenue ?? 0),
    margin:  (repairTrend[i]?.margin  ?? 0) + (salesTrend[i]?.margin  ?? 0),
  }));
}

export function monthOptions(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = monthLabel(date.getFullYear(), date.getMonth() + 1);
    const label = formatEATMonthLabel(date.getFullYear(), date.getMonth() + 1);
    return { value, label };
  });
}

export function yearOptions(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const year = now.getFullYear() - index;
    return { value: String(year), label: `${year} Annual Package` };
  });
}
