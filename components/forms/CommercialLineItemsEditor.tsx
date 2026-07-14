"use client";

import type { CommercialLineItemData } from "@/lib/forms/line-items";
import { commercialLineTotal } from "@/lib/forms/line-items";
import type { LineWithKey } from "@/hooks/useLineItemsState";

import { LineItemsPanel, PartSelect, type PartSelectOption } from "./LineItemsPanel";

type CommercialLineItemsEditorProps = {
  items: LineWithKey<CommercialLineItemData>[];
  parts: PartSelectOption[];
  canOverrideDiscount: boolean;
  formatAmount: (value: number) => string;
  onAddLine: () => void;
  onRemoveLine: (key: number) => void;
  onUpdateLine: (key: number, patch: Partial<CommercialLineItemData>) => void;
  onSelectPart: (key: number, partId: string) => void;
  minLines?: number;
  className?: string;
};

export function CommercialLineItemsEditor({
  items,
  parts,
  canOverrideDiscount,
  formatAmount,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
  onSelectPart,
  minLines = 1,
  className,
}: CommercialLineItemsEditorProps) {
  return (
    <LineItemsPanel
      title="Products & Services"
      subtitle="Use inventory items or custom lines."
      addLabel="Add Line"
      onAddLine={onAddLine}
      className={`rounded-lg bg-[var(--panel-strong)] ${className ?? ""}`}
      dense
    >
      <table className="w-full min-w-[760px] text-[13px]">
        <thead className="bg-[var(--panel)] text-left text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--ink-muted)]">
          <tr>
            <th className="w-56 px-3 py-2">Item</th>
            <th className="px-3 py-2">Description</th>
            <th className="w-20 px-3 py-2 text-right">Qty</th>
            <th className="w-28 px-3 py-2 text-right">Price</th>
            {canOverrideDiscount ? <th className="w-20 px-3 py-2 text-right">Disc %</th> : null}
            <th className="w-28 px-3 py-2 text-right">Total</th>
            <th className="w-10 px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {items.map((item) => (
            <tr key={item.key} className="align-top">
              <td className="px-3 py-2">
                <PartSelect
                  value={item.partId}
                  parts={parts}
                  onChange={(partId) => onSelectPart(item.key, partId)}
                  allowCustom
                  customLabel="Custom line"
                  showStock
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]/50"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  value={item.description}
                  onChange={(event) => onUpdateLine(item.key, { description: event.target.value })}
                  placeholder="Product, service, or package"
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]/50"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(event) => onUpdateLine(item.key, { quantity: Number(event.target.value) })}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-right text-sm outline-none focus:border-[var(--accent)]/50"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={item.unitPrice}
                  onChange={(event) => onUpdateLine(item.key, { unitPrice: Number(event.target.value) })}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-right text-sm outline-none focus:border-[var(--accent)]/50"
                />
              </td>
              {canOverrideDiscount ? (
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={item.discount}
                    onChange={(event) => onUpdateLine(item.key, { discount: Number(event.target.value) })}
                    className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-right text-sm outline-none focus:border-[var(--accent)]/50"
                  />
                </td>
              ) : null}
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-[var(--ink)]">
                {formatAmount(commercialLineTotal(item, canOverrideDiscount))}
              </td>
              <td className="px-3 py-2 text-center">
                <button
                  type="button"
                  onClick={() => onRemoveLine(item.key)}
                  disabled={items.length <= minLines}
                  className="rounded-md px-2 py-1 text-[var(--ink-muted)] hover:bg-red-500/10 hover:text-red-500 disabled:opacity-30"
                  aria-label="Remove line"
                >
                  x
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </LineItemsPanel>
  );
}
