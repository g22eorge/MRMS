"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { LineItemsPanel, PartSelect, lineItemInputClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { useLineItemsState } from "@/hooks/useLineItemsState";
import { createPurchaseRequestAction } from "../actions";

type Supplier = { id: string; name: string };
type Part = { id: string; sku: string; name: string; unitCost: number | null };
type LineData = { partId: string; description: string; quantity: number; estimatedUnitCost: number };

export function NewPurchaseRequestForm({ suppliers, parts }: { suppliers: Supplier[]; parts: Part[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { lines, addLine, removeLine, updateLine, appendToFormData } = useLineItemsState<LineData>(() => ({
    partId: "",
    description: "",
    quantity: 1,
    estimatedUnitCost: 0,
  }));

  function selectPart(key: number, partId: string) {
    const part = parts.find((item) => item.id === partId);
    updateLine(key, { partId, description: part?.name ?? "", estimatedUnitCost: part?.unitCost ?? 0 });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    appendToFormData(fd, "items", ({ partId, description, quantity, estimatedUnitCost }) => ({
      partId: partId || null,
      description,
      quantity,
      estimatedUnitCost,
    }));
    startTransition(async () => {
      const result = await createPurchaseRequestAction(fd);
      if (result.error) { setError(result.error); return; }
      router.push(`/inventory/purchase-requests/${result.id}`);
    });
  }

  const total = lines.reduce((sum, line) => sum + line.quantity * line.estimatedUnitCost, 0);
  const readyLines = lines.filter((line) => line.description.trim() && line.quantity > 0).length;

  const field =
    "w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none transition placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15";
  const label = "mb-1 block text-[12px] font-medium text-[var(--ink-muted)]";

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Plain, one-line guide so a first-timer knows exactly what to do. */}
      <p className="rounded-xl border border-[var(--line)] bg-[var(--panel-strong)]/40 px-4 py-2.5 text-[13px] text-[var(--ink-muted)]">
        List what you need to buy, with how many. That is all we need — supplier and timing are optional.
      </p>

      {/* Step 1 — the actual job leads the page. */}
      <LineItemsPanel
        title="What do you need to buy?"
        subtitle={readyLines > 0 ? `${readyLines} item${readyLines === 1 ? "" : "s"} · est. ${total.toLocaleString()}` : "Add a line for each item"}
        addLabel="+ Add item"
        onAddLine={addLine}
      >
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
              headerClassName: "w-48",
              className: "w-48",
              cell: (line) => <PartSelect value={line.partId} parts={parts} onChange={(partId) => selectPart(line.key, partId)} />,
            },
            {
              key: "description",
              header: "Name / description",
              cell: (line) => <input required value={line.description} onChange={(e) => updateLine(line.key, { description: e.target.value })} placeholder="e.g. iPhone 11 screen" className={lineItemInputClass} />,
            },
            {
              key: "qty",
              header: "Qty",
              align: "right",
              headerClassName: "w-20",
              className: "w-20",
              cell: (line) => <input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: parseInt(e.target.value, 10) || 1 })} className={`${lineItemInputClass} text-right`} />,
            },
            {
              key: "estCost",
              header: "Cost each",
              align: "right",
              headerClassName: "w-32",
              className: "w-32",
              cell: (line) => <input type="number" min={0} step={0.01} value={line.estimatedUnitCost} onChange={(e) => updateLine(line.key, { estimatedUnitCost: parseFloat(e.target.value) || 0 })} placeholder="0" className={`${lineItemInputClass} text-right`} />,
            },
            {
              key: "total",
              header: "Total",
              align: "right",
              headerClassName: "w-32",
              className: "w-32 whitespace-nowrap text-[12px] tabular-nums text-[var(--ink-muted)]",
              cell: (line) => (line.quantity * line.estimatedUnitCost).toLocaleString(),
            },
          ]}
          actions={(line) =>
            lines.length > 1 ? (
              <button type="button" onClick={() => removeLine(line.key)} title="Remove line"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/20 text-[var(--ink-muted)]/40 transition hover:border-red-400/40 hover:text-red-500">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            ) : null
          }
          tableFooter={
            <tr className="bg-[var(--accent)]/5">
              <td colSpan={4} className="px-3 py-2 text-right text-[12px] font-semibold text-[var(--ink-muted)]">Estimated total</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-[var(--ink)] tabular-nums">{total.toLocaleString()}</td>
              <td />
            </tr>
          }
        />
      </LineItemsPanel>

      {/* Step 2 — everything optional, hidden until asked for. */}
      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition hover:bg-[var(--panel-strong)]/40"
        >
          <span className="text-[13px] font-semibold text-[var(--ink)]">Supplier, priority &amp; timing <span className="font-normal text-[var(--ink-muted)]">— optional</span></span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`text-[var(--ink-muted)] transition-transform ${showDetails ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {/* Fields stay mounted so values survive collapsing; only visibility toggles. */}
        <div className={showDetails ? "grid gap-3 border-t border-[var(--line)] p-3 sm:grid-cols-2 xl:grid-cols-4" : "hidden"}>
          <div>
            <label htmlFor="pr-supplier" className={label}>Preferred supplier</label>
            <select id="pr-supplier" name="supplierId" className={field}>
              <option value="">No preference</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pr-priority" className={label}>Priority</label>
            <select id="pr-priority" name="priority" defaultValue="NORMAL" className={field}>
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div>
            <label htmlFor="pr-needed" className={label}>Needed by</label>
            <input id="pr-needed" name="neededBy" type="date" className={field} />
          </div>
          <div>
            <label htmlFor="pr-reason" className={label}>Reason</label>
            <input id="pr-reason" name="reason" placeholder="e.g. low stock, customer repair" className={field} />
          </div>
          <textarea name="notes" rows={2} placeholder="Additional notes" aria-label="Additional notes" className={`${field} sm:col-span-2 xl:col-span-4`} />
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-700 dark:text-red-400">{error}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={pending} className="px-4 font-bold">
          {pending ? "Saving..." : "Save request"}
        </Button>
        <Link href="/inventory/purchase-requests" className="text-xs font-medium text-[var(--ink-muted)] underline-offset-2 hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
