import type { ReactNode } from "react";

import { StatCards, type StatCard } from "./StatCards";

/**
 * App-wide page header — the single way to render a list/detail page's
 * eyebrow + title + actions, plus an optional KPI band.
 *
 * `kpis` render as the flat `StatCards` band beneath the header card (the same
 * treatment as the jobs list), so every page's summary numbers read the same.
 * Do not hand-roll bordered KPI tiles.
 */

export type PageHeaderProps = {
  /** Omit where the layout header already names the page — it renders one
   *  <h1> per view, and two identical ones is the duplication this removes. */
  title?: string;
  eyebrow?: string;
  description?: string;
  /** Right-aligned action buttons/links. */
  actions?: ReactNode;
  /** Optional KPI cards rendered as a flat band below the header. */
  kpis?: StatCard[];
};

export function PageHeader({ title, eyebrow, description, actions, kpis }: PageHeaderProps) {
  return (
    <>
      <div className="dc-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">{eyebrow}</p>
            ) : null}
            {title ? <h1 className="truncate text-[0.9375rem] font-bold leading-tight text-[var(--ink)]">{title}</h1> : null}
            {description ? <p className="mt-0.5 text-[0.75rem] text-[var(--ink-muted)]">{description}</p> : null}
          </div>
          {/* items-start, not items-center: an action that is two lines tall — the
              month picker carries a "reporting window" line under its select —
              was being centred against single-line siblings, which dropped its
              second line level with the neighbouring button and made it read as
              floating text belonging to nothing. Top-aligned, the controls line
              up and the helper sits under its own control. */}
          {actions ? <div className="flex shrink-0 items-start gap-2">{actions}</div> : null}
        </div>
      </div>
      {kpis && kpis.length > 0 ? <StatCards cards={kpis} /> : null}
    </>
  );
}
