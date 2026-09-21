"use client";

import { useRef, useActionState, useState } from "react";

import { Modal, ModalHeader } from "@/components/ui/Modal";

export type RecurringFormState = { error?: string } | null;

type Props = {
  action: (prev: RecurringFormState, formData: FormData) => Promise<RecurringFormState>;
  clients: { id: string; name: string }[];
  frequencies: string[];
  freqLabels: Record<string, string>;
  invoiceTypes: string[];
  typeLabels: Record<string, string>;
  currency: string;
};

const field =
  "input-base w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.75rem]";

export function CreateRecurringTemplateDialog({
  action,
  clients,
  frequencies,
  freqLabels,
  invoiceTypes,
  typeLabels,
  currency,
}: Props) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Close and clear only on success — a rejected template stays open with the
  // error visible instead of the popup vanishing with no feedback.
  const [state, formAction, pending] = useActionState(
    async (prev: RecurringFormState, formData: FormData) => {
      const result = await action(prev, formData);
      if (!result?.error) {
        setOpen(false);
        formRef.current?.reset();
      }
      return result;
    },
    null as RecurringFormState,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-premium cursor-pointer rounded-lg px-3 py-1.5 text-[0.75rem]"
      >
        + New Template
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="lg" ariaLabel="New Recurring Invoice">
        <ModalHeader title="New Recurring Invoice" onClose={() => setOpen(false)} />

        {/* The form is long (line items + optional fields), and the panel itself
            has no max-height, so the body scrolls rather than overflowing the
            viewport with the submit button off-screen. */}
        <form ref={formRef} action={formAction} className="flex max-h-[80vh] flex-col gap-3 overflow-y-auto p-4">
          {state?.error ? (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[0.8125rem] font-medium text-red-600">
              {state.error}
            </p>
          ) : null}

          <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
            Client <span className="text-red-500">*</span>
            <select name="clientId" required className={`mt-1 ${field}`}>
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
            Subject <span className="text-red-500">*</span>
            <input name="subject" required placeholder="e.g. Monthly maintenance contract" className={`mt-1 ${field}`} />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
              Frequency
              <select name="frequency" className={`mt-1 ${field}`}>
                {frequencies.map((f) => (
                  <option key={f} value={f}>{freqLabels[f] ?? f}</option>
                ))}
              </select>
            </label>
            <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
              Invoice Type
              <select name="invoiceType" className={`mt-1 ${field}`}>
                {invoiceTypes.map((t) => (
                  <option key={t} value={t}>{typeLabels[t] ?? t}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
              Start / Next Due
              <input name="startDate" type="date" className={`mt-1 ${field}`} />
            </label>
            <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
              Currency
              <input name="currency" defaultValue={currency} className={`mt-1 ${field}`} />
            </label>
          </div>

          <div>
            <p className="mb-1.5 text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
              Line Items <span className="text-red-500">*</span>
            </p>
            <div className="space-y-1.5">
              <div className="grid grid-cols-[1fr_60px_80px] gap-1 text-[0.75rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
                <span>Description</span><span className="text-right">Qty</span><span className="text-right">Price</span>
              </div>
              {([0, 1, 2] as const).map((i) => (
                <div key={i} className="grid grid-cols-[1fr_60px_80px] gap-1">
                  <input name="itemDescription" placeholder={i === 0 ? "Service description" : "Optional"} className={field} />
                  <input name="itemQty" type="number" min="0.01" step="0.01" defaultValue={i === 0 ? "1" : ""} placeholder="1" className={`${field} text-right`} />
                  <input name="itemPrice" type="number" min="0" step="0.01" placeholder="0.00" className={`${field} text-right`} />
                  <input name="itemDiscount" type="hidden" defaultValue="0" />
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-[0.75rem] text-[var(--ink)]">
            <input type="checkbox" name="autoIssue" className="rounded" />
            Auto-issue invoice when due (requires scheduled job)
          </label>

          <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
            Notes
            <textarea name="notes" rows={2} className={`mt-1 ${field}`} />
          </label>

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-[var(--line)] py-2 text-sm font-medium text-[var(--ink-muted)] transition hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 btn-premium rounded-lg py-2 text-sm font-semibold disabled:opacity-60"
            >
              {pending ? "Creating…" : "Create Template"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
