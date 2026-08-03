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
  const completedLines = lines.filter((line) => line.description.trim() && line.quantity > 0).length;
  const linkedLines = lines.filter((line) => line.partId).length;

  const field =
    "w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none transition placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15";
  const label = "mb-1 block text-[12px] font-medium text-[var(--ink-muted)]";

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Request Details</p>
          <p className="text-[12px] text-[var(--ink-muted)]">
            {completedLines}/{lines.length} lines ready · {linkedLines} catalog linked · exposure{" "}
            <span className="font-semibold tabular-nums text-[var(--ink)]">{total.toLocaleString()}</span>
          </p>
        </div>
        <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
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

      <LineItemsPanel title="Requested Items" onAddLine={addLine}>
        <DataTable
          frameless
          dense
          rows={lines}
          getRowKey={(line) => String(line.key)}
          empty="No requested items yet."
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
              header: "Description",
              cell: (line) => <input required value={line.description} onChange={(e) => updateLine(line.key, { description: e.target.value })} className={lineItemInputClass} />,
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
              header: "Est. Cost",
              align: "right",
              headerClassName: "w-32",
              className: "w-32",
              cell: (line) => <input type="number" min={0} step={0.01} value={line.estimatedUnitCost} onChange={(e) => updateLine(line.key, { estimatedUnitCost: parseFloat(e.target.value) || 0 })} className={`${lineItemInputClass} text-right`} />,
            },
            {
              key: "total",
              header: "Total",
              align: "right",
              headerClassName: "w-32",
              className: "w-32 text-[12px] tabular-nums text-[var(--ink-muted)]",
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
              <td colSpan={4} className="px-3 py-2 text-right text-[12px] font-semibold text-[var(--ink-muted)]">Estimated Total</td>
              <td className="px-3 py-2 text-right font-bold text-[var(--ink)] tabular-nums">{total.toLocaleString()}</td>
              <td />
            </tr>
          }
        />
      </LineItemsPanel>

      {error ? (
        <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-700 dark:text-red-400">{error}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={pending} className="px-4 font-bold">
          {pending ? "Submitting..." : "Submit Request"}
        </Button>
        <Link href="/inventory/purchase-requests" className="text-xs font-medium text-[var(--ink-muted)] underline-offset-2 hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
