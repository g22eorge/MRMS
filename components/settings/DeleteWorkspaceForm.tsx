"use client";

import { useActionState } from "react";

import type { DeletionState } from "@/app/(app)/settings/data/actions";

export function DeleteWorkspaceForm({
  orgName,
  action,
}: {
  orgName: string;
  action: (state: DeletionState, formData: FormData) => Promise<DeletionState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-2">
      <label className="block space-y-1">
        <span className="text-[0.8125rem] text-[var(--ink-muted)]">
          Type <strong className="text-[var(--ink)]">{orgName}</strong> to confirm
        </span>
        <input
          name="confirmName"
          required
          autoComplete="off"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)] outline-none focus:border-red-500/50"
        />
      </label>
      {state.error ? <p role="alert" className="text-[0.8125rem] text-red-500">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[0.8125rem] font-semibold text-red-600 transition hover:bg-red-500/15 disabled:opacity-50"
      >
        {pending ? "Closing…" : "Close and delete this workspace"}
      </button>
    </form>
  );
}
