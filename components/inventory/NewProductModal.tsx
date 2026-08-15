"use client";

import { useState } from "react";

import { Modal, ModalHeader } from "@/components/ui/Modal";
import { buttonClasses } from "@/components/ui/Button";

const input =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.8125rem] text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-muted)]/50 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15";
const label = "mb-1 block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]";

/** A styled on/off toggle that also submits its state via a hidden input. */
function Toggle({ name, defaultOn, children }: { name: string; defaultOn: boolean; children: React.ReactNode }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <label className="flex shrink-0 items-center gap-2 pb-1">
      <input type="hidden" name={name} value={on ? "true" : "false"} />
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-[var(--accent)]" : "bg-[var(--panel-strong)] border border-[var(--line)]"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-4" : "left-0.5"}`} />
      </button>
      <span className="text-[0.8125rem] font-medium text-[var(--ink)]">{children}</span>
    </label>
  );
}

export function NewProductModal({
  action,
  categories,
  currency = "UGX",
  defaultTaxRate = 18,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: string[];
  currency?: string;
  defaultTaxRate?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClasses("primary", "sm", { className: "px-4 font-bold" })}>
        + Add Item
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="lg" ariaLabel="New product">
        <ModalHeader title="New Product" subtitle="Add a new item to your catalog." onClose={() => setOpen(false)} />

        <form action={action} className="max-h-[70vh] overflow-y-auto p-4">
          <datalist id="product-categories">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <label className={label}>Product name</label>
              <input name="name" required placeholder="e.g. HP EliteBook 14" className={input} />
            </div>
            <div>
              <label className={label}>Category</label>
              <input name="category" list="product-categories" placeholder="Search or add category…" className={input} />
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_0.8fr_auto] sm:items-end">
            <div>
              <label className={label}>Cost price ({currency})</label>
              <input name="unitCost" inputMode="decimal" placeholder="0.00" className={input} />
            </div>
            <div>
              <label className={label}>Selling price ({currency})</label>
              <input name="sellingPrice" inputMode="decimal" placeholder="0.00" className={input} />
            </div>
            <div>
              <label className={label}>Tax rate (%)</label>
              <input name="taxRate" inputMode="decimal" defaultValue={String(defaultTaxRate)} className={input} />
            </div>
            <Toggle name="taxable" defaultOn>Tax</Toggle>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className={label}>Base UOM</label>
              <input name="baseUom" placeholder="Base unit…" className={input} />
            </div>
            <div>
              <label className={label}>Sale UOM</label>
              <input name="saleUom" placeholder="Sale unit…" className={input} />
            </div>
            <div>
              <label className={label}>Purchase UOM</label>
              <input name="purchaseUom" placeholder="Purchase unit…" className={input} />
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label className={label}>Qty in stock</label>
              <input name="qtyOnHand" inputMode="numeric" placeholder="0" className={input} />
            </div>
            <div>
              <label className={label}>Reorder level</label>
              <input name="reorderLevel" inputMode="numeric" placeholder="0" className={input} />
            </div>
            <Toggle name="active" defaultOn>Active</Toggle>
          </div>

          <div className="mt-3">
            <label className={label}>Description</label>
            <textarea name="description" rows={3} placeholder="Optional notes about this product…" className={`${input} resize-y`} />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--line)] pt-3">
            <button type="button" onClick={() => setOpen(false)} className={buttonClasses("ghost", "sm", { className: "px-4" })}>
              Cancel
            </button>
            <button type="submit" className={buttonClasses("primary", "sm", { className: "px-5 font-bold" })}>
              Save Product
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
