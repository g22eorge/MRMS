import Link from "next/link";

import { formatEATDateTime } from "@/lib/date-eat";
import { formatMoney } from "@/lib/currency";
import {
  JOB_DOCUMENT_KIND_LABELS,
  type JobDocumentTimelineEntry,
} from "@/lib/jobs/job-document-timeline";

const KIND_CHIP_CLASS: Record<JobDocumentTimelineEntry["kind"], string> = {
  job_card: "bg-sky-500/12 text-sky-700",
  quotation: "bg-teal-500/12 text-teal-700",
  invoice: "bg-amber-500/12 text-amber-700",
  receipt: "bg-emerald-500/12 text-emerald-700",
  delivery_note: "bg-blue-500/12 text-blue-700",
  refund: "bg-orange-500/12 text-orange-700",
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
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--panel-strong)]/60 px-4 py-6 text-center">
        <p className="text-sm font-semibold text-[var(--ink)]">No documents yet</p>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          Job cards, quotes, invoices, and receipts for this repair will appear here in order.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-3 pb-5">
            {!isLast ? (
              <span
                aria-hidden="true"
                className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-px bg-[var(--line)]"
              />
            ) : null}
            <span
              aria-hidden="true"
              className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)] text-[10px] font-bold text-[var(--ink-muted)]`}
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)]/70 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${KIND_CHIP_CLASS[entry.kind]}`}
                    >
                      {JOB_DOCUMENT_KIND_LABELS[entry.kind]}
                    </span>
                    {entry.status ? (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                        {entry.status.replaceAll("_", " ")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-sm font-bold text-[var(--ink)]">{entry.label}</p>
                  <p className="text-xs text-[var(--ink-muted)]">{formatEATDateTime(entry.occurredAt)}</p>
                  {typeof entry.amount === "number" ? (
                    <p className="mt-1 text-xs font-semibold text-[var(--ink)]">
                      {formatMoney(entry.amount, entry.currency ?? baseCurrency)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <a
                    href={entry.pdfHref}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-premium-secondary rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                  >
                    PDF
                  </a>
                  <Link
                    href={entry.listHref}
                    className="btn-premium-secondary rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                  >
                    Open list
                  </Link>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
