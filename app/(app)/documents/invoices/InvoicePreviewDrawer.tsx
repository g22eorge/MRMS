"use client";

import { useEffect, useState } from "react";

import { useInvoicePreview } from "./InvoicePreviewProvider";

/**
 * Paper preview — embeds the actual invoice PDF (the same document the client
 * receives), not a re-render of the app detail page. The browser's native PDF
 * viewer renders it as a page on a grey backdrop.
 */
export function InvoicePreviewDrawer() {
  const { previewInvoiceId, closePreview } = useInvoicePreview();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
  }, [previewInvoiceId]);

  if (!previewInvoiceId) return null;
  const pdfUrl = `/api/invoices/${previewInvoiceId}/pdf`;

  return (
    <div className="fixed inset-0 z-[10000] flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={closePreview} />
      <div className="relative flex h-full w-full max-w-3xl flex-col bg-neutral-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-300 bg-white px-4 py-2">
          <span className="text-sm font-semibold text-gray-700">Invoice preview</span>
          <div className="flex items-center gap-2">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Open PDF ↗
            </a>
            <button
              onClick={closePreview}
              aria-label="Close preview"
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="relative flex-1">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">Loading document…</div>
          )}
          <iframe
            src={pdfUrl}
            onLoad={() => setLoading(false)}
            className="h-full w-full border-none"
            title="Invoice preview"
          />
        </div>
      </div>
    </div>
  );
}
