"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { previewClientMerge, mergeClientIntoAction, type ClientMergePreview } from "@/app/(app)/clients/[id]/merge-actions";

type Candidate = { id: string; fullName: string; phone: string; organization: string | null };

const LABELS: Record<string, string> = {
  device: "devices", clientNote: "notes", job: "jobs", invoice: "invoices", sale: "sales",
  inboundMessage: "inbound messages", repairRequest: "repair requests", customerConsent: "consents",
  recurringInvoice: "recurring invoices", receipt: "receipts", conversation: "conversations",
  lead: "leads", quotation: "quotations", campaignContact: "campaign contacts",
  portalUser: "portal logins", repairMessage: "repair messages",
};

/**
 * ADMIN-only tool to fold a duplicate client INTO another. Everything the source
 * owns (jobs, documents, portal logins, …) is reassigned to the target, then the
 * emptied source is removed. Shows a live preview of exactly what will move
 * before anything is committed.
 */
export function MergeClientPanel({
  sourceId,
  sourceName,
  sourceEmail,
  candidates,
}: {
  sourceId: string;
  sourceName: string;
  sourceEmail: string | null;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ClientMergePreview | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingPreview, startPreview] = useTransition();
  const [merging, startMerge] = useTransition();

  // Optional: turn this record's person into a portal login under the target.
  const [createLogin, setCreateLogin] = useState(false);
  const [loginName, setLoginName] = useState(sourceName);
  const [loginEmail, setLoginEmail] = useState(sourceEmail ?? "");
  const [loginPassword, setLoginPassword] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates.slice(0, 8);
    return candidates
      .filter((c) => `${c.fullName} ${c.organization ?? ""} ${c.phone}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, candidates]);

  const target = candidates.find((c) => c.id === targetId) ?? null;

  function selectTarget(c: Candidate) {
    setTargetId(c.id);
    setQuery(c.fullName);
    setError(null);
    setPreview(null);
    setConfirmText("");
    startPreview(async () => {
      const res = await previewClientMerge(sourceId, c.id);
      if (!res.ok) setError(res.error ?? "Could not preview the merge.");
      setPreview(res);
    });
  }

  function doMerge() {
    if (!targetId) return;
    setError(null);
    startMerge(async () => {
      const res = await mergeClientIntoAction({
        sourceId,
        targetId,
        contact: createLogin ? { name: loginName, email: loginEmail, password: loginPassword } : undefined,
      });
      if (res.success) {
        router.push(`/clients/${targetId}`);
        router.refresh();
      } else {
        setError(res.error ?? "Merge failed.");
      }
    });
  }

  const loginReady = !createLogin || (loginName.trim() && loginEmail.trim() && loginPassword.length >= 8);
  const canMerge = Boolean(targetId) && preview?.ok && confirmText.trim().toUpperCase() === "MERGE" && Boolean(loginReady) && !merging;

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/[0.03] p-4">
      <p className="text-[0.75rem] font-bold uppercase tracking-wide text-red-500/90">Merge / de-duplicate</p>
      <p className="mt-1 text-[0.8125rem] text-[var(--ink-muted)]">
        Fold <span className="font-semibold text-[var(--ink)]">{sourceName}</span> into another client. Every job, document and
        portal login moves to the client you pick, then this record is removed. This cannot be undone.
      </p>

      <div className="relative mt-3">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setTargetId(null); setPreview(null); }}
          placeholder="Search the client to keep (name, company or phone)…"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50"
        />
        {query && !targetId ? (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-lg">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[0.75rem] text-[var(--ink-muted)]">No matching client.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectTarget(c)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[0.8125rem] hover:bg-[var(--panel-strong)]"
                >
                  <span className="font-semibold text-[var(--ink)]">{c.fullName}</span>
                  <span className="text-[0.75rem] text-[var(--ink-muted)]">{c.organization || c.phone}</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      {loadingPreview ? <p className="mt-3 text-[0.75rem] text-[var(--ink-muted)]">Checking what will move…</p> : null}

      {target && preview?.ok ? (
        <div className="mt-3 space-y-2 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)]/40 p-3">
          <p className="text-[0.8125rem]">
            Move everything into <span className="font-semibold text-[var(--ink)]">{target.fullName}</span>
            {target.organization ? <span className="text-[var(--ink-muted)]"> · {target.organization}</span> : null}
          </p>
          {preview.totalMoving && preview.totalMoving > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {Object.entries(preview.counts ?? {}).map(([k, n]) => (
                <li key={k} className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[0.71875rem] font-semibold text-[var(--ink)]">
                  {n} {LABELS[k] ?? k}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.75rem] text-[var(--ink-muted)]">This client has no linked records — it will just be removed.</p>
          )}
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)]/60 p-2.5">
            <label className="flex items-center gap-2 text-[0.8125rem] font-medium text-[var(--ink)]">
              <input type="checkbox" checked={createLogin} onChange={(e) => setCreateLogin(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
              Also create a portal login from this record (under {target.fullName})
            </label>
            {createLogin ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder="Contact name" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50" />
                <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} type="email" placeholder="Email" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50" />
                <input value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} type="text" placeholder="Temp password (min 8)" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50" />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type MERGE to confirm'
              className="w-40 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-red-500/50"
            />
            <button
              type="button"
              onClick={doMerge}
              disabled={!canMerge}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-[0.8125rem] font-semibold text-white hover:bg-red-600 disabled:opacity-40"
            >
              {merging ? "Merging…" : `Merge into ${target.fullName}`}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-[0.75rem] text-red-600">{error}</p> : null}
    </div>
  );
}
