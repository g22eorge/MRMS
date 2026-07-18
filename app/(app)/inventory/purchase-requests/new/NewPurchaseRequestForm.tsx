"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { LineItemsPanel, PartSelect, lineItemInputClass } from "@/components/forms";
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

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Procurement Brief</p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            A purchase request is the internal buying argument. Capture why the business needs the spend, when it is needed, the preferred supplier, and enough line detail for approval or conversion to PO without rework.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {[
              ["1", "Need"],
              ["2", "Approve"],
              ["3", "Order"],
              ["4", "Receive"],
            ].map(([step, label]) => (
              <div key={step} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
                <p className="text-[11px] font-black text-[var(--accent)]">{step}</p>
                <p className="text-xs font-semibold text-[var(--ink)]">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Approval Snapshot</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Lines ready</dt><dd className="font-bold text-[var(--ink)]">{completedLines}/{lines.length}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Catalog linked</dt><dd className="font-bold text-[var(--ink)]">{linkedLines}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--ink-muted)]">Exposure</dt><dd className="font-bold tabular-nums text-[var(--ink)]">{total.toLocaleString()}</dd></div>
          </dl>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 space-y-4">
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Request Details</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-[var(--ink-muted)]">Preferred supplier
            <select name="supplierId" className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)]">
              <option value="">No preference</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-[var(--ink-muted)]">Priority
            <select name="priority" defaultValue="NORMAL" className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)]">
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-[var(--ink-muted)]">Needed by
            <input name="neededBy" type="date" className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)]" />
          </label>
          <label className="block text-xs font-semibold text-[var(--ink-muted)]">Reason
            <input name="reason" placeholder="e.g. low stock, customer repair" className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)]" />
          </label>
        </div>
        <textarea name="notes" rows={2} placeholder="Additional notes" className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)]" />
      </div>

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
              className: "w-32 text-xs tabular-nums text-[var(--ink-muted)]",
              cell: (line) => (line.quantity * line.estimatedUnitCost).toLocaleString(),
            },
          ]}
          actions={(line) =>
            lines.length > 1 ? (
              <button type="button" onClick={() => removeLine(line.key)} className="text-xs font-bold text-[var(--ink-muted)] hover:text-red-500">x</button>
            ) : null
          }
          tableFooter={
            <tr className="bg-[var(--gold)]/5">
              <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold text-[var(--ink-muted)]">Estimated Total</td>
              <td className="px-3 py-2 text-right text-sm font-bold text-[var(--ink)] tabular-nums">{total.toLocaleString()}</td>
              <td />
            </tr>
          }
        />
      </LineItemsPanel>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-premium rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50">{pending ? "Submitting..." : "Submit Request"}</button>
        <Link href="/inventory/purchase-requests" className="rounded-lg border border-[var(--line)] px-5 py-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">Cancel</Link>
      </div>
    </form>
  );
}
