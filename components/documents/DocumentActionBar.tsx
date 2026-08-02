import Link from "next/link";
import type { ReactNode } from "react";

import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";

/**
 * DocumentActionBar — the single top action bar for a document detail page
 * (invoice, quotation, receipt, …). One row: Back · eyebrow+title · status pill
 * · then the ranked action cluster (secondary buttons → primary → overflow ⋮).
 *
 * This replaces the old pattern of splitting actions across a PageHeader row and
 * a second row below the stat strip. The caller composes concrete action nodes;
 * this component only owns the layout and the ranking slots so every document
 * type reads the same. Reuse it — do not hand-roll per-page action rows.
 */
export function DocumentActionBar({
  backHref,
  eyebrow,
  title,
  status,
  primary,
  secondary,
  overflow,
}: {
  backHref: string;
  eyebrow: string;
  title: string;
  status?: { label: string; tone: BadgeTone } | null;
  /** The one contextual primary action (e.g. Collect Payment). */
  primary?: ReactNode;
  /** Secondary buttons — Send, PDF, Edit. */
  secondary?: ReactNode;
  /** The ⋮ overflow menu node (destructive / rare actions). */
  overflow?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
      <Link
        href={backHref}
        aria-label="Back"
        className="btn-premium-secondary flex h-8 w-8 items-center justify-center rounded-lg text-[13px]"
      >
        ←
      </Link>

      <div className="min-w-0">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
          {eyebrow}
        </p>
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-[16px] font-bold leading-tight">{title}</h1>
          {status ? (
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          ) : null}
        </div>
      </div>

      {(secondary || primary || overflow) && (
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {secondary}
          {primary}
          {overflow}
        </div>
      )}
    </div>
  );
}
