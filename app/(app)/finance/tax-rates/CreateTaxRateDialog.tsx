"use client";

import { useRef, useActionState, useState } from "react";

import { Modal, ModalHeader } from "@/components/ui/Modal";

export type TaxRateFormState = { error?: string } | null;

type Props = {
  action: (prev: TaxRateFormState, formData: FormData) => Promise<TaxRateFormState>;
};

const field =
  "input-base w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.75rem]";

export function CreateTaxRateDialog({ action }: Props) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Close and clear only on success — a rejected rate stays open with the
  // error visible (the old inline form silently did nothing on a duplicate).
  const [state, formAction, pending] = useActionState(
    async (prev: TaxRateFormState, formData: FormData) => {
      const result = await action(prev, formData);
      if (!result?.error) {
        setOpen(false);
        formRef.current?.reset();
      }
      return result;
    },
    null as TaxRateFormState,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem] font-semibold"
      >
        + Add Tax Rate
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="sm" ariaLabel="New Tax Rate">
        <ModalHeader title="New Tax Rate" onClose={() => setOpen(false)} />

        <form ref={formRef} action={formAction} className="flex flex-col gap-3 p-4">
          {state?.error ? (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[0.8125rem] font-medium text-red-600">
              {state.error}
            </p>
          ) : null}

          <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
            Name <span className="text-red-500">*</span>
            <input name="name" required placeholder="e.g. Value Added Tax" className={`mt-1 ${field}`} />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
              Code <span className="text-red-500">*</span>
              <input name="code" required placeholder="VAT" className={`mt-1 ${field} uppercase`} />
            </label>
            <label className="block text-[0.8125rem] font-semibold text-[var(--ink-muted)]">
              Rate % <span className="text-red-500">*</span>
              <input name="rate" type="number" min="0" max="100" step="0.01" required placeholder="18" className={`mt-1 ${field}`} />
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-[0.75rem] text-[var(--ink)]">
              <input type="checkbox" name="appliesToSales" defaultChecked className="rounded" />
              Applies to sales / invoices
            </label>
            <label className="flex items-center gap-2 text-[0.75rem] text-[var(--ink)]">
              <input type="checkbox" name="appliesToPurchases" className="rounded" />
              Applies to purchases
            </label>
            <label className="flex items-center gap-2 text-[0.75rem] text-[var(--ink)]">
              <input type="checkbox" name="isDefault" className="rounded" />
              Set as default rate
            </label>
          </div>

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
              {pending ? "Creating…" : "Create Tax Rate"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
