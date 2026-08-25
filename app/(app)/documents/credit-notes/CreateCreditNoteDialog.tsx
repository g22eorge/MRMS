"use client";

import { useMemo, useState } from "react";

import { CheckboxField } from "@/components/forms";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { DocumentSourcePicker } from "@/components/documents/DocumentSourcePicker";
import { clientDisplayName } from "@/lib/client-name";

type SourceLine = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

/**
 * A credit note can be raised against a POS sale or an invoice. Both arrive
 * here flattened to the same shape so the picker, the line list and the totals
 * do not have to care which one is selected — `key` is what the action reads.
 */
type SourceOption = {
  /** "sale:<id>" or "invoice:<id>" — posted as sourceKey. */
  key: string;
  kind: "sale" | "invoice";
  reference: string;
  totalAmount: number;
  currency: string;
  client: { fullName: string; phone: string | null; organization: string | null } | null;
  items: SourceLine[];
};

type Props = {
  eligibleSources: SourceOption[];
  action: (formData: FormData) => Promise<void>;
  returnAndRefundAction: (formData: FormData) => Promise<void>;
  baseCurrency: string;
  paymentMethods: { value: string; label: string }[];
};

function money(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(value)}`;
}

export function CreateCreditNoteDialog({ eligibleSources, action, returnAndRefundAction, baseCurrency, paymentMethods }: Props) {
  const [open, setOpen] = useState(false);
  const [sourceKey, setSourceKey] = useState(eligibleSources[0]?.key ?? "");
  const selected = useMemo(
    () => eligibleSources.find((s) => s.key === sourceKey) ?? eligibleSources[0] ?? null,
    [eligibleSources, sourceKey],
  );
  const isForeign = selected ? selected.currency !== baseCurrency : false;

  const sales = eligibleSources.filter((s) => s.kind === "sale");
  const invoices = eligibleSources.filter((s) => s.kind === "invoice");
  const toOption = (s: SourceOption) => ({
    value: s.key,
    label: `${clientDisplayName(s.client, "Walk-in")} — ${s.reference}`,
    hint: money(s.totalAmount, s.currency),
    // Customer name first: people search by who, not by document number.
    search: [clientDisplayName(s.client, "Walk-in"), s.client?.phone, s.reference].filter(Boolean).join(" "),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem]"
      >
        + New Credit Note
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="xl" ariaLabel="Create Credit Note">
        <ModalHeader
          title="Create Credit Note"
          subtitle="Pick the sale or invoice, then the lines coming back."
          onClose={() => setOpen(false)}
        />

        {eligibleSources.length > 0 && selected ? (
          <form action={action} className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
              <label className="space-y-1">
                <span className="text-[0.75rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Sale or invoice</span>
                <DocumentSourcePicker
                  name="sourceKey"
                  required
                  defaultValue={selected.key}
                  onSelect={setSourceKey}
                  groups={[
                    { label: "Returnable sales", options: sales.map(toOption) },
                    { label: "Invoices", options: invoices.map(toOption) },
                  ].filter((g) => g.options.length > 0)}
                  placeholder="Search by customer name or number…"
                  emptyLabel="Nothing matches that"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[0.75rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Reason</span>
                <input
                  name="reason"
                  required
                  placeholder="Return, adjustment, warranty..."
                  className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm text-[var(--ink)]"
                />
              </label>
            </div>

            <div className="max-h-[360px] overflow-y-auto rounded-xl border border-[var(--line)]">
              {selected.items.length === 0 ? (
                <p className="px-3 py-4 text-sm text-[var(--ink-muted)]">
                  {selected.reference} has no itemised lines, so there is nothing to pick.
                  Refund it directly from Refunds instead.
                </p>
              ) : null}
              {selected.items.map((item) => (
                <label key={item.id} className="grid gap-3 border-b border-[var(--line)] px-3 py-2.5 last:border-0 sm:grid-cols-[auto_1fr_90px_110px] sm:items-center">
                  <CheckboxField
                    name="itemId"
                    value={item.id}
                    defaultChecked
                    inputClassName="mt-1 sm:mt-0"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--ink)]">{item.description}</span>
                    <span className="text-[0.75rem] text-[var(--ink-muted)]">{money(item.lineTotal, selected.currency)}</span>
                  </span>
                  <input
                    name={`quantity:${item.id}`}
                    type="number"
                    min="0"
                    step="any"
                    max={item.quantity}
                    defaultValue={item.quantity}
                    className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm"
                    aria-label={`Quantity for ${item.description}`}
                  />
                  <span className="text-right text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
                    @ {money(item.unitPrice, selected.currency)}
                  </span>
                </label>
              ))}
            </div>

            <div className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel-strong)]/40 p-3 sm:grid-cols-[1fr_1.2fr]">
              <label className="space-y-1">
                <span className="text-[0.75rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Refund method</span>
                <select
                  name="method"
                  defaultValue={paymentMethods[0]?.value ?? "CASH"}
                  className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm text-[var(--ink)]"
                >
                  {paymentMethods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[0.75rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Refund reference <span className="font-normal normal-case">(optional)</span></span>
                <input
                  name="reference"
                  placeholder="Txn ID, note…"
                  className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm text-[var(--ink)]"
                />
              </label>
              {isForeign ? (
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-[0.75rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Exchange rate to {baseCurrency} <span className="font-normal normal-case">(required to refund now)</span></span>
                  <input
                    name="exchangeRateToBase"
                    inputMode="decimal"
                    placeholder={`1 ${selected.currency} = ? ${baseCurrency}`}
                    className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm text-[var(--ink)]"
                  />
                </label>
              ) : null}
              <p className="text-[0.75rem] text-[var(--ink-muted)] sm:col-span-2">
                &ldquo;Return &amp; refund now&rdquo; creates the credit note, puts the selected items back in stock, and refunds them in full — all at once.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={selected.items.length === 0}
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:border-[var(--accent)]/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create only
              </button>
              <button
                type="submit"
                disabled={selected.items.length === 0}
                formAction={returnAndRefundAction}
                onClick={(e) => { if (!window.confirm("Create the credit note, restock the selected items, and refund them in full now?")) e.preventDefault(); }}
                className="btn-premium rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                Return &amp; refund now
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 text-sm text-[var(--ink-muted)]">No settled sale or invoice is available to credit yet.</div>
        )}
      </Modal>
    </>
  );
}
