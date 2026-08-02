"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Modal, ModalHeader } from "@/components/ui/Modal";

const PAYMENT_METHODS = ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CARD", "OTHER"] as const;

const inputClass =
  "h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none focus:border-[var(--accent)]/50 focus:ring-1 focus:ring-[var(--accent)]/20";

/**
 * CollectPaymentButton — the invoice detail primary action. Opens a modal and
 * records a payment against the working /api/invoices/add-payment endpoint (which
 * creates the receipt and posts to the cash-basis ledger), then refreshes.
 */
export function CollectPaymentButton({
  invoiceId,
  currency,
  baseCurrency,
  balance,
}: {
  invoiceId: string;
  currency: string;
  baseCurrency: string;
  balance: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(balance > 0 ? Math.round(balance) : ""));
  const [method, setMethod] = useState<string>("CASH");
  const [reference, setReference] = useState("");
  const [rate, setRate] = useState("");

  const isForeign = currency !== baseCurrency;

  async function submit() {
    setError(null);
    const amt = Number(amount.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/invoices/add-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          amount: amt,
          method,
          reference: reference.trim() || undefined,
          exchangeRateToBase: isForeign ? rate.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(text || "Payment failed. Please check the amount and try again.");
        setPending(false);
        return;
      }
      setOpen(false);
      setPending(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-premium rounded-lg px-3 py-1.5 text-[12px] font-bold"
      >
        Collect payment
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="sm" ariaLabel="Collect payment">
        <ModalHeader title="Collect payment" subtitle={`Balance ${new Intl.NumberFormat().format(Math.max(0, Math.round(balance)))} ${currency}`} onClose={() => setOpen(false)} />
        <div className="flex flex-col gap-3 p-4">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Amount ({currency})</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" className={inputClass} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m.replaceAll("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Reference</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" className={inputClass} />
            </div>
          </div>
          {isForeign && (
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Exchange rate to {baseCurrency}</label>
              <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" placeholder={`1 ${currency} = ? ${baseCurrency}`} className={inputClass} />
            </div>
          )}
          {error ? <p className="text-[12px] font-medium text-[var(--dc-crit,#c0503f)]">{error}</p> : null}
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-[var(--line)] py-2 text-sm font-medium text-[var(--ink-muted)] transition hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]">Cancel</button>
            <button type="button" onClick={submit} disabled={pending} className="flex-1 btn-premium rounded-lg py-2 text-sm font-semibold disabled:opacity-60">{pending ? "Recording…" : "Record payment"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
