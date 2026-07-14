import { monthRangeFromDate, previousMonthRange } from "@/lib/date-ranges";

export type DocumentPeriodKey = "all" | "this_month" | "last_month" | "last_30";

export const DOCUMENT_PERIOD_OPTIONS: { key: DocumentPeriodKey; label: string }[] = [
  { key: "all", label: "All Time" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "last_30", label: "Last 30 Days" },
];

export const DOCUMENT_PERIOD_OPTIONS_SHORT: { key: DocumentPeriodKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
];

/** Prisma date filter for `receivedAt` / `deliveredAt` style columns. */
export function dateFilterForDocumentPeriod(
  period: string,
  now = new Date(),
): { gte?: Date; lte?: Date } | undefined {
  if (period === "this_month") {
    return { gte: monthRangeFromDate(now).start };
  }
  if (period === "last_month") {
    const range = previousMonthRange(now);
    return { gte: range.start, lte: range.end };
  }
  if (period === "last_30") {
    return { gte: new Date(now.getTime() - 30 * 86_400_000) };
  }
  return undefined;
}

/** Client-side period match (delivery notes filter in memory). */
export function matchesDocumentPeriod(date: Date, period: string, now = new Date()): boolean {
  if (period === "all" || !period) return true;
  if (period === "this_month") return date >= monthRangeFromDate(now).start;
  if (period === "last_month") {
    const range = previousMonthRange(now);
    return date >= range.start && date <= range.end;
  }
  if (period === "last_30") {
    return date >= new Date(now.getTime() - 30 * 86_400_000);
  }
  return true;
}

export function documentPeriodLabel(period: string): string {
  return DOCUMENT_PERIOD_OPTIONS.find((opt) => opt.key === period)?.label ?? period;
}
