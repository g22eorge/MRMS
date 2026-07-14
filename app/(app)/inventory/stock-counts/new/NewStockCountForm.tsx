"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { LineItemsPanel, PartSelect, lineItemInputClass } from "@/components/forms";
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
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 space-y-4">
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Count Details</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-[var(--ink-muted)]">Location
            <select name="locationId" required className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)]"><option value="">Select location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.code ? ` (${location.code})` : ""}</option>)}</select>
          </label>
          <label className="block text-xs font-semibold text-[var(--ink-muted)]">Counted at
            <input name="countedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)]" />
          </label>
        </div>
        <textarea name="note" rows={2} placeholder="Count note" className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)]" />
      </div>

      <LineItemsPanel title="Items" onAddLine={addLine}>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[var(--line)] text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]"><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-right">System</th><th className="px-3 py-2 text-right">Counted</th><th className="px-3 py-2 text-right">Variance</th><th className="px-3 py-2 text-left">Note</th><th /></tr></thead>
          <tbody className="divide-y divide-[var(--line)]">
            {lines.map((line) => (
              <tr key={line.key}>
                <td className="px-3 py-2"><PartSelect value={line.partId} parts={parts.map((p) => ({ ...p, unitCost: null }))} onChange={(partId) => selectPart(line.key, partId)} allowCustom={false} customLabel="Select item" /></td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--ink-muted)]">{line.systemQty}</td>
                <td className="px-3 py-2"><input type="number" min={0} value={line.countedQty} onChange={(e) => updateLine(line.key, { countedQty: parseInt(e.target.value, 10) || 0 })} className={`${lineItemInputClass} w-24 text-right`} /></td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-[var(--ink)]">{line.countedQty - line.systemQty}</td>
                <td className="px-3 py-2"><input value={line.note} onChange={(e) => updateLine(line.key, { note: e.target.value })} className={lineItemInputClass} /></td>
                <td className="px-3 py-2 text-center">{lines.length > 1 ? <button type="button" onClick={() => removeLine(line.key)} className="text-xs font-bold text-[var(--ink-muted)] hover:text-red-500">x</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </LineItemsPanel>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2"><button disabled={pending} className="btn-premium rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50">{pending ? "Saving..." : "Submit Count"}</button><Link href="/inventory/stock-counts" className="rounded-lg border border-[var(--line)] px-5 py-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">Cancel</Link></div>
    </form>
  );
}
