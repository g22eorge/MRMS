/**
 * When a payment reminder is due, and what it is anchored to.
 *
 * Deliberately free of any database import. The decisions here — which rung of
 * the ladder an invoice has reached, what date its terms run from, whether the
 * hour is civil — are the part worth testing exhaustively, and they should be
 * testable without standing up Prisma. lib/notifications/payment-reminders.ts
 * does the reading and sending around them.
 *
 * Shaped by what the receivables book actually looks like rather than by what a
 * reminder feature usually does. On care at the time of writing: 19 unpaid
 * invoices, 6.3m outstanding, of which 5.1m — 82% — is still inside terms and
 * only 1.2m has aged past thirty days. So this is preventive, not recovery: it
 * protects the majority of the book from ageing, and does not pretend it can
 * collect an old debt.
 *
 * The ladder is silent for the first three weeks of a 30-day term. Chasing on
 * day three signals distrust of a customer who is not late, and teaches
 * everyone to ignore the channel before it is needed.
 */

const DAY_MS = 86_400_000;

export function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Days relative to the due date. Negative is before. */
export type ReminderStage = { key: string; offsetDays: number; tone: "courtesy" | "due" | "firm" | "final" };

export const REMINDER_LADDER: ReminderStage[] = [
  { key: "T-7", offsetDays: -7, tone: "courtesy" },
  { key: "T-1", offsetDays: -1, tone: "courtesy" },
  { key: "DUE", offsetDays: 0, tone: "due" },
  { key: "+3", offsetDays: 3, tone: "firm" },
  { key: "+10", offsetDays: 10, tone: "final" },
  // Nothing after +10. An invoice still unpaid three weeks past terms needs a
  // person, and the settings raise it for manual review rather than sending an
  // eleventh message into silence.
];

/**
 * When the clock started.
 *
 * Delivery is the correct anchor — the terms run from when the customer
 * received the goods, not from when paperwork was raised. But only a fraction
 * of invoices carry a delivery note today, so the chain falls back rather than
 * silently covering almost nothing, which is the failure mode that makes a
 * scheduled job look like it is working when it is not.
 */
export function reminderAnchor(invoice: {
  issuedAt: Date;
  deliveryNotes: Array<{ deliveredAt: Date }>;
  job: { deliveredAt: Date | null; completedAt: Date | null } | null;
}): { at: Date; source: "delivery-note" | "job-handover" | "issued" } {
  const dn = invoice.deliveryNotes.at(0);
  if (dn?.deliveredAt) return { at: dn.deliveredAt, source: "delivery-note" };
  const handover = invoice.job?.deliveredAt ?? invoice.job?.completedAt ?? null;
  if (handover) return { at: handover, source: "job-handover" };
  return { at: invoice.issuedAt, source: "issued" };
}

export function effectiveDueDate(
  invoice: Parameters<typeof reminderAnchor>[0] & { dueDate: Date | null },
  paymentTermsDays: number,
): Date {
  if (invoice.dueDate) return invoice.dueDate;
  const { at } = reminderAnchor(invoice);
  return new Date(at.getTime() + paymentTermsDays * DAY_MS);
}

/**
 * The rung that is due today, or null.
 *
 * Only ever the latest rung reached, never a backlog: an invoice that becomes
 * eligible late — because the feature was switched on, or the ladder changed —
 * must not fire four messages at once to catch up.
 */
export function stageDueNow(dueDate: Date, now: Date): ReminderStage | null {
  const days = Math.round((startOfDay(now).getTime() - startOfDay(dueDate).getTime()) / DAY_MS);
  const reached = REMINDER_LADDER.filter((s) => days >= s.offsetDays);
  return reached.at(-1) ?? null;
}

export function withinQuietHours(now: Date, startHour: number, endHour: number): boolean {
  const h = now.getHours();
  return h >= startHour && h < endHour;
}
