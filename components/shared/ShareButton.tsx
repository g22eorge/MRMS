"use client";

/**
 * ShareButton — native Web Share API trigger for document PDFs.
 *
 * On mobile it opens the OS share sheet (WhatsApp, Messages, Mail, etc.).
 * On desktop where `navigator.share` is unavailable it renders nothing, so
 * callers should keep their existing download link as the fallback.
 */
export function ShareButton({ url }: { url: string }) {
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  if (!canShare) return null;

  async function handleShare() {
    try {
      await navigator.share({ url });
    } catch {
      // User dismissed the share sheet or sharing failed — nothing to do.
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="Share document"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--ink)] hover:bg-[var(--panel-strong)]/50"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-2 2 2 2h10a2 2 0 0 0 2-2v-2" />
        <path d="M16 21l5-2" />
        <path d="M21 15v2" />
        <circle cx="8.5" cy="7" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    </button>
  );
}
