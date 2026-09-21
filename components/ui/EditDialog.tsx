"use client";

import Link from "next/link";
import { createPortal } from "react-dom";

/**
 * Shared edit-dialog shell (Documents-style): portaled modal, title bar with
 * a Cancel link that drops the ?edit param. Content is server-rendered so
 * existing server actions keep working unchanged.
 *
 * Portaled to document.body: <main> carries `fade-in`, whose `fill-mode: both`
 * leaves a transform applied permanently, making <main> the containing block
 * for position:fixed descendants.
 */
export function EditDialog({
  title,
  closeHref,
  wide,
  children,
}: {
  title: string;
  closeHref: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 overflow-y-auto">
      <Link href={closeHref} aria-label="Close" className="fixed inset-0 bg-black/55 backdrop-blur-sm" />
      <div className="flex min-h-screen items-start justify-center p-4 sm:p-6">
        <div className={`relative w-full ${wide ? "max-w-3xl" : "max-w-xl"} rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl overflow-hidden`}>
          <div className="p-4 border-b border-[var(--line)] flex items-center justify-between">
            <p className="text-[0.8125rem] font-bold text-[var(--ink)]">{title}</p>
            <Link
              href={closeHref}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--panel-strong)]"
            >
              Cancel
            </Link>
          </div>
          <div className="p-4 max-h-[80vh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
