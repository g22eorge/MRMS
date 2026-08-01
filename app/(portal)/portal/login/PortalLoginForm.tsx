"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { portalLoginAction, type PortalLoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-black transition disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function PortalLoginForm() {
  const [state, formAction] = useActionState<PortalLoginState, FormData>(portalLoginAction, {});

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-[12px] font-medium text-[var(--ink-muted)]">Email</label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]/50"
        />
      </div>
      <div>
        <label className="text-[12px] font-medium text-[var(--ink-muted)]">Password</label>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]/50"
        />
      </div>
      {state.error ? <p className="text-[13px] text-red-500">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
