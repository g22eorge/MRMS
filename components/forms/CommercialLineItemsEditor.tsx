"use client";

import { useState, type FormEvent } from "react";
import type { CommercialLineItemData } from "@/lib/forms/line-items";
import { commercialLineTotal } from "@/lib/forms/line-items";
import type { LineWithKey } from "@/hooks/useLineItemsState";

import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { LineItemsPanel, type PartSelectOption } from "./LineItemsPanel";

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
  const [openComboKey, setOpenComboKey] = useState<number | null>(null);

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
      key: "description",
      header: "Item / Description",
      className: "align-top",
      cell: (item) => {
        if (item.key === creatingLineKey) {
          return <CreatePartInlineForm onCancel={() => setCreatingLineKey(null)} />;
        }
        const q = item.description.trim().toLowerCase();
        const matches = (q ? parts.filter((p) => `${p.sku} ${p.name}`.toLowerCase().includes(q)) : parts).slice(0, 6);
        const open = openComboKey === item.key;
        return (
          <div className="relative">
            <input
              value={item.description}
              onChange={(event) => onUpdateLine(item.key, { description: event.target.value, partId: "" })}
              onFocus={() => setOpenComboKey(item.key)}
              onBlur={() => window.setTimeout(() => setOpenComboKey((k) => (k === item.key ? null : k)), 120)}
              placeholder="Type a product or service — or pick from inventory"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]/50"
            />
            {open && (matches.length > 0 || (onCreatePart && q)) ? (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--panel)] p-1 shadow-lg">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => { onSelectPart(item.key, p.id); setOpenComboKey(null); }}
                    className="block w-full truncate rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-[var(--panel-strong)]"
                  >
                    <span className="font-semibold text-[var(--ink)]">{p.name}</span>
                    <span className="text-[var(--ink-muted)]"> · {p.sku}{p.qtyOnHand != null ? ` (${p.qtyOnHand})` : ""}</span>
                  </button>
                ))}
                {q && matches.length === 0 ? (
                  <div className="px-2.5 py-1.5 text-[12px] text-[var(--ink-muted)]">No inventory match — this stays a custom line.</div>
                ) : null}
                {onCreatePart && q ? (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => { setCreatingLineKey(item.key); setOpenComboKey(null); }}
                    className="mt-1 block w-full truncate rounded-md border border-dashed border-[var(--accent)]/45 px-2.5 py-1.5 text-left text-[13px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10"
                  >
                    + Create &ldquo;{item.description.trim()}&rdquo; as a new inventory part
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      },
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
      subtitle="Type each line — pick from inventory or write a custom one."
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
