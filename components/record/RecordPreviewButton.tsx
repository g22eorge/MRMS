"use client";

import { useEffect, useState } from "react";

/**
 * RecordPreviewButton — self-contained paper preview for any record with a PDF.
 * Drop it into a row/detail menu with the document's PDF URL — it manages its own
 * drawer and embeds the real PDF (the same document the client receives). No page-
 * level provider needed. (Documents import it as `DocumentPreviewButton`.)
 */
export function RecordPreviewButton({
  pdfUrl,
  title = "Document",
  label = "Preview",
  variant = "menu",
}: {
  pdfUrl: string;
  title?: string;
  label?: string;
  /** "menu" (default) = full-width dropdown row; "button" = compact inline action. */
  variant?: "menu" | "button";
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // The PDF routes default to `Content-Disposition: attachment` (download). For
  // the embedded preview we ask for an inline disposition so it renders in the
  // iframe instead of triggering a download (which shows a blank/white frame).
  const inlineUrl = pdfUrl + (pdfUrl.includes("?") ? "&" : "?") + "inline=1";

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const eye = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  return (
    <>
      {variant === "button" ? (
        <button
          type="button"
          onClick={() => { setLoading(true); setOpen(true); }}
          className="btn-premium-secondary inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold"
        >
          <span aria-hidden="true" className="opacity-80">{eye}</span>
          {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => { setLoading(true); setOpen(true); }}
          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center opacity-80" aria-hidden="true">{eye}</span>
          <span className="min-w-0 flex-1">{label}</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[10000] flex items-stretch justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-full max-w-3xl flex-col bg-neutral-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-300 bg-white px-4 py-2">
              <span className="truncate text-sm font-semibold text-gray-700">{title}</span>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={inlineUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Open PDF ↗
                </a>
                <button
                  onClick={() => setOpen(false)}
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
              <iframe src={inlineUrl} onLoad={() => setLoading(false)} className="h-full w-full border-none" title={title} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
