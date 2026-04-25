"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { adjustStockAction, createPartAction } from "@/app/(app)/inventory/actions";

type Props = {
  parts: Array<{ id: string; sku: string; name: string }>;
};

export function InventoryActions({ parts }: Props) {
  const router = useRouter();
  const createFormRef = useRef<HTMLFormElement>(null);
  const adjustFormRef = useRef<HTMLFormElement>(null);
  const [isCreating, startCreateTransition] = useTransition();
  const [isAdjusting, startAdjustTransition] = useTransition();

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <form
        ref={createFormRef}
        action={(formData) => {
          startCreateTransition(async () => {
            const res = await createPartAction(formData);
            if (res?.error) {
              toast.error(res.error);
              return;
            }
            toast.success("Part created");
            createFormRef.current?.reset();
            router.refresh();
          });
        }}
        className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Add Part</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input name="sku" required placeholder="SKU" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm" />
          <input name="name" required placeholder="Part name" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm" />
          <input name="manufacturer" placeholder="Manufacturer" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm" />
          <input type="number" name="unitCost" min={0} step="0.01" placeholder="Unit cost" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm" />
          <input type="number" name="openingQty" min={0} defaultValue={0} required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm" />
          <input type="number" name="reorderLevel" min={0} defaultValue={0} required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm" />
        </div>
        <button disabled={isCreating} className="btn-premium mt-3 rounded-lg px-3 py-2 text-sm disabled:opacity-60">
          {isCreating ? "Saving..." : "Save Part"}
        </button>
      </form>

      <form
        ref={adjustFormRef}
        action={(formData) => {
          startAdjustTransition(async () => {
            const res = await adjustStockAction(formData);
            if (res?.error) {
              toast.error(res.error);
              return;
            }
            toast.success("Stock updated");
            adjustFormRef.current?.reset();
            router.refresh();
          });
        }}
        className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Adjust Stock</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select name="partId" required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm sm:col-span-2">
            <option value="">Select part</option>
            {parts.map((part) => (
              <option key={part.id} value={part.id}>{part.name} ({part.sku})</option>
            ))}
          </select>
          <select name="type" defaultValue="IN" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm">
            <option value="IN">Add stock</option>
            <option value="OUT">Remove stock</option>
            <option value="ADJUST">Set exact stock</option>
          </select>
          <input type="number" name="quantity" min={0} required placeholder="Quantity" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm" />
          <input name="reason" placeholder="Reason (optional)" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm sm:col-span-2" />
        </div>
        <button disabled={isAdjusting || parts.length === 0} className="btn-premium mt-3 rounded-lg px-3 py-2 text-sm disabled:opacity-60">
          {isAdjusting ? "Updating..." : "Update Stock"}
        </button>
      </form>
    </section>
  );
}
