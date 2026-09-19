/**
 * Shared schedule math for recurring templates (payables side; the
 * receivables page carries its own local copy for invoices).
 */
export type RecurringFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";

export const RECURRING_FREQUENCIES = ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"] as const;

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
