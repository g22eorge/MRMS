import type { ReactNode } from "react";

import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";
import type { DocumentKpiTile } from "./DocumentKpiStrip";

/** @deprecated Thin wrapper around the app-wide PageHeader — import
 *  `components/ui/PageHeader` directly in new code. */

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
      <PageHeader
        title={title}
        eyebrow={eyebrow}
        actions={action}
        kpis={kpiLayout === "embedded" ? kpis : undefined}
      />
      {kpis && kpis.length > 0 && kpiLayout === "cards" ? (
        <StatCards cards={kpis} columns={4} />
      ) : null}
    </>
  );
}

export type { DocumentKpiTile };
