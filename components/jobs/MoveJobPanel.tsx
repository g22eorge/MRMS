"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Modal } from "@/components/ui/Modal";
import { moveJobToClientAction } from "@/app/(app)/jobs/[id]/move-actions";

import { clientDisplayName } from "@/lib/client-name";
type Candidate = { id: string; fullName: string; phone: string; organization: string | null };

/**
 * Move this job to a different client account — for sorting jobs booked under the
 * wrong company account (e.g. a C-Care job that belongs to IMC but was captured
 * under IHK). Its quotations/invoice/receipts move with it.
 */
export function MoveJobPanel({
  jobId,
  currentClientName,
  candidates,
}: {
  jobId: string;
  currentClientName: string;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moving, startMove] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates.slice(0, 8);
    return candidates.filter((c) => `${c.fullName} ${c.organization ?? ""} ${c.phone}`.toLowerCase().includes(q)).slice(0, 8);
  }, [query, candidates]);

  const target = candidates.find((c) => c.id === targetId) ?? null;

  function doMove() {
    if (!targetId) return;
    setError(null);
    startMove(async () => {
      const res = await moveJobToClientAction({ jobId, targetClientId: targetId });
      if (res.success) {
        router.refresh();
        setOpen(false);
        setTargetId(null);
        setQuery("");
      } else {
        setError(res.error ?? "Move failed.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-premium-secondary rounded-lg px-3.5 py-2 text-[0.8125rem] font-semibold"
      >
        Move account
      </button>

      <Modal open={open} onClose={() => setOpen(false)} size="md" ariaLabel="Move job to another account" panelClassName="p-5">
        <p className="text-[0.8125rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Move job to another account</p>
        <p className="mb-3 mt-1 text-[0.8125rem] text-[var(--ink-muted)]">
          Currently on <span className="font-semibold text-[var(--ink)]">{currentClientName}</span>. The job&rsquo;s quotations, invoice and receipts move with it.
        </p>
        <div className="relative">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setTargetId(null); }}
            placeholder="Search the account to move to (name, company or phone)…"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50"
          />
          {query && !targetId ? (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-lg">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-[0.75rem] text-[var(--ink-muted)]">No matching account.</p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setTargetId(c.id); setQuery(clientDisplayName(c)); }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[0.8125rem] hover:bg-[var(--panel-strong)]"
                  >
                    <span className="font-semibold text-[var(--ink)]">{clientDisplayName(c)}</span>
                    <span className="text-[0.75rem] text-[var(--ink-muted)]">{c.organization || c.phone}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {error ? <p className="mr-auto text-[0.75rem] text-red-600">{error}</p> : null}
          <button type="button" onClick={() => setOpen(false)} className="btn-premium-secondary rounded-lg px-4 py-2 text-[0.8125rem] font-medium">Cancel</button>
          <button type="button" onClick={doMove} disabled={moving || !target} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[0.8125rem] font-semibold text-white hover:opacity-90 disabled:opacity-40">
            {moving ? "Moving…" : target ? `Move to ${clientDisplayName(target)}` : "Move job"}
          </button>
        </div>
      </Modal>
    </>
  );
}
