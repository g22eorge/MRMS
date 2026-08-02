"use client";

/**
 * One consistent Export action for every finance report. Uses the browser's
 * print dialog (→ "Save as PDF"), and the global `@media print` rules isolate
 * the `.print-area` report content from the app chrome. Marked `no-print` so
 * the button itself never appears on the printout.
 */
export function PrintReportButton({ label = "Print / PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
      {label}
    </button>
  );
}
