"use client";

import Link from "next/link";

import { PageStatePanel } from "./PageStatePanel";

export function PageErrorState({
  eyebrow = "Page Error",
  title = "We could not load this screen",
  description = "Please retry. If this keeps happening, refresh the page or contact support.",
  digest,
  onRetry,
  backHref = "/dashboard",
  backLabel = "Back to dashboard",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  digest?: string | null;
  onRetry: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <PageStatePanel
      eyebrow={eyebrow}
      title={title}
      description={
        digest
          ? `${description} Reference: ${digest}.`
          : description
      }
      align="start"
    >
      <button type="button" onClick={onRetry} className="btn-premium rounded-lg px-4 py-2.5 text-sm font-semibold text-white">
        Retry
      </button>
      <Link href={backHref} className="btn-premium-secondary rounded-lg px-4 py-2.5 text-sm font-semibold">
        {backLabel}
      </Link>
    </PageStatePanel>
  );
}
