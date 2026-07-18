import type { ReactNode } from "react";

import { formatMoney as formatMoneyDefault } from "@/lib/currency";

export type LineItemTotalsRow = {
  label: ReactNode;
  value: ReactNode;
};

export interface LineItemTotalsProps {
  subtotal: number;
  /** Tax row is rendered only when provided. */
  taxAmount?: number;
  /** Label for the tax row, e.g. "VAT (18%)". Defaults to "Tax". */
  taxLabel?: string;
  /** Total row is rendered only when provided. */
  total?: number;
  currency: string;
  /** Override money formatting. Defaults to lib/currency formatMoney with `currency`. */
  formatMoney?: (value: number) => string;
  /** Extra summary rows rendered above Subtotal (e.g. line counts). */
  leadingRows?: LineItemTotalsRow[];
  /** "plain" = stacked dl rows (default); "card" = bordered, divided card rows. */
  variant?: "plain" | "card";
  className?: string;
}

/**
 * Standard subtotal / tax / total summary block: right-aligned tabular-nums
 * values, muted labels, bold total.
 */
export function LineItemTotals({
  subtotal,
  taxAmount,
  taxLabel = "Tax",
  total,
  currency,
  formatMoney,
  leadingRows = [],
  variant = "plain",
  className,
}: LineItemTotalsProps) {
  const fmt = formatMoney ?? ((value: number) => formatMoneyDefault(value, currency));

  if (variant === "card") {
    return (
      <div
        className={`divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--panel)]${className ? ` ${className}` : ""}`}
      >
        {leadingRows.map((row, index) => (
          <div key={index} className="flex items-center justify-between px-3 py-2">
            <p className="text-xs text-[var(--ink-muted)]">{row.label}</p>
            <p className="text-xs font-bold tabular-nums text-[var(--ink)]">{row.value}</p>
          </div>
        ))}
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-xs text-[var(--ink-muted)]">Subtotal</p>
          <p className="text-xs font-bold tabular-nums text-[var(--ink)]">{fmt(subtotal)}</p>
        </div>
        {taxAmount !== undefined ? (
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-xs text-[var(--ink-muted)]">{taxLabel}</p>
            <p className="text-xs font-bold tabular-nums text-[var(--ink)]">{fmt(taxAmount)}</p>
          </div>
        ) : null}
        {total !== undefined ? (
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-xs font-semibold text-[var(--ink)]">Total</p>
            <p className="text-sm font-black tabular-nums text-[var(--accent)]">{fmt(total)}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <dl className={`space-y-2 text-sm${className ? ` ${className}` : ""}`}>
      {leadingRows.map((row, index) => (
        <div key={index} className="flex justify-between gap-3">
          <dt className="text-[var(--ink-muted)]">{row.label}</dt>
          <dd className="font-bold text-[var(--ink)]">{row.value}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-3">
        <dt className="text-[var(--ink-muted)]">Subtotal</dt>
        <dd className="font-bold tabular-nums text-[var(--ink)]">{fmt(subtotal)}</dd>
      </div>
      {taxAmount !== undefined ? (
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--ink-muted)]">{taxLabel}</dt>
          <dd className="font-bold tabular-nums text-[var(--ink)]">{fmt(taxAmount)}</dd>
        </div>
      ) : null}
      {total !== undefined ? (
        <div className="flex justify-between gap-3 border-t border-[var(--line)] pt-2">
          <dt className="font-semibold text-[var(--ink)]">Total</dt>
          <dd className="text-[15px] font-black tabular-nums text-[var(--ink)]">{fmt(total)}</dd>
        </div>
      ) : null}
    </dl>
  );
}
