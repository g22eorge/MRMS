import type { ReactNode } from "react";

export type DocumentKpiTile = {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: boolean;
};

type DocumentKpiStripProps = {
  tiles: DocumentKpiTile[];
  variant?: "embedded" | "cards";
};

export function DocumentKpiStrip({ tiles, variant = "embedded" }: DocumentKpiStripProps) {
  if (variant === "cards") {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(({ label, value, sub, accent }) => (
          <div key={label} className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${accent ? "text-[var(--accent)]" : "text-[var(--ink)]"}`}>
              {value}
            </p>
            {sub ? <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">{sub}</p> : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0">
      {tiles.map(({ label, value, sub, accent }) => (
        <div key={label} className="px-4 py-2">
          <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-[var(--ink-muted)]/60">{label}</p>
          <p className={`text-[15px] font-black tabular-nums leading-tight ${accent ? "text-[var(--accent)]" : "text-[var(--ink)]"}`}>
            {value}
          </p>
          {sub ? <p className="text-[12px] text-[var(--ink-muted)]">{sub}</p> : null}
        </div>
      ))}
    </div>
  );
}
