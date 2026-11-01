"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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

  if (!previewInvoiceId || typeof document === "undefined") return null;
  const pdfUrl = `/api/invoices/${previewInvoiceId}/pdf`;

  async function handleDownload() {
    try {
      const res = await fetch(pdfUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${previewInvoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fall back to opening the PDF directly so the user can still save it.
      window.open(pdfUrl, "_blank");
    }
  }

  async function handleShare() {
    const shareData = {
      title: `Invoice #${previewInvoiceId}`,
      text: "View this invoice PDF",
      url: pdfUrl,
    };
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share(shareData);
        return;
      } catch {
        // User cancelled or share failed — fall through to copy fallback.
      }
    }
    // Fallback: copy link to clipboard.
    try {
      await navigator.clipboard.writeText(pdfUrl);
    } catch {
      window.open(pdfUrl, "_blank");
    }
  }

  // Portaled to document.body: <main> carries `fade-in`, an animation with
  // `fill-mode: both` whose final frame is `transform: translateY(0)`. That
  // transform persists and makes <main> the containing block for its
  // position:fixed descendants, so this overlay covered only the content column
  // instead of the viewport.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Invoice preview" className="fixed inset-0 z-[10000] flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={closePreview} />
      <div className="relative flex h-full w-full max-w-3xl flex-col bg-neutral-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-300 bg-white px-4 py-2">
          <span className="text-sm font-semibold text-gray-700">Invoice preview</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              aria-label="Download invoice PDF"
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
              title="Download"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            <button
              onClick={handleShare}
              aria-label="Share invoice PDF"
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
              title="Share"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.42" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
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
    </div>,
    document.body,
  );
}
