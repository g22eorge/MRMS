import type { ReactNode } from "react";

/**
 * App-wide KPI/stat strip — the single way to render summary numbers on a page.
 * Generalized from the documents module's KpiStrip; use everywhere instead of
 * hand-rolled `grid grid-cols-N divide-x` stat blocks.
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
      <div className={`grid grid-cols-2 gap-2 ${cols}`}>
        {tiles.map(({ label, value, sub, accent, valueClass }) => (
          <div key={label} className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums leading-tight ${valueClass ?? (accent ? "text-[var(--accent)]" : "text-[var(--ink)]")}`}>
              {value}
            </p>
            {sub ? <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">{sub}</p> : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 divide-x divide-y divide-[var(--line)] ${cols} sm:divide-y-0`}>
      {tiles.map(({ label, value, sub, accent, valueClass }) => (
        <div key={label} className="px-4 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]/70">{label}</p>
          <p className={`mt-0.5 text-[15px] font-black tabular-nums leading-tight ${valueClass ?? (accent ? "text-[var(--accent)]" : "text-[var(--ink)]")}`}>
            {value}
          </p>
          {sub ? <p className="text-[12px] text-[var(--ink-muted)]">{sub}</p> : null}
        </div>
      ))}
    </div>
  );
}
