"use client";

import { useQuotationPreview } from "./QuotationPreviewProvider";

export function PreviewButton({ quotationId }: { quotationId: string }) {
  const { openPreview } = useQuotationPreview();
  return (
    <button
      type="button"
      onClick={() => openPreview(quotationId)}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      Preview
    </button>
  );
}
