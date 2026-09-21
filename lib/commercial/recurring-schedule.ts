/**
 * Shared schedule math for recurring templates (payables side; the
 * receivables page carries its own local copy for invoices).
 */
export type RecurringFrequency = "WEEKLY" | "MONTHLY" | "MONTH_END" | "QUARTERLY" | "ANNUAL";

export const RECURRING_FREQUENCIES = ["WEEKLY", "MONTHLY", "MONTH_END", "QUARTERLY", "ANNUAL"] as const;

export function isRecurringFrequency(value: string): value is RecurringFrequency {
  return (RECURRING_FREQUENCIES as readonly string[]).includes(value);
}

export function advanceRecurringDate(from: Date, frequency: RecurringFrequency): Date {
  const d = new Date(from);
  switch (frequency) {
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "MONTH_END":
      // Anchor to month-end: Jan 31 → Feb 28/29, never Mar 2. Hop to the
      // first of the target month (no overflow), then to its last day.
      d.setFullYear(d.getFullYear(), d.getMonth() + 1, 1);
      d.setDate(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3);
      break;
    case "ANNUAL":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

/** YYYYMM period key of a due date, so each scheduled occurrence issues once. */
export function recurringPeriodKey(dueAt: Date): string {
  const d = new Date(dueAt);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}
