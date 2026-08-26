"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  reserveJobPartAction,
  consumeJobPartAction,
  releaseJobPartAction,
} from "@/app/(app)/jobs/[id]/parts-actions";

export type JobPartOption = {
  id: string;
  sku: string;
  name: string;
  qtyOnHand: number;
  qtyReserved: number;
};

export type JobPartLine = {
  id: string;
  partId: string;
  name: string;
  sku: string;
  quantity: number;
  status: string;
  reservedAt: Date | string | null;
  consumedAt: Date | string | null;
};

type Props = {
  jobId: string;
  locationId: string | null;
  locationName: string | null;
  parts: JobPartOption[];
  lines: JobPartLine[];
  readOnly?: boolean;
};

const rowClass = "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-3 py-2.5";
const fieldClass = "rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm";

/**
 * Parts on a repair job, backed by real stock.
 *
 * Reserved parts are still on the shelf but spoken for; fitting one takes it
 * out of stock for good. Both numbers are shown per line so a technician can
 * see which state a part is in without learning the vocabulary.
 */
export function JobPartsPanel({ jobId, locationId, locationName, parts, lines, readOnly }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [partId, setPartId] = useState("");

  const reserved = lines.filter((l) => l.status === "RESERVED");
  const consumed = lines.filter((l) => l.status === "CONSUMED");

  // Without a stock location there is nowhere to draw parts from. Say so
  // plainly and point at the fix rather than showing a form that cannot work.
  if (!locationId) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] px-4 py-5 text-sm text-[var(--ink-muted)]">
        <p className="font-medium text-[var(--ink)]">No stock location set up yet</p>
        <p className="mt-1">
          Parts are drawn from a stock location. Create one under Inventory → Locations, then you can
          record parts against this job.
        </p>
      </div>
    );
  }

  function run(action: (fd: FormData) => Promise<{ success: true; message: string } | { success: false; error: string }>, fd: FormData) {
    startTransition(async () => {
      const res = await action(fd);
      if (res.success) {
        toast.success(res.message);
        setPartId("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const selected = parts.find((p) => p.id === partId);
  const available = selected ? selected.qtyOnHand - selected.qtyReserved : null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[0.75rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Parts used</p>
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
          Taken from inventory — stock updates as you fit each part.
        </p>
      </div>

      {!readOnly && (
        <form
          action={(fd) => {
            fd.set("jobId", jobId);
            fd.set("locationId", locationId);
            run(reserveJobPartAction, fd);
          }}
          className="space-y-2"
        >
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--ink-muted)]">Part</span>
              <select
                name="partId"
                value={partId}
                onChange={(e) => setPartId(e.target.value)}
                className={`${fieldClass} w-full`}
                required
              >
                <option value="">Choose a part…</option>
                {parts.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.qtyOnHand - p.qtyReserved <= 0}>
                    {p.name} · {p.sku} ({p.qtyOnHand - p.qtyReserved} available)
                  </option>
                ))}
              </select>
            </label>
            <label className="w-24">
              <span className="mb-1.5 block text-xs font-semibold text-[var(--ink-muted)]">Qty</span>
              <input
                name="quantity"
                type="number"
                min="1"
                step="1"
                defaultValue="1"
                max={available ?? undefined}
                className={`${fieldClass} w-full`}
                required
              />
            </label>
            <SubmitButton disabled={pending || !partId} pendingLabel="Adding…">
              Add part
            </SubmitButton>
          </div>
          <p className="text-xs text-[var(--ink-muted)]">
            Drawn from {locationName ?? "your stock location"}. Adding reserves the part; it leaves
            stock when you mark it fitted.
          </p>
        </form>
      )}

      {lines.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">No parts recorded on this job yet.</p>
      ) : (
        <div className="space-y-2">
          {reserved.map((line) => (
            <div key={line.id} className={rowClass}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {line.quantity} × {line.name}
                </p>
                <p className="text-xs text-[var(--ink-muted)]">
                  {line.sku} · reserved, still on the shelf
                </p>
              </div>
              {!readOnly && (
                <div className="flex shrink-0 gap-2">
                  <form
                    action={(fd) => {
                      fd.set("jobId", jobId);
                      fd.set("reservationId", line.id);
                      fd.set("locationId", locationId);
                      run(consumeJobPartAction, fd);
                    }}
                  >
                    <SubmitButton size="sm" disabled={pending} pendingLabel="Saving…">
                      Mark fitted
                    </SubmitButton>
                  </form>
                  <form
                    action={(fd) => {
                      fd.set("jobId", jobId);
                      fd.set("reservationId", line.id);
                      fd.set("locationId", locationId);
                      run(releaseJobPartAction, fd);
                    }}
                  >
                    <SubmitButton size="sm" variant="secondary" disabled={pending} pendingLabel="Saving…">
                      Return to stock
                    </SubmitButton>
                  </form>
                </div>
              )}
            </div>
          ))}

          {consumed.map((line) => (
            <div key={line.id} className={`${rowClass} opacity-75`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {line.quantity} × {line.name}
                </p>
                <p className="text-xs text-[var(--ink-muted)]">{line.sku} · fitted, removed from stock</p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--panel-strong)] px-2.5 py-1 text-xs font-medium">
                Fitted
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
