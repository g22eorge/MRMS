import { StatStrip, type StatTile } from "@/components/ui/StatStrip";

/** @deprecated Thin wrapper around the app-wide StatStrip — import
 *  `components/ui/StatStrip` directly in new code. */

export type DocumentKpiTile = StatTile;

type DocumentKpiStripProps = {
  tiles: DocumentKpiTile[];
  variant?: "embedded" | "cards";
};

export function DocumentKpiStrip({ tiles, variant = "embedded" }: DocumentKpiStripProps) {
  return <StatStrip tiles={tiles} variant={variant} columns={4} />;
}
