"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { LineItemsPanel, PartSelect, lineItemInputClass } from "@/components/forms";
import { DataTable } from "@/components/ui/DataTable";
import { useLineItemsState } from "@/hooks/useLineItemsState";
import { createStockCountAction } from "../actions";
import { quickCreateStockLocationAction } from "@/app/(app)/inventory/locations/actions";

type Location = { id: string; name: string; code: string | null };
type Part = { id: string; sku: string; name: string; qty: number };
type LineData = { partId: string; systemQty: number; countedQty: number; note: string };

export function NewStockCountForm({ locations, parts }: { locations: Location[]; parts: Part[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [locationList, setLocationList] = useState(locations);
  const [locationId, setLocationId] = useState(locations.length === 1 ? locations[0].id : "");
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");

  function handleAddLocation() {
    const name = newLocationName.trim();
    if (name.length < 2) { setError("Enter a location name (at least 2 characters)"); return; }
    setError(null);
    startTransition(async () => {
      const res = await quickCreateStockLocationAction(name);
      if (res.error || !res.id) { setError(res.error ?? "Failed to add location"); return; }
      const created = { id: res.id, name: res.name ?? name, code: null };
      setLocationList((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setLocationId(created.id);
      setNewLocationName("");
      setAddingLocation(false);
    });
  }

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
          <div className="block text-xs font-semibold text-[var(--ink-muted)]">
            <div className="flex items-center justify-between gap-2">
              <span>Location</span>
              <button type="button" onClick={() => { setAddingLocation((v) => !v); setError(null); }} className="text-[0.6875rem] font-semibold text-[var(--accent)] hover:underline">
                {addingLocation ? "Cancel" : "+ New"}
              </button>
            </div>
            <select name="locationId" required value={locationId} onChange={(e) => setLocationId(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)]"><option value="">{locationList.length ? "Select location" : "No locations yet — add one"}</option>{locationList.map((location) => <option key={location.id} value={location.id}>{location.name}{location.code ? ` (${location.code})` : ""}</option>)}</select>
            {addingLocation ? (
              <div className="mt-2 flex gap-2">
                <input value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddLocation(); } }} placeholder="e.g. Main Store" autoFocus className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)]" />
                <button type="button" onClick={handleAddLocation} disabled={pending || newLocationName.trim().length < 2} className="btn-premium shrink-0 rounded-lg px-3 text-sm font-semibold disabled:opacity-50">Add</button>
              </div>
            ) : null}
          </div>
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
