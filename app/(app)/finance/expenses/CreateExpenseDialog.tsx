"use client";

import { useRef, useActionState, useState } from "react";

import { Modal, ModalHeader } from "@/components/ui/Modal";

export type ExpenseFormState = { error?: string } | null;

type Props = {
  action: (prev: ExpenseFormState, formData: FormData) => Promise<ExpenseFormState>;
  categories: { value: string; label: string }[];
  methods: { value: string; label: string }[];
  suppliers: { id: string; name: string }[];
  currency: string;
};

const field =
  "input-base w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.75rem]";

export function CreateExpenseDialog({ action, categories, methods, suppliers, currency }: Props) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Close and clear only on success — a rejected expense stays open with the
  // error visible. The old header popup redirected to ?error=…, which closed
  // the form and could scroll the message out of view.
  const [state, formAction, pending] = useActionState(
    async (prev: ExpenseFormState, formData: FormData) => {
      const result = await action(prev, formData);
      if (!result?.error) {
        setOpen(false);
        formRef.current?.reset();
      }
      return result;
    },
    null as ExpenseFormState,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-premium cursor-pointer rounded-lg px-3 py-1.5 text-[0.75rem]"
      >
        + Record Expense
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="md" ariaLabel="Record Business Expense">
        <ModalHeader title="Record Business Expense" onClose={() => setOpen(false)} />

        <form ref={formRef} action={formAction} className="flex flex-col gap-3 p-4">
          {state?.error ? (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[0.8125rem] font-medium text-red-600">
              {state.error}
            </p>
          ) : null}

          <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
            Description <span className="text-red-500">*</span>
            <input name="description" required placeholder="e.g. Office rent — April" className={`mt-1 ${field}`} />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
              Amount <span className="text-red-500">*</span>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="0.00"
                className={`mt-1 ${field}`}
              />
            </label>
            <div>
              <span className="mb-1 block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">Currency</span>
              {/* Locked to org base currency server-side; shown so the amount is unambiguous. */}
              <div className={`${field} flex items-center text-[var(--ink-muted)]`}>{currency}</div>
              <input type="hidden" name="currency" value={currency} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="mb-1 block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">Category</span>
              <select name="category" className={field}>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="mb-1 block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">Payment Method</span>
              <select name="method" className={field}>
                <option value="">— none —</option>
                {methods.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rarely-needed fields stay in the form (native <details> keeps them
              in the DOM so they still submit) but collapse by default so
              "rent, 500k, cash" is a three-field job. */}
          <details className="rounded-lg border border-[var(--line)]">
            <summary className="cursor-pointer select-none px-3 py-2 text-[0.8125rem] font-semibold text-[var(--ink)]">
              More details <span className="font-normal text-[var(--ink-muted)]">— optional</span>
            </summary>
            <div className="space-y-3 px-3 pb-3">
              <div>
                <span className="mb-1 block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
                  Date paid <span className="font-normal">(defaults to today)</span>
                </span>
                <input name="paidAt" type="date" className={field} />
              </div>
              {suppliers.length > 0 && (
                <div>
                  <span className="mb-1 block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">Supplier</span>
                  <select name="supplierId" className={field}>
                    <option value="">— none —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <span className="mb-1 block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
                  Reference / Receipt #
                </span>
                <input name="reference" placeholder="Invoice or receipt number" className={field} />
              </div>
              <div>
                <span className="mb-1 block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">Notes</span>
                <textarea name="notes" rows={2} className={field} />
              </div>
            </div>
          </details>

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
              {pending ? "Saving…" : "Save Expense"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
