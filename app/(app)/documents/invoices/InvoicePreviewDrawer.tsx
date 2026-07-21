"use client";

import { useInvoicePreview } from "./InvoicePreviewProvider";
import { useEffect, useState } from "react";

export function InvoicePreviewDrawer() {
  const { previewInvoiceId, closePreview } = useInvoicePreview();
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!previewInvoiceId) {
      setHtml(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/documents/invoices/${previewInvoiceId}`, {
      credentials: "same-origin",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((rawHtml) => {
        const injected = rawHtml.replace(
          /<body[^>]*>/,
          `<body><style>
            #print-area > :first-child,
            #print-area > .action-bar { display: none !important; }
            #print-area { padding-top: 0 !important; }
          </style>`
        );
        setHtml(injected);
      })
      .catch((err) => {
        console.error("Failed to load invoice preview:", err);
        setError("Failed to load invoice.");
      })
      .finally(() => setLoading(false));
  }, [previewInvoiceId]);

  if (!previewInvoiceId) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={closePreview} />
      <div className="relative h-full w-full max-w-5xl bg-white shadow-2xl overflow-hidden">
        <button
          onClick={closePreview}
          className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow hover:bg-gray-100"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-500">Loading invoice…</div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-sm text-red-600">{error}</div>
        ) : html ? (
          <iframe srcDoc={html} className="h-full w-full border-none" title={`Invoice ${previewInvoiceId}`} />
        ) : null}
      </div>
    </div>
  );
}
