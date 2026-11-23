"use client";

import Link from "next/link";
import { useState } from "react";

const field =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#C9A227]/50";
const label = "text-[0.75rem] font-semibold uppercase tracking-wide text-white/50";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("newPassword") ?? "");
    if (newPassword.length < 8) return setError("Use at least 8 characters.");
    if (newPassword !== String(data.get("confirmPassword") ?? "")) return setError("The two passwords don't match.");
    setError(null);
    setState("saving");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword, token }),
      });
      if (res.ok) return setState("done");
      setError(res.status === 429 ? "Too many attempts. Try again in a few minutes." : "This link has expired or was already used. Ask for a new one.");
    } catch {
      setError("Couldn't save right now. Try again.");
    }
    setState("idle");
  }

  if (state === "done") {
    return (
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/80">
        <p role="status">Password changed. You&apos;ve been signed out everywhere else.</p>
        <Link href="/login" className="block rounded-xl bg-[#C9A227] py-3 text-center text-sm font-semibold text-black">Sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <label className="block space-y-1">
        <span className={label}>New password</span>
        <input type="password" name="newPassword" required minLength={8} autoComplete="new-password" className={field} />
        <span className="text-[0.75rem] text-white/40">At least 8 characters.</span>
      </label>
      <label className="block space-y-1">
        <span className={label}>Confirm new password</span>
        <input type="password" name="confirmPassword" required minLength={8} autoComplete="new-password" className={field} />
      </label>
      {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={state === "saving"}
        className="w-full rounded-xl bg-[#C9A227] py-3 text-sm font-semibold text-black transition hover:bg-[#c9a430] disabled:opacity-50"
      >
        {state === "saving" ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
