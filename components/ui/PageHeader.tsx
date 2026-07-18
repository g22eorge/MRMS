import type { ReactNode } from "react";

import { StatStrip, type StatTile } from "./StatStrip";

/**
 * App-wide page header — the single way to render a list/detail page's
 * eyebrow + title + actions (and optional embedded KPI strip).
 * Generalized from the documents module's page header; use everywhere
 * instead of hand-rolled header cards.
 */

export type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  /** Right-aligned action buttons/links. */
  actions?: ReactNode;
  /** Optional KPI tiles rendered inside the header card. */
  kpis?: StatTile[];
};

export function PageHeader({ title, eyebrow, description, actions, kpis }: PageHeaderProps) {
  return (
    <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${kpis && kpis.length > 0 ? "border-b border-[var(--line)]" : ""}`}>
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">{eyebrow}</p>
          ) : null}
          <h1 className="truncate text-[15px] font-bold leading-tight text-[var(--ink)]">{title}</h1>
          {description ? <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {kpis && kpis.length > 0 ? <StatStrip tiles={kpis} variant="embedded" /> : null}
    </div>
  );
}
