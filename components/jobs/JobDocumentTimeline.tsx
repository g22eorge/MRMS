import Link from "next/link";

import { formatEATDateTime } from "@/lib/date-eat";
import { formatMoney } from "@/lib/currency";
import {
  JOB_DOCUMENT_KIND_LABELS,
  type JobDocumentTimelineEntry,
} from "@/lib/jobs/job-document-timeline-shared";

const KIND_CHIP_CLASS: Record<JobDocumentTimelineEntry["kind"], string> = {
  job_card: "bg-sky-500/12 text-sky-700",
  quotation: "bg-teal-500/12 text-teal-700",
  invoice: "bg-amber-500/12 text-amber-700",
  receipt: "bg-emerald-500/12 text-emerald-700",
  delivery_note: "bg-blue-500/12 text-blue-700",
  refund: "bg-amber-500/12 text-amber-700",
};

export function JobDocumentTimeline({
  entries,
  baseCurrency,
}: {
  entries: JobDocumentTimelineEntry[];
  baseCurrency: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl bg-[var(--panel-strong)] px-4 py-8 text-center">
        <p className="text-sm font-semibold text-[var(--ink)]">No documents yet</p>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Job cards, quotes, invoices, and receipts for this repair will appear here in order.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-start gap-3 border-t border-[var(--line)] py-3 first:border-t-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${KIND_CHIP_CLASS[entry.kind]}`}>
                {JOB_DOCUMENT_KIND_LABELS[entry.kind]}
              </span>
              {entry.status ? (
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
                  {entry.status.replaceAll("_", " ")}
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-[13px] font-semibold text-[var(--ink)]">{entry.label}</p>
            <p className="text-[11.5px] text-[var(--ink-muted)]">{formatEATDateTime(entry.occurredAt)}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {typeof entry.amount === "number" ? (
              <p className="text-[13px] font-bold tabular-nums text-[var(--ink)]">
                {formatMoney(entry.amount, entry.currency ?? baseCurrency)}
              </p>
            ) : null}
            <div className="flex items-center gap-3">
              <a href={entry.pdfHref} target="_blank" rel="noreferrer" className="text-[11.5px] font-semibold text-[var(--accent)]">Open PDF →</a>
              <Link href={entry.listHref} className="text-[11.5px] font-medium text-[var(--ink-muted)]">List</Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
