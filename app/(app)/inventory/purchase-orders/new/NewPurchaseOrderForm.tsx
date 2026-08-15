"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { PartSelect, lineItemInputClass } from "@/components/forms";
import { DataTable } from "@/components/ui/DataTable";
import { useLineItemsState } from "@/hooks/useLineItemsState";
import { parseFormNumber } from "@/lib/forms/line-items";

import { createPurchaseOrderAction, createAndReceivePurchaseOrderAction, quickCreateSupplierAction } from "../actions";

type Supplier = { id: string; name: string };
type Part = { id: string; name: string; sku: string; unitCost: number | null };
type LineData = { description: string; qtyOrdered: number; unitCost: number; partId: string };

const fieldClass = "mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15";
const labelClass = "block text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]";

export function NewPurchaseOrderForm({
  suppliers,
  parts,
  defaultSupplierId,
}: {
  suppliers: Supplier[];
  parts: Part[];
  defaultSupplierId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState(defaultSupplierId ?? "");
  const [supplierList, setSupplierList] = useState(suppliers);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  function handleAddSupplier() {
    const name = newSupplierName.trim();
    if (name.length < 2) { setError("Enter a supplier name (at least 2 characters)"); return; }
    setError(null);
    startTransition(async () => {
      const res = await quickCreateSupplierAction(name);
      if (res.error || !res.id) { setError(res.error ?? "Failed to add supplier"); return; }
      const created = { id: res.id, name: res.name ?? name };
      setSupplierList((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSupplierId(created.id);
      setNewSupplierName("");
      setAddingSupplier(false);
    });
  }
  const { lines, addLine, removeLine, updateLine, appendToFormData } = useLineItemsState<LineData>(() => ({
    description: "",
    qtyOrdered: 1,
    unitCost: 0,
    partId: "",
  }));

  const selectedSupplier = supplierList.find((supplier) => supplier.id === supplierId);
  const canSubmit = supplierList.length > 0;
  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + line.qtyOrdered * line.unitCost, 0);
    const quantity = lines.reduce((sum, line) => sum + line.qtyOrdered, 0);
    const readyLines = lines.filter((line) => line.description.trim() && line.qtyOrdered > 0).length;
    const zeroCostLines = lines.filter((line) => line.description.trim() && line.unitCost <= 0).length;
    return { subtotal, quantity, readyLines, zeroCostLines };
  }, [lines]);

  function onPartSelect(key: number, partId: string) {
    const part = parts.find((candidate) => candidate.id === partId);
    updateLine(key, { partId, description: part ? part.name : "", unitCost: part?.unitCost ?? 0 });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.name) fd.set(submitter.name, submitter.value);
    appendToFormData(fd, "items", ({ description, qtyOrdered, unitCost, partId }) => ({
      description,
      qtyOrdered,
      unitCost,
      partId: partId || undefined,
    }));

    startTransition(async () => {
      const receiveNow = fd.get("receiveNow") === "1";
      const result = receiveNow
        ? await createAndReceivePurchaseOrderAction(fd)
        : await createPurchaseOrderAction(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/inventory/purchase-orders/${result.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)]/40 px-4 py-2.5 text-[0.8125rem] text-[var(--ink-muted)]">
        Pick or add a supplier, list what you bought and the price, then <span className="font-semibold text-[var(--ink)]">Receive now</span> to stock it in — or save a draft / send the order to the supplier instead.
      </p>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)]">
        <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className={labelClass}>Supplier</span>
              <button type="button" onClick={() => { setAddingSupplier((v) => !v); setError(null); }} className="text-[0.6875rem] font-semibold text-[var(--accent)] hover:underline">
                {addingSupplier ? "Cancel" : "+ New"}
              </button>
            </div>
            <select name="supplierId" required value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={fieldClass}>
              <option value="">{supplierList.length ? "Select supplier" : "No suppliers yet — add one"}</option>
              {supplierList.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
            {addingSupplier ? (
              <div className="mt-2 flex gap-2">
                <input
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSupplier(); } }}
                  placeholder="New supplier name"
                  autoFocus
                  className={fieldClass}
                />
                <button type="button" onClick={handleAddSupplier} disabled={pending || newSupplierName.trim().length < 2} className="btn-premium shrink-0 rounded-md px-3 text-sm font-semibold disabled:opacity-50">
                  Add
                </button>
              </div>
            ) : null}
          </div>
          <label className={labelClass}>
            Expected delivery
            <input name="expectedAt" type="date" className={fieldClass} />
          </label>
          <div className="flex items-end">
            <span className="rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-muted)]">
              {totals.quantity} unit{totals.quantity === 1 ? "" : "s"} · <span className="font-bold text-[var(--ink)]">{totals.subtotal.toLocaleString()}</span>
            </span>
          </div>
        </div>

        {/* Reference, order date and notes are optional — hidden until needed. */}
        <div className="border-t border-[var(--line)] px-3 py-2.5">
          <button type="button" onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails} className="flex w-full items-center justify-between gap-2 text-left">
            <span className="text-[0.8125rem] font-semibold text-[var(--ink)]">Reference, order date &amp; notes <span className="font-normal text-[var(--ink-muted)]">— optional</span></span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`text-[var(--ink-muted)] transition-transform ${showDetails ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div className={showDetails ? "mt-3 grid gap-3 sm:grid-cols-2" : "hidden"}>
            <label className={labelClass}>
              Reference
              <input name="reference" type="text" placeholder="Optional" className={fieldClass} />
            </label>
            <label className={labelClass}>
              Order date
              <input name="orderedAt" type="date" className={fieldClass} />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Notes
              <textarea name="notes" rows={2} placeholder="Terms, delivery instructions, warranty, approval note" className={`${fieldClass} resize-none`} />
            </label>
          </div>
        </div>

        {supplierList.length === 0 && !addingSupplier ? (
          <div className="mx-3 mb-3 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm">
            <button type="button" onClick={() => setAddingSupplier(true)} className="font-semibold text-[var(--accent)] hover:underline">+ Add your first supplier</button>
            <span className="text-[var(--ink-muted)]"> to raise this order — no need to leave the page.</span>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
          <p className="text-sm font-bold text-[var(--ink)]">Order lines</p>
          <button type="button" onClick={addLine} className="rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
            Add line
          </button>
        </div>

        <DataTable
          frameless
          dense
          rows={lines}
          getRowKey={(line) => String(line.key)}
          empty="No order lines yet."
          columns={[
            {
              key: "index",
              header: "#",
              headerClassName: "w-10",
              className: "w-10 align-top text-[0.75rem] font-semibold text-[var(--ink-muted)]",
              cell: (_line, index) => index + 1,
            },
            {
              key: "item",
              header: "Inventory item",
              className: "align-top",
              cell: (line) => (
                <PartSelect
                  value={line.partId}
                  parts={parts}
                  onChange={(partId) => onPartSelect(line.key, partId)}
                  customLabel="Custom item"
                  className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1 text-[0.8125rem] text-[var(--ink)] outline-none focus:border-[var(--accent)]/50"
                />
              ),
            },
            {
              key: "description",
              header: "Description",
              className: "align-top",
              cell: (line) => (
                <input value={line.description} onChange={(event) => updateLine(line.key, { description: event.target.value })} required placeholder="Description" className={`${lineItemInputClass}`} />
              ),
            },
            {
              key: "qty",
              header: "Qty",
              align: "right",
              headerClassName: "w-24",
              className: "w-24 align-top",
              cell: (line) => (
                <input type="number" min={1} value={line.qtyOrdered} onChange={(event) => updateLine(line.key, { qtyOrdered: Math.max(1, Math.floor(parseFormNumber(event.target.value, 1))) })} className={`${lineItemInputClass} text-right tabular-nums`} />
              ),
            },
            {
              key: "unitCost",
              header: "Unit cost",
              align: "right",
              headerClassName: "w-32",
              className: "w-32 align-top",
              cell: (line) => (
                <input type="number" min={0} step={0.01} value={line.unitCost} onChange={(event) => updateLine(line.key, { unitCost: Math.max(0, parseFormNumber(event.target.value)) })} className={`${lineItemInputClass} text-right tabular-nums`} />
              ),
            },
            {
              key: "total",
              header: "Total",
              align: "right",
              headerClassName: "w-32",
              className: "w-32 align-top font-semibold tabular-nums text-[var(--ink)]",
              cell: (line) => (line.qtyOrdered * line.unitCost).toLocaleString(),
            },
          ]}
          actions={(line) => (
            <button type="button" onClick={() => removeLine(line.key)} disabled={lines.length === 1} className="rounded-md border border-[var(--line)] px-2 py-1 text-[0.75rem] font-semibold text-[var(--ink-muted)] hover:border-red-400/40 hover:text-red-600 disabled:opacity-40">
              Remove
            </button>
          )}
          tableFooter={
            <tr className="bg-[var(--panel-strong)]">
              <td colSpan={3} className="px-3 py-2 text-[0.75rem] font-semibold text-[var(--ink-muted)]">
                Supplier: {selectedSupplier?.name ?? "Not selected"}
              </td>
              <td className="px-3 py-2 text-right font-bold tabular-nums text-[var(--ink)]">{totals.quantity}</td>
              <td className="px-3 py-2 text-right text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">Total</td>
              <td className="px-3 py-2 text-right font-black tabular-nums text-[var(--ink)]">{totals.subtotal.toLocaleString()}</td>
              <td />
            </tr>
          }
        />
      </div>

      {error ? <p className="rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600">{error}</p> : null}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] bg-[var(--bg)]/95 py-2 backdrop-blur">
        {totals.zeroCostLines > 0 ? (
          <span className="mr-auto text-xs text-amber-600">Add a cost to every line to receive or send it. You can still save a draft.</span>
        ) : null}
        <Link href="/inventory/purchase-orders" className="rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink-muted)] hover:bg-[var(--panel-strong)]">
          Cancel
        </Link>
        <button type="submit" disabled={pending || !canSubmit} className="rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink-muted)] hover:bg-[var(--panel-strong)] disabled:opacity-50">
          {pending ? "Saving..." : "Save as draft"}
        </button>
        <button type="submit" name="issueNow" value="1" disabled={pending || !canSubmit || totals.zeroCostLines > 0} className="rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--panel-strong)] disabled:opacity-50">
          {pending ? "Issuing..." : "Send to supplier"}
        </button>
        <button type="submit" name="receiveNow" value="1" disabled={pending || !canSubmit || totals.zeroCostLines > 0} className="btn-premium rounded-md px-4 py-2 text-sm font-bold disabled:opacity-50" title="Create the order and stock it in immediately">
          {pending ? "Receiving..." : "Receive now"}
        </button>
      </div>
    </form>
  );
}
