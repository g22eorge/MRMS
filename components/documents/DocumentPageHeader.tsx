import type { ReactNode } from "react";

import { DocumentKpiStrip, type DocumentKpiTile } from "./DocumentKpiStrip";

type DocumentPageHeaderProps = {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  kpis?: DocumentKpiTile[];
  /** `embedded` — KPI row inside the header card (receipts). `cards` — separate tile grid. */
  kpiLayout?: "embedded" | "cards";
};

export function DocumentPageHeader({
  title,
  eyebrow = "Documents",
  action,
  kpis,
  kpiLayout = "embedded",
}: DocumentPageHeaderProps) {
  return (
    <>
      <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
          <div>
            <p className="text-[12px] uppercase tracking-[0.16em] text-[var(--ink-muted)]">{eyebrow}</p>
            <p className="text-[13px] font-bold text-[var(--ink)]">{title}</p>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {kpis && kpis.length > 0 && kpiLayout === "embedded" ? (
          <DocumentKpiStrip tiles={kpis} variant="embedded" />
        ) : null}
      </div>
      {kpis && kpis.length > 0 && kpiLayout === "cards" ? (
        <DocumentKpiStrip tiles={kpis} variant="cards" />
      ) : null}
    </>
  );
}

export type { DocumentKpiTile };
