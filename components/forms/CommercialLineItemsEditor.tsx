"use client";

import type { CommercialLineItemData } from "@/lib/forms/line-items";
import { commercialLineTotal } from "@/lib/forms/line-items";
import type { LineWithKey } from "@/hooks/useLineItemsState";

import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
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
  type Item = LineWithKey<CommercialLineItemData>;

  const columns: DataTableColumn<Item>[] = [
    {
      key: "item",
      header: "Item",
      headerClassName: "w-56",
      className: "w-56 align-top",
      cell: (item) => (
        <PartSelect
          value={item.partId}
          parts={parts}
          onChange={(partId) => onSelectPart(item.key, partId)}
          allowCustom
          customLabel="Custom line"
          showStock
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]/50"
        />
      ),
    },
    {
      key: "description",
      header: "Description",
      className: "align-top",
      cell: (item) => (
        <input
          value={item.description}
          onChange={(event) => onUpdateLine(item.key, { description: event.target.value })}
          placeholder="Product, service, or package"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]/50"
        />
      ),
    },
    {
      key: "qty",
      header: "Qty",
      align: "right",
      headerClassName: "w-20",
      className: "w-20 align-top",
      cell: (item) => (
        <input
          type="number"
          min={1}
          value={item.quantity}
          onChange={(event) => onUpdateLine(item.key, { quantity: Number(event.target.value) })}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-right text-sm outline-none focus:border-[var(--accent)]/50"
        />
      ),
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      headerClassName: "w-28",
      className: "w-28 align-top",
      cell: (item) => (
        <input
          type="number"
          min={0}
          step="any"
          value={item.unitPrice}
          onChange={(event) => onUpdateLine(item.key, { unitPrice: Number(event.target.value) })}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-right text-sm outline-none focus:border-[var(--accent)]/50"
        />
      ),
    },
    ...(canOverrideDiscount
      ? [{
          key: "discount",
          header: "Disc %",
          align: "right" as const,
          headerClassName: "w-20",
          className: "w-20 align-top",
          cell: (item: Item) => (
            <input
              type="number"
              min={0}
              max={100}
              step="any"
              value={item.discount}
              onChange={(event) => onUpdateLine(item.key, { discount: Number(event.target.value) })}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-right text-sm outline-none focus:border-[var(--accent)]/50"
            />
          ),
        }]
      : []),
    {
      key: "total",
      header: "Total",
      align: "right",
      headerClassName: "w-28",
      className: "w-28 align-top font-semibold tabular-nums text-[var(--ink)]",
      cell: (item) => formatAmount(commercialLineTotal(item, canOverrideDiscount)),
    },
  ];

  return (
    <LineItemsPanel
      title="Products & Services"
      subtitle="Use inventory items or custom lines."
      addLabel="Add Line"
      onAddLine={onAddLine}
      className={`rounded-lg bg-[var(--panel-strong)] ${className ?? ""}`}
      dense
    >
      <DataTable
        frameless
        dense
        rows={items}
        getRowKey={(item) => String(item.key)}
        empty="No line items yet."
        columns={columns}
        actions={(item) => (
          <button
            type="button"
            onClick={() => onRemoveLine(item.key)}
            disabled={items.length <= minLines}
            className="rounded-md px-2 py-1 text-[var(--ink-muted)] hover:bg-red-500/10 hover:text-red-500 disabled:opacity-30"
            aria-label="Remove line"
          >
            x
          </button>
        )}
      />
    </LineItemsPanel>
  );
}
