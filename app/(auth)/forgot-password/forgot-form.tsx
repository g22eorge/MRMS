"use client";

import { useState } from "react";

const field =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#C9A227]/50";

export function ForgotPasswordForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) return;
    setState("sending");
    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, redirectTo: "/reset-password" }),
      });
      // The same answer whether or not the address has an account, so this
      // page cannot be used to find out who has one.
      setState(res.status === 429 ? "error" : "sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p role="status" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80">
        If that address has an account, a reset link is on its way. It works for one hour.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <label className="block space-y-1">
        <span className="text-[0.75rem] font-semibold uppercase tracking-wide text-white/50">Email</span>
        <input type="email" name="email" required autoComplete="email" className={field} />
      </label>
      {state === "error" ? (
        <p role="alert" className="text-sm text-red-400">Couldn&apos;t send right now. Try again in a few minutes.</p>
      ) : null}
      <button
        type="submit"
        disabled={state === "sending"}
        className="w-full rounded-xl bg-[#C9A227] py-3 text-sm font-semibold text-black transition hover:bg-[#c9a430] disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
