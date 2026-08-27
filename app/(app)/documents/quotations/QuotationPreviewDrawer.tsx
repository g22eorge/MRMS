"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useQuotationPreview } from "./QuotationPreviewProvider";

/**
 * Paper preview — embeds the actual quotation PDF (served by the [id] route's
 * GET; there is no /pdf subroute), not a re-render of the app detail page.
 */
export function QuotationPreviewDrawer() {
  const { previewQuotationId, closePreview } = useQuotationPreview();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
  }, [previewQuotationId]);

  if (!previewQuotationId || typeof document === "undefined") return null;
  const pdfUrl = `/api/quotations/${previewQuotationId}`;

  // Portaled to document.body: <main> carries `fade-in`, an animation with
  // `fill-mode: both` whose final frame is `transform: translateY(0)`. That
  // transform persists and makes <main> the containing block for its
  // position:fixed descendants, so this overlay covered only the content column
  // instead of the viewport.
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={closePreview} />
      <div className="relative flex h-full w-full max-w-3xl flex-col bg-neutral-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-300 bg-white px-4 py-2">
          <span className="text-sm font-semibold text-gray-700">Quotation preview</span>
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
            title="Quotation preview"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
