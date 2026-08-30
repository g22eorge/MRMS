/**
 * What the reminder settings add up to, said in one line.
 *
 * Two independent switches decide whether a customer is chased: reminders are
 * enabled, and preview-only is cleared. Both are well explained where they are
 * set. Neither says what the pair currently amounts to, and the combination
 * that matters — on, but still previewing — is the one where a business
 * believes it has handed collections to the system and has not.
 *
 * The engine itself is honest: it records "dry-run" separately from "queued"
 * and the cron summary counts them apart. So this is not a correctness problem
 * to fix but a silence to break, and the fix is a sentence rather than a change
 * of behaviour. The preview-first default is deliberate and good — a ladder
 * that speaks on the business's behalf should be read for a fortnight before it
 * is trusted — and it is left exactly as it is.
 */

export type ReminderState = {
  mode: "off" | "preview" | "live";
  /** Short enough for a status line; plain enough to act on. */
  headline: string;
  detail: string;
  /** True only for the combination someone is most likely to misread. */
  looksOnButSendsNothing: boolean;
};

export function reminderState(settings: { enabled: boolean; dryRun: boolean } | null): ReminderState {
  if (!settings?.enabled) {
    return {
      mode: "off",
      headline: "Automatic reminders are off",
      detail: "Overdue invoices are only chased when someone sends a reminder by hand.",
      looksOnButSendsNothing: false,
    };
  }

  if (settings.dryRun) {
    return {
      mode: "preview",
      headline: "Reminders are on, but in preview — nothing is reaching customers",
      detail:
        "Every reminder that would have gone out is written to the outbox and marked PREVIEW, so the " +
        "ladder can be read before it speaks for the business. Clear “Preview only” when you are " +
        "satisfied with it. Until then, overdue invoices still need chasing by hand.",
      looksOnButSendsNothing: true,
    };
  }

  return {
    mode: "live",
    headline: "Automatic reminders are being sent",
    detail: "Overdue invoices are chased on their schedule. Every attempt is recorded in the outbox.",
    looksOnButSendsNothing: false,
  };
}
