import {
  sendOverdueInvoiceReminderAction,
  sendOverdueInvoiceRemindersBulkAction,
} from "@/app/(app)/documents/invoices/reminder-actions";

type ReminderContext = {
  returnTo: string;
  aging?: string;
};

export function InvoiceOverdueReminderButton({
  invoiceId,
  context,
  compact = false,
}: {
  invoiceId: string;
  context: ReminderContext;
  compact?: boolean;
}) {
  return (
    <form action={sendOverdueInvoiceReminderAction}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="returnTo" value={context.returnTo} />
      {context.aging ? <input type="hidden" name="aging" value={context.aging} /> : null}
      <button
        type="submit"
        className={
          compact
            ? "rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[12px] font-bold text-amber-800 dark:text-amber-300"
            : "rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-bold text-white"
        }
      >
        Send reminder
      </button>
    </form>
  );
}

export function InvoiceOverdueReminderBulkButton({
  aging,
  count,
  context,
}: {
  aging: string;
  count: number;
  context: ReminderContext;
}) {
  return (
    <form action={sendOverdueInvoiceRemindersBulkAction} className="inline-flex">
      <input type="hidden" name="aging" value={aging} />
      <input type="hidden" name="returnTo" value={context.returnTo} />
      <button
        type="submit"
        className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[12px] font-bold text-amber-800 transition hover:bg-amber-500/20 dark:text-amber-300"
      >
        Remind all in bucket ({count})
      </button>
    </form>
  );
}
