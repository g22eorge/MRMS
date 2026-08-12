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
  title: string;
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
      <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">{eyebrow}</p>
            ) : null}
            <h1 className="truncate text-[0.9375rem] font-bold leading-tight text-[var(--ink)]">{title}</h1>
            {description ? <p className="mt-0.5 text-[0.75rem] text-[var(--ink-muted)]">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      {kpis && kpis.length > 0 ? <StatCards cards={kpis} /> : null}
    </>
  );
}
