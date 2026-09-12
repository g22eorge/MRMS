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

/**
 * Inclusive calendar day containing the given instant.
 *
 * Added because the shortest question an owner asks — "how much have I
 * collected today?" — could not be answered at all. Every figure in the system
 * was computed over a calendar month, so the smallest window available was
 * "this month so far", which is not what someone standing at a counter at
 * closing time is asking.
 *
 * Local time, like every other range here. That matters: a shop closing at 8pm
 * in Kampala and a UTC day boundary disagree by three hours, and a day figure
 * that silently includes three hours of yesterday is worse than none.
 */
export function dayRange(date: Date): DateRange {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return { start, end };
}

/** The calendar day before the one containing `date`. For "versus yesterday". */
export function previousDayRange(date: Date): DateRange {
  const prev = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  return dayRange(prev);
}

/**
 * Inclusive week containing the given instant, Monday to Sunday.
 *
 * Monday-start because that is how a working week is counted here; JavaScript's
 * getDay() calls Sunday 0, so the shift is explicit rather than assumed.
 */
export function weekRange(date: Date): DateRange {
  const day = date.getDay();
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { start: dayRange(monday).start, end: dayRange(sunday).end };
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
