"use client";

import Link from "next/link";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { LineItemsPanel, lineItemInputClass } from "@/components/forms";
import { DataTable } from "@/components/ui/DataTable";
import { useLineItemsState } from "@/hooks/useLineItemsState";

import { createSupplierBillAction } from "../actions";
import { quickCreateSupplierAction } from "@/app/(app)/inventory/purchase-orders/actions";

type Supplier = { id: string; name: string };
type PurchaseOrder = {
  id: string;
  supplierId: string;
  reference: string | null;
  items: Array<{ description: string; qtyOrdered: number; unitCost: number }>;
};
type GoodsReceived = {
  id: string;
  supplierId: string;
  poId: string | null;
  grnNumber: string;
  items: Array<{ description: string; quantity: number; unitCost: number }>;
};
type LineData = { description: string; quantity: number; unitCost: number };

function mapSourceLine(line: { description: string; quantity: number; unitCost: number }): LineData {
  return {
    description: line.description,
    quantity: Math.max(1, Math.floor(Number(line.quantity) || 1)),
    unitCost: Math.max(0, Number(line.unitCost) || 0),
  };
}

export function NewSupplierBillForm({
  suppliers,
  purchaseOrders,
  goodsReceived,
  defaultSupplierId,
  defaultPoId,
  defaultGrnId,
  baseCurrency,
}: {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  goodsReceived: GoodsReceived[];
  defaultSupplierId?: string;
  defaultPoId?: string;
  defaultGrnId?: string;
  baseCurrency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  // The bill's own currency, so the rate field can appear only when it differs
  // from the currency the books are kept in.
  const [billCurrency, setBillCurrency] = useState(baseCurrency);
  const defaultGrn = goodsReceived.find((item) => item.id === (defaultGrnId ?? ""));
  const defaultPo = purchaseOrders.find((item) => item.id === (defaultPoId ?? defaultGrn?.poId ?? ""));
  const initialSupplierId = defaultSupplierId ?? defaultGrn?.supplierId ?? defaultPo?.supplierId ?? "";
  const initialPoId = defaultPoId ?? defaultGrn?.poId ?? "";
  const [supplierId, setSupplierId] = useState(initialSupplierId);
  const [supplierList, setSupplierList] = useState(suppliers);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [selectedPoId, setSelectedPoId] = useState(initialPoId);
  const [selectedGrnId, setSelectedGrnId] = useState(defaultGrnId ?? "");

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
      resetLinesForSupplier();
      setNewSupplierName("");
      setAddingSupplier(false);
    });
  }
  const { lines, addLine, removeLine, updateLine, replaceLines, appendToFormData } = useLineItemsState<LineData>(
    () => ({ description: "", quantity: 1, unitCost: 0 }),
  );

  const initialLines = useMemo(() => {
    if (defaultGrn?.items.length) return defaultGrn.items.map(mapSourceLine);
    if (defaultPo?.items.length) {
      return defaultPo.items.map((item) =>
        mapSourceLine({ description: item.description, quantity: item.qtyOrdered, unitCost: item.unitCost }),
      );
    }
    return null;
  }, [defaultGrn, defaultPo]);

  useEffect(() => {
    if (initialLines?.length) replaceLines(initialLines);
  }, [initialLines, replaceLines]);

  const supplierPOs = purchaseOrders.filter((po) => !supplierId || po.supplierId === supplierId);
  const supplierGRNs = goodsReceived.filter(
    (grn) =>
      (!supplierId || grn.supplierId === supplierId) && (!selectedPoId || !grn.poId || grn.poId === selectedPoId),
  );

  function setLinesFromGrn(grnId: string) {
    const grn = goodsReceived.find((item) => item.id === grnId);
    if (!grn) {
      setSelectedGrnId("");
      replaceLines([{ description: "", quantity: 1, unitCost: 0 }]);
      return;
    }
    setSelectedGrnId(grn.id);
    setSupplierId(grn.supplierId);
    if (grn.poId) setSelectedPoId(grn.poId);
    replaceLines(grn.items.length ? grn.items.map(mapSourceLine) : [{ description: "", quantity: 1, unitCost: 0 }]);
  }

  function setLinesFromPo(poId: string) {
    const po = purchaseOrders.find((item) => item.id === poId);
    setSelectedPoId(poId);
    setSelectedGrnId("");
    if (!po) {
      replaceLines([{ description: "", quantity: 1, unitCost: 0 }]);
      return;
    }
    setSupplierId(po.supplierId);
    replaceLines(
      po.items.length
        ? po.items.map((item) =>
            mapSourceLine({ description: item.description, quantity: item.qtyOrdered, unitCost: item.unitCost }),
          )
        : [{ description: "", quantity: 1, unitCost: 0 }],
    );
  }

  function resetLinesForSupplier() {
    setSelectedPoId("");
    setSelectedGrnId("");
    replaceLines([{ description: "", quantity: 1, unitCost: 0 }]);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    appendToFormData(fd, "items", ({ description, quantity, unitCost }) => ({ description, quantity, unitCost }));
    startTransition(async () => {
      const result = await createSupplierBillAction(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/inventory/supplier-bills/${result.id}`);
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="rounded-xl border border-[var(--line)] bg-[var(--panel-strong)]/40 px-4 py-2.5 text-[0.8125rem] text-[var(--ink-muted)]">
        Enter the bill your supplier gave you: who it is from, and the items and prices. Link it to an order only if you want to.
      </p>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="block text-xs font-semibold text-[var(--ink-muted)]">
            <div className="flex items-center justify-between gap-2">
              <span>Supplier</span>
              <button type="button" onClick={() => { setAddingSupplier((v) => !v); setError(null); }} className="text-[0.6875rem] font-semibold text-[var(--accent)] hover:underline">
                {addingSupplier ? "Cancel" : "+ New"}
              </button>
            </div>
            <select
              name="supplierId"
              required
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                resetLinesForSupplier();
              }}
              className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)]"
            >
              <option value="">{supplierList.length ? "Select supplier..." : "No suppliers yet — add one"}</option>
              {supplierList.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
            {addingSupplier ? (
              <div className="mt-2 flex gap-2">
                <input
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSupplier(); } }}
                  placeholder="New supplier name"
                  autoFocus
                  className="mt-0 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-[var(--ink)]"
                />
                <button type="button" onClick={handleAddSupplier} disabled={pending || newSupplierName.trim().length < 2} className="btn-premium shrink-0 rounded-lg px-3 text-sm font-semibold disabled:opacity-50">
                  Add
                </button>
              </div>
            ) : null}
          </div>
          <label className="block text-xs font-semibold text-[var(--ink-muted)]">
            Bill date
            <input name="issuedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)]" />
          </label>
          <label className="block text-xs font-semibold text-[var(--ink-muted)]">
            Payment due
            <input name="dueAt" type="date" className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)]" />
          </label>
        </div>

        {/* Match-to-order, tax and reference are for shops that run formal
            purchasing — hidden by default so a starter is not slowed down. */}
        <div className="border-t border-[var(--line)] pt-3">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="text-[0.8125rem] font-semibold text-[var(--ink)]">Match to an order, tax &amp; reference <span className="font-normal text-[var(--ink-muted)]">— optional</span></span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`text-[var(--ink-muted)] transition-transform ${showMore ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div className={showMore ? "mt-3 grid gap-4 sm:grid-cols-2" : "hidden"}>
            <label className="block text-xs font-semibold text-[var(--ink-muted)]">
              Supplier invoice/reference
              <input name="supplierRef" className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)]" />
            </label>
            <label className="block text-xs font-semibold text-[var(--ink-muted)]">
              Tax amount
              <input name="taxAmount" type="number" min={0} step={0.01} defaultValue={0} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-right text-sm text-[var(--ink)]" />
            </label>
            <label className="block text-xs font-semibold text-[var(--ink-muted)]">
              Purchase order <span className="font-normal">(fills items in)</span>
              <select name="poId" value={selectedPoId} onChange={(e) => setLinesFromPo(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)]">
                <option value="">No linked PO</option>
                {supplierPOs.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.reference ?? `PO-${po.id.slice(-6).toUpperCase()}`} · {po.items.length} line{po.items.length === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-[var(--ink-muted)]">
              Goods received <span className="font-normal">(fills items in)</span>
              <select name="grnId" value={selectedGrnId} onChange={(e) => setLinesFromGrn(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)]">
                <option value="">No linked GRN</option>
                {supplierGRNs.map((grn) => (
                  <option key={grn.id} value={grn.id}>
                    {grn.grnNumber} · {grn.items.length} line{grn.items.length === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-[var(--ink-muted)]">
              Currency
              {/* A list, not free text. This accepted anything typed into it,
                  so a bill could be stored against a currency that does not
                  exist and every conversion against it would score zero. */}
              <select name="currency" value={billCurrency} onChange={(e) => setBillCurrency(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] uppercase text-[var(--ink)]">
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}{c === baseCurrency ? " · your books" : ""}</option>
                ))}
              </select>
            </label>
            {billCurrency !== baseCurrency ? (
              <label className="text-[0.75rem] font-semibold text-[var(--ink-muted)]">
                Rate ({baseCurrency} per 1 {billCurrency})
                <input name="exchangeRate" inputMode="decimal" placeholder={`e.g. 3750`} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)]" />
                <span className="mt-1 block font-normal text-[var(--ink-muted)]">
                  The expected rate. What you actually settle at is captured when you record the payment.
                </span>
              </label>
            ) : null}
            <textarea name="notes" rows={2} placeholder="Notes" className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)] sm:col-span-2" />
          </div>
        </div>
      </div>

      <LineItemsPanel
        title="Line Items"
        subtitle={
          selectedGrnId
            ? "Loaded from selected GRN."
            : selectedPoId
              ? "Loaded from selected PO."
              : "Add supplier invoice lines."
        }
        onAddLine={addLine}
      >
        <DataTable
          frameless
          dense
          rows={lines}
          getRowKey={(line) => String(line.key)}
          empty="No invoice lines yet."
          columns={[
            {
              key: "description",
              header: "Description",
              cell: (line) => <input value={line.description} onChange={(e) => updateLine(line.key, { description: e.target.value })} required className={lineItemInputClass} />,
            },
            {
              key: "qty",
              header: "Qty",
              align: "right",
              headerClassName: "w-24",
              className: "w-24",
              cell: (line) => <input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: parseInt(e.target.value, 10) || 1 })} className={`${lineItemInputClass} text-right`} />,
            },
            {
              key: "unitCost",
              header: "Unit Cost",
              align: "right",
              headerClassName: "w-32",
              className: "w-32",
              cell: (line) => <input type="number" min={0} step={0.01} value={line.unitCost} onChange={(e) => updateLine(line.key, { unitCost: parseFloat(e.target.value) || 0 })} className={`${lineItemInputClass} text-right`} />,
            },
            {
              key: "total",
              header: "Total",
              align: "right",
              headerClassName: "w-32",
              className: "w-32 text-[0.75rem] tabular-nums text-[var(--ink-muted)]",
              cell: (line) => (line.quantity * line.unitCost).toLocaleString(),
            },
          ]}
          actions={(line) =>
            lines.length > 1 ? (
              <button type="button" onClick={() => removeLine(line.key)} className="text-[0.75rem] font-bold text-[var(--ink-muted)] hover:text-red-500">x</button>
            ) : null
          }
          tableFooter={
            <tr className="bg-[var(--accent)]/5">
              <td colSpan={3} className="px-3 py-2 text-right text-[0.75rem] font-semibold text-[var(--ink-muted)]">Subtotal</td>
              <td className="px-3 py-2 text-right font-bold text-[var(--ink)] tabular-nums">{subtotal.toLocaleString()}</td>
              <td />
            </tr>
          }
        />
      </LineItemsPanel>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-premium rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50">{pending ? "Saving..." : "Save bill"}</button>
        <Link href="/inventory/supplier-bills" className="rounded-lg border border-[var(--line)] px-5 py-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">Cancel</Link>
      </div>
    </form>
  );
}
