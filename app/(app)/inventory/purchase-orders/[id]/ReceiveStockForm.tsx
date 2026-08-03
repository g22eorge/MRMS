"use client";

import { useState, useTransition } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { receiveStockAction } from "../actions";

type Item = { id: string; description: string; qtyOrdered: number; qtyReceived: number };
type Location = { id: string; name: string; code: string | null };

export function ReceiveStockForm({ poId, items, locations }: { poId: string; items: Item[]; locations: Location[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  // Pre-fill each line to its full ordered quantity so the common case —
  // "everything arrived" — is a single confirm. Short lines get adjusted down.
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(items.map((i) => [i.id, i.qtyOrdered])),
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("poId", poId);
    fd.set("locationId", locationId);
    for (const [id, qty] of Object.entries(quantities)) {
      fd.set(`qtyReceived_${id}`, String(qty));
    }
    startTransition(async () => {
      const result = await receiveStockAction(fd);
      if (result.error) { setError(result.error); return; }
      setSaved(true);
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
        <p className="text-sm font-bold text-[var(--ink)]">Receive stock</p>
        <p className="text-xs text-[var(--ink-muted)]">Confirm what arrived</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3 p-3">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">
          Receive into location
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-sm font-normal normal-case tracking-normal text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--accent)]/10"
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}{location.code ? ` (${location.code})` : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[12px] text-[var(--ink-muted)]">Quantities are pre-filled to receive the full outstanding order — adjust any line that arrived short, then confirm.</p>
        <DataTable
          frameless
          dense
          rows={items}
          getRowKey={(item) => item.id}
          empty="No line items to receive."
          columns={[
            {
              key: "item",
              header: "Item",
              className: "font-medium text-[var(--ink)]",
              cell: (item) => item.description,
            },
            {
              key: "ordered",
              header: "Ordered",
              align: "right",
              headerClassName: "w-24",
              className: "tabular-nums text-[var(--ink-muted)]",
              cell: (item) => item.qtyOrdered,
            },
            {
              key: "current",
              header: "Current",
              align: "right",
              headerClassName: "w-24",
              className: "tabular-nums text-[var(--ink-muted)]",
              cell: (item) => item.qtyReceived,
            },
            {
              key: "new",
              header: "New",
              align: "right",
              headerClassName: "w-28",
              cell: (item) => (
                <input
                  type="number"
                  min={0}
                  max={item.qtyOrdered}
                  value={quantities[item.id] ?? item.qtyOrdered}
                  onChange={(e) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [item.id]: Math.min(item.qtyOrdered, parseInt(e.target.value, 10) || 0),
                    }))
                  }
                  className="w-24 rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1 text-right tabular-nums text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--accent)]/10"
                />
              ),
            },
          ]}
        />

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        {saved && <p className="text-xs font-semibold text-green-600">Stock received and inventory updated.</p>}

        <button
          type="submit"
          disabled={pending || !locationId}
          className="btn-premium rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Receiving..." : "Receive stock"}
        </button>
      </form>
    </div>
  );
}
