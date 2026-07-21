"use client";

import { useState, type FormEvent } from "react";
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
  onSelectPart: (key: number, partId: string, part?: PartSelectOption) => void;
  onCreatePart?: (data: { sku: string; name: string; unitCost?: number | null; qtyOnHand?: number }) => Promise<PartSelectOption>;
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
  onCreatePart,
  minLines = 1,
  className,
}: CommercialLineItemsEditorProps) {
  type Item = LineWithKey<CommercialLineItemData>;

  const [creatingLineKey, setCreatingLineKey] = useState<number | null>(null);

  // Inline create form component
  function CreatePartInlineForm({ onCancel }: { onCancel: () => void }) {
    const [sku, setSku] = useState("");
    const [name, setName] = useState("");
    const [unitCost, setUnitCost] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: FormEvent) {
      e.preventDefault();
      setLoading(true);
      setError(null);
      try {
        const newPart = await onCreatePart?.({
          sku,
          name,
          unitCost: unitCost ? Number(unitCost) : null,
        });
        if (newPart) {
          onSelectPart(creatingLineKey!, newPart.id, newPart);
          setCreatingLineKey(null);
        }
      } catch (err: any) {
        setError(err.message ?? "Failed to create part");
      } finally {
        setLoading(false);
      }
    }

    return (
      <div className="space-y-2 p-2">
        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            name="sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="SKU"
            required
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]/50"
          />
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Part name"
            required
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]/50"
          />
          <input
            name="unitCost"
            type="number"
            step="any"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            placeholder="Unit cost"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]/50"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="btn-premium rounded-lg px-3 py-1 text-xs">Create</button>
            <button type="button" onClick={onCancel} className="rounded-lg border border-[var(--line)] px-3 py-1 text-xs text-[var(--ink-muted)] hover:bg-[var(--panel-strong)]">Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  const columns: DataTableColumn<Item>[] = [
    {
      key: "item",
      header: "Item",
      headerClassName: "w-72",
      className: "w-72 align-top",
      cell: (item) => {
        const isCreating = item.key === creatingLineKey;
        return (
          <>
            {isCreating ? (
              <CreatePartInlineForm
                onCancel={() => setCreatingLineKey(null)}
              />
            ) : (
              <PartSelect
                value={item.partId}
                parts={parts}
                onChange={(partId) => {
                  if (partId === "__new__") {
                    setCreatingLineKey(item.key);
                  } else {
                    onSelectPart(item.key, partId);
                  }
                }}
                allowCustom
                customLabel="Custom line"
                showStock
                showCreateOption={!!onCreatePart}
                createOptionLabel="+ Create new part…"
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]/50"
              />
            )}
          </>
        );
      },
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
