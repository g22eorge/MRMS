import {
  expireStaleQuotationDraftsAction,
  sendQuoteFollowUpAction,
  sendQuoteFollowUpsBulkAction,
} from "@/app/(app)/documents/quotations/followup-actions";

type FollowUpContext = {
  returnTo: string;
};

export function QuoteFollowUpButton({
  jobId,
  quotationId,
  context,
  compact = false,
}: {
  jobId?: string;
  quotationId?: string;
  context: FollowUpContext;
  compact?: boolean;
}) {
  return (
    <form action={sendQuoteFollowUpAction}>
      {jobId ? <input type="hidden" name="jobId" value={jobId} /> : null}
      {quotationId ? <input type="hidden" name="quotationId" value={quotationId} /> : null}
      <input type="hidden" name="returnTo" value={context.returnTo} />
      <button
        type="submit"
        className={
          compact
            ? "rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[12px] font-bold text-sky-800 dark:text-sky-300"
            : "rounded-lg bg-sky-600 px-3 py-1.5 text-[12px] font-bold text-white"
        }
      >
        Send follow-up
      </button>
    </form>
  );
}

export function QuoteFollowUpBulkButton({
  count,
  context,
}: {
  count: number;
  context: FollowUpContext;
}) {
  return (
    <form action={sendQuoteFollowUpsBulkAction} className="inline-flex">
      <input type="hidden" name="returnTo" value={context.returnTo} />
      <button
        type="submit"
        className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-[12px] font-bold text-sky-800 transition hover:bg-sky-500/20 dark:text-sky-300"
      >
        Follow up all awaiting ({count})
      </button>
    </form>
  );
}

export function ExpireStaleDraftsButton({
  count,
  context,
}: {
  count: number;
  context: FollowUpContext;
}) {
  return (
    <form action={expireStaleQuotationDraftsAction} className="inline-flex">
      <input type="hidden" name="returnTo" value={context.returnTo} />
      <button
        type="submit"
        className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[12px] font-bold text-amber-800 transition hover:bg-amber-500/20 dark:text-amber-300"
      >
        Expire stale drafts ({count})
      </button>
    </form>
  );
}
