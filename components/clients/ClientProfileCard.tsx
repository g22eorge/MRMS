"use client";

import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/ui/SubmitButton";
export type UpdateClientState = { ok: boolean; error: string | null };

type ClientProfile = {
  fullName: string;
  phone: string;
  email: string | null;
  organization: string | null;
  address: string | null;
  notes: string | null;
};

type Props = {
  client: ClientProfile;
  canEdit: boolean;
  action: (prev: UpdateClientState, formData: FormData) => Promise<UpdateClientState>;
};

const controlClass =
  "w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none transition focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15 disabled:opacity-70";

function ViewRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-[var(--ink-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-[0.8125rem] text-[var(--ink)]">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

export function ClientProfileCard({ client, canEdit, action }: Props) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(action, { ok: false, error: null } as UpdateClientState);

  // Leave edit mode once a *fresh* save succeeds. React's sanctioned
  // adjust-state-during-render pattern: compare by result identity
  // (useActionState returns a new object per dispatch) so re-opening the editor
  // after a previous success doesn't immediately snap it shut.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.ok) setEditing(false);
  }

  if (!editing) {
    return (
      <div className="dc-card px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Client Profile</p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">Contact details, address, and internal notes.</p>
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.8125rem] font-medium text-[var(--ink)] transition hover:border-[var(--accent)]/50"
            >
              Edit
            </button>
          ) : null}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ViewRow label="Full name" value={client.fullName} />
          <ViewRow label="Phone" value={client.phone} />
          <ViewRow label="Email" value={client.email} />
          <ViewRow label="Organization" value={client.organization} />
          <div className="md:col-span-2">
            <ViewRow label="Address / location" value={client.address} />
          </div>
          <div className="md:col-span-2">
            <ViewRow label="Internal notes" value={client.notes} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="dc-card space-y-4 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Edit Client Profile</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Update contact details, address, and internal notes.</p>
        </div>
      </div>

      {state.error ? (
        <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[0.8125rem] text-red-700 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-[var(--ink-muted)]">Full name</span>
          <input name="fullName" defaultValue={client.fullName} className={controlClass} />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-[var(--ink-muted)]">Phone</span>
          <input name="phone" defaultValue={client.phone} className={controlClass} />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-[var(--ink-muted)]">Email</span>
          <input name="email" defaultValue={client.email ?? ""} className={controlClass} />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-[var(--ink-muted)]">Organization</span>
          <input name="organization" defaultValue={client.organization ?? ""} className={controlClass} />
        </label>

        <label className="space-y-1 md:col-span-2">
          <span className="text-xs font-medium text-[var(--ink-muted)]">Address / location</span>
          <input name="address" defaultValue={client.address ?? ""} className={controlClass} />
        </label>

        <label className="space-y-1 md:col-span-2">
          <span className="text-xs font-medium text-[var(--ink-muted)]">Internal notes</span>
          <textarea
            name="notes"
            defaultValue={client.notes ?? ""}
            className="min-h-24 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none transition focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/20 disabled:opacity-70"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <SubmitButton bare disabled={pending} className="btn-premium rounded-lg px-3 py-2 text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save Client"}
        </SubmitButton>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={pending}
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-[0.8125rem] font-medium text-[var(--ink)] transition hover:border-[var(--accent)]/50 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
