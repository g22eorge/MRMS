"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { moveJobToClientAction } from "@/app/(app)/jobs/[id]/move-actions";

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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[12px] font-semibold text-[var(--ink-muted)] hover:bg-[var(--panel-strong)]"
      >
        Move to another account
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Move job to another account</p>
        <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)]">Cancel</button>
      </div>
      <p className="mb-2 text-[12px] text-[var(--ink-muted)]">
        Currently on <span className="font-semibold text-[var(--ink)]">{currentClientName}</span>. The job&rsquo;s quotations, invoice and receipts move with it.
      </p>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setTargetId(null); }}
          placeholder="Search the account to move to (name, company or phone)…"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]/50"
        />
        {query && !targetId ? (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-lg">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-[var(--ink-muted)]">No matching account.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setTargetId(c.id); setQuery(c.fullName); }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-[var(--panel-strong)]"
                >
                  <span className="font-semibold text-[var(--ink)]">{c.fullName}</span>
                  <span className="text-[12px] text-[var(--ink-muted)]">{c.organization || c.phone}</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
      {target ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[13px]">Move to <span className="font-semibold text-[var(--ink)]">{target.fullName}</span>{target.organization ? <span className="text-[var(--ink-muted)]"> · {target.organization}</span> : null}</span>
          <button type="button" onClick={doMove} disabled={moving} className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-40">
            {moving ? "Moving…" : "Move job"}
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-[12px] text-red-600">{error}</p> : null}
    </div>
  );
}
