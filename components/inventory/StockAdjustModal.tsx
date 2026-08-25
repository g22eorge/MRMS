"use client";

import { useState } from "react";

import { Modal, ModalHeader } from "@/components/ui/Modal";

import { SubmitButton } from "@/components/ui/SubmitButton";
type AdjustType = "IN" | "OUT" | "ADJUST";

type Props = {
  partId: string;
  currentQty: number;
  /** The adjustStockAction server action. */
  action: (formData: FormData) => Promise<void>;
};

const TYPES: { key: AdjustType; label: string }[] = [
  { key: "IN", label: "Receive" },
  { key: "OUT", label: "Issue" },
  { key: "ADJUST", label: "Correct" },
];

const inputCls =
  "h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15";

// Single "Adjust stock" entry point → a focused modal with a type toggle
// (Receive / Issue / Correct). Keeps the item page calm and read-first; the
// adjustment is a deliberate action behind one button.
export function StockAdjustModal({ partId, currentQty, action }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AdjustType>("IN");

  const isCorrect = type === "ADJUST";
  const reasonLabel = type === "OUT" ? "Reason" : isCorrect ? "Reason (recommended)" : "Reference / note";
  const reasonPlaceholder = type === "IN" ? "e.g. GRN-102, restock" : type === "OUT" ? "e.g. damaged in repair" : "e.g. physical stock count";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-premium rounded-lg px-4 py-1.5 text-[0.8125rem] font-semibold"
      >
        Adjust stock
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="sm" ariaLabel="Adjust stock">
        <ModalHeader title="Adjust stock" subtitle="Receive, issue, or correct the count." onClose={() => setOpen(false)} />

        <div className="space-y-4 p-4">
          {/* Type toggle */}
          <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--panel-strong)]/40 p-1">
            {TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                className={`rounded-lg px-2 py-1.5 text-[0.8125rem] font-semibold transition ${
                  type === t.key
                    ? "bg-[var(--accent)] text-black"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <form action={action} className="space-y-3">
            <input type="hidden" name="partId" value={partId} />
            <input type="hidden" name="type" value={type} />
            {isCorrect ? <input type="hidden" name="quantity" value="1" /> : null}

            {isCorrect ? (
              <label className="block">
                <span className="mb-1 block text-[0.75rem] font-semibold text-[var(--ink-muted)]">Correct to</span>
                <input name="correctTo" inputMode="numeric" placeholder={String(currentQty)} required autoFocus className={inputCls} />
                <span className="mt-1 block text-[0.6875rem] text-[var(--ink-muted)]">
                  Currently <strong className="tabular-nums text-[var(--ink)]">{currentQty}</strong> on hand. No cost impact.
                </span>
              </label>
            ) : (
              <label className="block">
                <span className="mb-1 block text-[0.75rem] font-semibold text-[var(--ink-muted)]">Quantity</span>
                <input name="quantity" inputMode="numeric" placeholder="0" required autoFocus className={inputCls} />
              </label>
            )}

            {type === "IN" ? (
              <label className="block">
                <span className="mb-1 block text-[0.75rem] font-semibold text-[var(--ink-muted)]">
                  Unit cost <span className="font-normal text-[var(--ink-muted)]/60">— optional, updates average cost</span>
                </span>
                <input name="unitCost" inputMode="decimal" placeholder="Leave blank to keep current" className={inputCls} />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-1 block text-[0.75rem] font-semibold text-[var(--ink-muted)]">{reasonLabel}</span>
              <input name="reason" placeholder={reasonPlaceholder} className={inputCls} />
            </label>

            <div className="flex gap-2 pt-1">
              <SubmitButton bare onClick={(e) => {
 if (type === "OUT" && !window.confirm("Write off this stock? It removes units from on-hand and can't be undone.")) {
 e.preventDefault();
 }
 }}
 className="btn-premium flex-1 rounded-lg px-4 py-2 text-sm font-semibold">
                {type === "IN" ? "Receive stock" : type === "OUT" ? "Issue stock" : "Correct count"}
              </SubmitButton>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink-muted)] transition hover:text-[var(--ink)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
