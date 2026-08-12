"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { LineItemsPanel, PartSelect, lineItemInputClass } from "@/components/forms";
import { DataTable } from "@/components/ui/DataTable";
import { useLineItemsState } from "@/hooks/useLineItemsState";
import { createStockCountAction } from "../actions";

type Location = { id: string; name: string; code: string | null };
type Part = { id: string; sku: string; name: string; qty: number };
type LineData = { partId: string; systemQty: number; countedQty: number; note: string };

export function NewStockCountForm({ locations, parts }: { locations: Location[]; parts: Part[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { lines, addLine, removeLine, updateLine, appendToFormData } = useLineItemsState<LineData>(() => ({
    partId: "",
    systemQty: 0,
    countedQty: 0,
    note: "",
  }));

  function selectPart(key: number, partId: string) {
    const part = parts.find((item) => item.id === partId);
    updateLine(key, { partId, systemQty: part?.qty ?? 0, countedQty: part?.qty ?? 0 });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    appendToFormData(fd, "items", ({ partId, systemQty, countedQty, note }) => ({
      partId,
      systemQty,
      countedQty,
      note,
    }));
    startTransition(async () => {
      const result = await createStockCountAction(fd);
      if (result.error) { setError(result.error); return; }
      router.push(`/inventory/stock-counts/${result.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="rounded-xl border border-[var(--line)] bg-[var(--panel-strong)]/40 px-4 py-2.5 text-[0.8125rem] text-[var(--ink-muted)]">
        Pick a location, then for each item type in how many you actually counted. We work out the difference for you.
      </p>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-[var(--ink-muted)]">Location
            <select name="locationId" required className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)]"><option value="">Select location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.code ? ` (${location.code})` : ""}</option>)}</select>
          </label>
          <label className="block text-xs font-semibold text-[var(--ink-muted)]">Counted at
            <input name="countedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)]" />
          </label>
        </div>
        <textarea name="note" rows={2} placeholder="Note (optional)" className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)]" />
      </div>

      <LineItemsPanel title="Items" onAddLine={addLine}>
        <DataTable
          frameless
          dense
          rows={lines}
          getRowKey={(line) => String(line.key)}
          empty="No items yet."
          columns={[
            {
              key: "item",
              header: "Item",
              cell: (line) => <PartSelect value={line.partId} parts={parts.map((p) => ({ ...p, unitCost: null }))} onChange={(partId) => selectPart(line.key, partId)} allowCustom={false} customLabel="Select item" />,
            },
            {
              key: "system",
              header: "System",
              align: "right",
              className: "tabular-nums text-[var(--ink-muted)]",
              cell: (line) => line.systemQty,
            },
            {
              key: "counted",
              header: "Counted",
              align: "right",
              cell: (line) => <input type="number" min={0} value={line.countedQty} onChange={(e) => updateLine(line.key, { countedQty: parseInt(e.target.value, 10) || 0 })} className={`${lineItemInputClass} w-24 text-right`} />,
            },
            {
              key: "variance",
              header: "Variance",
              align: "right",
              className: "font-semibold tabular-nums text-[var(--ink)]",
              cell: (line) => line.countedQty - line.systemQty,
            },
            {
              key: "note",
              header: "Note",
              cell: (line) => <input value={line.note} onChange={(e) => updateLine(line.key, { note: e.target.value })} className={lineItemInputClass} />,
            },
          ]}
          actions={(line) =>
            lines.length > 1 ? (
              <button type="button" onClick={() => removeLine(line.key)} className="text-[0.75rem] font-bold text-[var(--ink-muted)] hover:text-red-500">x</button>
            ) : null
          }
        />
      </LineItemsPanel>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2"><button disabled={pending} className="btn-premium rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50">{pending ? "Saving..." : "Save count"}</button><Link href="/inventory/stock-counts" className="rounded-lg border border-[var(--line)] px-5 py-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">Cancel</Link></div>
    </form>
  );
}
