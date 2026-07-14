export type DateRange = { start: Date; end: Date };

/** Inclusive calendar month range. `month` is 1-indexed (January = 1). */
export function monthRange(year: number, month: number): DateRange {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

/** Month range containing the given instant (local calendar month). */
export function monthRangeFromDate(date: Date): DateRange {
  return monthRange(date.getFullYear(), date.getMonth() + 1);
}

export function previousMonthRange(date: Date): DateRange {
  const prev = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return monthRangeFromDate(prev);
}

export function yearRange(year: number): DateRange {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { start, end };
}

export function monthLabel(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthSequence(endYear: number, endMonth: number, count: number) {
  return Array.from({ length: count }, (_, idx) => {
    const d = new Date(endYear, endMonth - 1 - (count - 1 - idx), 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    return { key: monthLabel(year, month), ...monthRange(year, month) };
  });
}

export function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}
