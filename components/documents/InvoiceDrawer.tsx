"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATDate } from "@/lib/date-eat";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge, toneForInvoice, type BadgeTone } from "@/components/ui/StatusBadge";

type Line = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number | null;
  lineTotal: number;
  sourceId: string | null;
};

type Payment = {
  id: string;
  amount: number;
  method: string;
  receivedAt: Date;
  reference: string | null;
  createdBy: { fullName: string } | null;
};

type DeliveryNote = {
  id: string;
  deliveryNoteNumber: string;
  deliveredAt: Date;
  deliveryMethod: string;
  deliveredByName: string;
  receivedByName: string;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  subject: string | null;
  issuedAt: Date;
  dueDate: Date | null;
  totalAmount: number;
  paidAmount: number;
  balance: number | null;
  notes: string | null;
  currency: string | null;
  status: string;
  isPaid: boolean;
  isVoid: boolean;
  daysOverdue: number;
  client: {
    fullName: string;
    phone: string | null;
    email: string | null;
    organization: string | null;
    address: string | null;
  } | null;
  job: {
    id: string;
    jobNumber: string;
    brand: string | null;
    model: string | null;
    serialOrImei: string | null;
    status: string;
  } | null;
  lines: Line[];
  payments: Payment[];
  deliveryNotes: DeliveryNote[];
};

export type InvoiceDrawerProps = {
  invoice: Invoice;
  currency: string;
  onClose: () => void;
  open?: boolean;
};

