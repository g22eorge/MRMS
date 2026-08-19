"use client";

import { useRef, useActionState, useState } from "react";

import { Modal, ModalHeader } from "@/components/ui/Modal";

type SourceOption = {
  key: string;
  label: string;
};

export type ReceiptFormState = { error?: string } | null;

type Props = {
  sourceOptions: SourceOption[];
  baseCurrency: string;
  paymentMethods: string[];
  action: (prev: ReceiptFormState, formData: FormData) => Promise<ReceiptFormState>;
  initialOpen?: boolean;
};

export function CreateReceiptDialog({ sourceOptions, baseCurrency, paymentMethods, action, initialOpen = false }: Props) {
  const [open, setOpen] = useState(initialOpen);
  const formRef = useRef<HTMLFormElement>(null);
  // Only close and clear on success. Doing it unconditionally meant a rejected
  // receipt — an overpayment, or any foreign-currency invoice — closed the modal
  // and emptied the form, so the user believed the money had been recorded.
  const [state, formAction, pending] = useActionState(async (prev: ReceiptFormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result?.error) {
      setOpen(false);
      formRef.current?.reset();
    }
    return result;
  }, null as ReceiptFormState);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem] font-semibold"
      >
        + Receipt
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="md" ariaLabel="Create Receipt">
        <ModalHeader title="Create Receipt from Invoice or Sale" onClose={() => setOpen(false)} />

        <form ref={formRef} action={formAction} className="flex flex-col gap-3 p-4">
          {state?.error ? (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[0.8125rem] font-medium text-red-600">
              {state.error}
            </p>
          ) : null}
          <select
            name="sourceKey"
            required
            className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm text-[var(--ink)]"
          >
            <option value="">Select invoice or sale...</option>
            {sourceOptions.map((inv) => (
              <option key={inv.key} value={inv.key}>{inv.label}</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-[var(--ink-muted)]">
              Amount <span className="text-red-500">*</span>
              <input
                name="amount"
                required
                type="number"
                min="0.01"
                step="0.01"
                placeholder="How much was paid"
                className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm font-normal text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none focus:border-[var(--accent)]/50 focus:ring-1 focus:ring-[var(--accent)]/20"
              />
            </label>
            <label className="block text-xs font-semibold text-[var(--ink-muted)]">
              Paid by
              <select
                name="method"
                defaultValue="CASH"
                className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm font-normal text-[var(--ink)]"
              >
              {paymentMethods.map((m) => (
                <option key={m} value={m}>{m.replaceAll("_", " ")}</option>
              ))}
              </select>
            </label>
          </div>

          <input
            name="reference"
            placeholder="Reference (optional)"
            className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none focus:border-[var(--accent)]/50 focus:ring-1 focus:ring-[var(--accent)]/20"
          />
          <input type="hidden" name="currency" value={baseCurrency} />

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
              {pending ? "Creating…" : "Create Receipt"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
