import type { ReactNode } from "react";

/**
 * Divided stat strip — for summary numbers that live INSIDE a card (the
 * identity/summary header of a detail page).
 *
 * For a page-level KPI band (list pages, hubs) use `StatCards` instead: flat
 * `dc-card` tiles with a tone rail, the app-wide standard. The `cards` variant
 * here is legacy — it renders bordered tiles and should not be used in new code.
 */

export type StatTile = {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: boolean;
  /** Explicit value color class (e.g. "text-emerald-500"); overrides accent. */
  valueClass?: string;
};

type StatStripProps = {
  tiles: StatTile[];
  /**
   * `embedded` — divider grid meant to sit inside a panel (PageHeader kpis).
   * `cards` — standalone tile cards.
   */
  variant?: "embedded" | "cards";
  /** Columns at ≥sm. Defaults to tile count (max 6). */
  columns?: 2 | 3 | 4 | 5 | 6;
};

const COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
};

export function StatStrip({ tiles, variant = "embedded", columns }: StatStripProps) {
  if (tiles.length === 0) return null;
  const cols = COLS[columns ?? Math.min(tiles.length, 6)] ?? "sm:grid-cols-4";

  if (variant === "cards") {
    return (
      <div className={`grid grid-cols-2 gap-3 ${cols}`}>
        {tiles.map(({ label, value, sub, accent, valueClass }) => (
          <div key={label} className="dc-card relative overflow-hidden px-4 py-3.5">
            <span
              className={`absolute inset-y-0 left-0 w-[3px] ${accent ? "bg-[var(--dc-accent)]" : "bg-[var(--dc-line)]"}`}
              aria-hidden="true"
            />
            <p className="text-[0.6875rem] font-semibold text-[var(--dc-ink-3)]">{label}</p>
            <p className={`mt-1 truncate text-[1.25rem] font-bold leading-none tracking-[-0.02em] tabular-nums lg:text-[1.625rem] ${valueClass ?? (accent ? "text-[var(--dc-accent-2)]" : "text-[var(--dc-ink)]")}`}>
              {value}
            </p>
            {sub ? <p className="mt-1 truncate text-[0.65625rem] text-[var(--dc-ink-3)]">{sub}</p> : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 divide-x divide-y divide-[var(--line)] ${cols} sm:divide-y-0`}>
      {tiles.map(({ label, value, sub, accent, valueClass }) => (
        <div key={label} className="px-4 py-2.5">
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]/70">{label}</p>
          <p className={`mt-0.5 text-[0.9375rem] font-black tabular-nums leading-tight ${valueClass ?? (accent ? "text-[var(--accent)]" : "text-[var(--ink)]")}`}>
            {value}
          </p>
          {sub ? <p className="text-[0.75rem] text-[var(--ink-muted)]">{sub}</p> : null}
        </div>
      ))}
    </div>
  );
}