export function InvoiceDrawer({ invoice, currency, onClose, open = true }: InvoiceDrawerProps) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [editForm, setEditForm] = useState({
    subject: "",
    notes: "",
    dueDate: "",
    status: "ISSUED",
    invoiceType: "SERVICE",
  });
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const data = invoice;
  const subtotal = data.lines.reduce((s, l) => s + l.lineTotal, 0);
  const taxAmount = data.lines.reduce((s, l) => s + (l.taxAmount ?? 0), 0);
  const total = subtotal + taxAmount;

  useEffect(() => {
    setMode("view");
    setEditForm({
      subject: data.subject ?? "",
      notes: data.notes ?? "",
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString().slice(0, 10) : "",
      status: data.status,
      invoiceType: data.invoiceType,
    });
  }, [data.id, refreshKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [open, mode]);

  const act = useCallback(
    async (action: string, body: Record<string, unknown>) => {
      setPending(action);
      setError(null);
      try {
        const res = await fetch(`/api/invoices/${data.id}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...body }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "Action failed");
        }
        if (action === "update" || action === "void") {
          setRefreshKey((k) => k + 1);
        }
        if (action === "deliveryNote" || action === "whatsapp") {
          const text = action === "deliveryNote" ? "Delivery note generated." : "WhatsApp queued.";
          alert(text);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setPending(null);
      }
    },
    [data.id],
  );

  const statusLabel = data.isPaid
    ? "Paid"
    : data.status === "VOID"
      ? "Void"
      : data.status === "DRAFT"
        ? "Draft"
        : data.daysOverdue > 0
          ? `${data.daysOverdue}d overdue`
          : "Open";
  const badgeTone: BadgeTone = data.isPaid
    ? "success"
    : data.status === "VOID"
      ? "danger"
      : data.daysOverdue > 0
        ? "danger"
        : "warning";

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Invoice ${data.invoiceNumber}`}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 flex justify-end">
        <div className="h-full w-full max-w-3xl overflow-hidden border-l border-[var(--line)] bg-[var(--panel)] shadow-2xl">
          <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
          <div className="flex h-full flex-col" style={{ animation: "slideInRight 0.2s ease-out" }}>
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[var(--ink)] truncate">Invoice {data.invoiceNumber}</p>
                <p className="text-[11px] text-[var(--ink-muted)] truncate">{data.subject ?? data.invoiceType}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--ink-muted)] transition hover:bg-[var(--panel-strong)] hover:text-[var(--accent)]"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-5">
                {error && (
                  <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">{error}</div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge tone={badgeTone}>{statusLabel}</StatusBadge>
                  <span className="text-[12px] text-[var(--ink-muted)]">
                    Issued {formatEATDate(data.issuedAt)} · Due {data.dueDate ? formatEATDate(data.dueDate) : "—"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)] mb-1">Bill To</p>
                    <p className="text-[13px] font-semibold">{data.client?.fullName ?? "Walk-in"}</p>
                    {data.client?.organization && <p className="text-[12px] text-[var(--ink-muted)]">{data.client.organization}</p>}
                    {data.client?.phone && <p className="text-[12px] text-[var(--ink-muted)]">{data.client.phone}</p>}
                    {data.client?.email && <p className="text-[12px] text-[var(--ink-muted)]">{data.client.email}</p>}
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)] mb-1">Job Reference</p>
                    {data.job ? (
                      <>
                        <p className="text-[13px] font-semibold">{data.job.jobNumber}</p>
                        <p className="text-[12px] text-[var(--ink-muted)]">
                          {[data.job.brand, data.job.model].filter(Boolean).join(" ") || "Repair"}
                        </p>
                        {data.job.serialOrImei && <p className="text-[12px] text-[var(--ink-muted)]">SN: {data.job.serialOrImei}</p>}
                        <Link href={`/jobs/${data.job.id}`} className="text-[11px] font-bold text-[var(--accent)] hover:underline mt-1 inline-block">
                          Open job →
                        </Link>
                      </>
                    ) : (
                      <p className="text-[12px] text-[var(--ink-muted)]">Standalone ({data.invoiceType})</p>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                  <div className="border-b border-[var(--line)] px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Line Items</p>
                  </div>
                  <DataTable
                    frameless
                    dense
                    rows={data.lines}
                    getRowKey={(line) => `${line.id}-${refreshKey}`}
                    empty="No line items."
                    columns={[
                      {
                        key: "description",
                        header: "Description",
                        className: "min-w-[200px]",
                        cell: (line) => (
                          <>
                            <p className="font-medium text-[var(--ink)]">{line.description}</p>
                            {line.sourceId ? <p className="text-[11px] text-[var(--ink-muted)]">Ref: {line.sourceId}</p> : null}
                          </>
                        ),
                      },
                      { key: "qty", header: "Qty", align: "center", className: "mono w-[50px]", cell: (line) => line.quantity },
                      { key: "unitPrice", header: "Unit Price", align: "right", className: "mono w-[90px] whitespace-nowrap", cell: (line) => formatMoney(line.unitPrice, currency) },
                      {
                        key: "discount",
                        header: "Discount",
                        align: "right",
                        className: "mono w-[80px] whitespace-nowrap text-[var(--ink-muted)]",
                        cell: (line) => (line.discountAmount > 0 ? formatMoney(line.discountAmount, currency) : "—"),
                      },
                      { key: "total", header: "Total", align: "right", className: "mono w-[90px] whitespace-nowrap font-bold", cell: (line) => formatMoney(line.lineTotal, currency) },
                    ]}
                  />
                  <div className="flex flex-col items-end gap-0.5 border-t border-[var(--line)] px-3 py-2">
                    <div className="flex w-full max-w-[220px] justify-between text-[12px]">
                      <span className="text-[var(--ink-muted)]">Subtotal</span>
                      <span className="mono">{formatMoney(subtotal, currency)}</span>
                    </div>
                    {taxAmount > 0 && (
                      <div className="flex w-full max-w-[220px] justify-between text-[12px]">
                        <span className="text-[var(--ink-muted)]">Tax</span>
                        <span className="mono">{formatMoney(taxAmount, currency)}</span>
                      </div>
                    )}
                    <div className="flex w-full max-w-[220px] justify-between text-[14px]">
                      <span className="font-bold">Total</span>
                      <span className="mono font-black">{formatMoney(total, currency)}</span>
                    </div>
                    {data.paidAmount > 0 && (
                      <div className="flex w-full max-w-[220px] justify-between text-[12px]">
                        <span className="text-[var(--ink-muted)]">Paid</span>
                        <span className="mono text-emerald-600">{formatMoney(data.paidAmount, currency)}</span>
                      </div>
                    )}
                    <div className="flex w-full max-w-[220px] justify-between text-[14px]">
                      <span className="font-bold">Balance Due</span>
                      <span className="mono font-black">{formatMoney(data.balance ?? total - data.paidAmount, currency)}</span>
                    </div>
                  </div>
                </div>

                {data.notes && (
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)] mb-1">Notes</p>
                    <p className="whitespace-pre-wrap text-[13px] text-[var(--ink-muted)]">{data.notes}</p>
                  </div>
                )}

                {data.payments.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                    <div className="border-b border-[var(--line)] px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Payments</p>
                    </div>
                    <DataTable
                      frameless
                      dense
                      rows={data.payments}
                      getRowKey={(p) => p.id}
                      empty="No payments."
                      columns={[
                        { key: "date", header: "Date", className: "whitespace-nowrap", cell: (p) => formatEATDate(p.receivedAt) },
                        { key: "method", header: "Method", cell: (p) => p.method },
                        { key: "reference", header: "Reference", className: "mono text-[12px]", cell: (p) => p.reference ?? "—" },
                        { key: "by", header: "By", cell: (p) => p.createdBy?.fullName ?? "—" },
                        { key: "amount", header: "Amount", align: "right", className: "mono whitespace-nowrap", cell: (p) => formatMoney(p.amount, currency) },
                      ]}
                    />
                  </div>
                )}

                {data.deliveryNotes.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                    <div className="border-b border-[var(--line)] px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Delivery Notes</p>
                    </div>
                    <DataTable
                      frameless
                      dense
                      rows={data.deliveryNotes}
                      getRowKey={(n) => n.id}
                      empty="No delivery notes."
                      columns={[
                        { key: "number", header: "#", className: "mono font-bold whitespace-nowrap", cell: (n) => n.deliveryNoteNumber },
                        { key: "date", header: "Date", className: "whitespace-nowrap", cell: (n) => formatEATDate(n.deliveredAt) },
                        { key: "method", header: "Method", cell: (n) => n.deliveryMethod },
                        { key: "deliveredBy", header: "Delivered By", cell: (n) => n.deliveredByName },
                        { key: "receivedBy", header: "Received By", cell: (n) => n.receivedByName },
                      ]}
                    />
                  </div>
                )}

                {mode === "edit" && (
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Edit Details</p>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                      className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50"
                    >
                      {["DRAFT", "ISSUED", "PAID", "VOID"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <select
                      value={editForm.invoiceType}
                      onChange={(e) => setEditForm((f) => ({ ...f, invoiceType: e.target.value }))}
                      className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50"
                    >
                      {["SERVICE", "MERCHANDISE", "CONTRACT", "OTHER"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <input
                      value={editForm.subject}
                      onChange={(e) => setEditForm((f) => ({ ...f, subject: e.target.value }))}
                      placeholder="Subject"
                      className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50"
                    />
                    <input
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))}
                      className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50"
                    />
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Notes"
                      rows={3}
                      className="w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]/50"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          act("update", {
                            subject: editForm.subject || null,
                            notes: editForm.notes || null,
                            dueDate: editForm.dueDate || null,
                            status: editForm.status,
                            invoiceType: editForm.invoiceType,
                          })
                        }
                        disabled={pending === "update"}
                        className="btn-premium flex-1 rounded-lg py-2 text-sm font-bold disabled:opacity-50"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode("view")}
                        className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] py-2 text-sm font-medium text-[var(--ink-muted)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[var(--line)] bg-[var(--panel-strong)] px-5 py-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMode(mode === "view" ? "edit" : "view")}
                  className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-medium hover:border-[var(--accent)]/50"
                >
                  {mode === "view" ? "✏️ Edit" : "Editing…"}
                </button>
                <Link
                  href={`/documents/invoices?pay=${data.id}`}
                  className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-medium hover:border-[var(--accent)]/50"
                >
                  💰 Register Payment
                </Link>
                <button
                  type="button"
                  onClick={() => act("deliveryNote", { deliveredByName: "Office", receivedByName: data.client?.fullName ?? "Client", deliveryMethod: "PICKUP", note: "" })}
                  disabled={!!pending}
                  className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-medium hover:border-[var(--accent)]/50 disabled:opacity-50"
                >
                  📦 Generate Delivery Note
                </button>
                <button
                  type="button"
                  onClick={() => act("whatsapp", { jobId: data.job?.id })}
                  disabled={!!pending || !data.job?.id}
                  className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-medium hover:border-[var(--accent)]/50 disabled:opacity-50"
                >
                  💬 Send WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => window.open(`/api/invoices/${data.id}/pdf`, "_blank")}
                  className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-medium hover:border-[var(--accent)]/50"
                >
                  🖨 Print / PDF
                </button>
                {!data.isPaid && !data.isVoid && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Mark this invoice as VOID? This cannot be undone.")) act("void", {});
                    }}
                    disabled={!!pending}
                    className="ml-auto rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-[12px] font-bold text-red-700 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Mark VOID
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
