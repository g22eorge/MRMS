"use client";

import { useActionState } from "react";

type UserPasswordResetState = {
  error?: string;
  success?: string;
};

export function UserPasswordResetForm({
  userId,
  action,
}: {
  userId: string;
  action: (state: UserPasswordResetState, formData: FormData) => Promise<UserPasswordResetState>;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3 md:grid-cols-[1fr_1fr_auto]">
      <input type="hidden" name="userId" value={userId} />
      <input
        required
        minLength={8}
        type="password"
        name="password"
        placeholder="New password (min 8 chars)"
        className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/14"
      />
      <input
        required
        minLength={8}
        type="password"
        name="confirm"
        placeholder="Confirm password"
        className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/14"
      />
      <button className="btn-premium rounded-lg px-3 py-1.5 text-sm text-white">
        Reset Password
      </button>

      {state.error ? <p className="text-sm text-black md:col-span-3">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-[var(--accent)] md:col-span-3">{state.success}</p> : null}
      <p className="text-[11px] text-[var(--ink-muted)] md:col-span-3">
        This will sign the user out on all devices.
      </p>
    </form>
  );
}
