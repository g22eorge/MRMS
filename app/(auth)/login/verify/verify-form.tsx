"use client";

import Link from "next/link";
import { useState } from "react";

const field =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg tracking-[0.3em] text-white outline-none placeholder:tracking-normal placeholder:text-white/30 focus:border-[#C9A227]/50";

export function VerifyCodeForm() {
  const [mode, setMode] = useState<"app" | "backup">("app");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s+/g, "");
    if (!code) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(mode === "app" ? "/api/auth/two-factor/verify-totp" : "/api/auth/two-factor/verify-backup-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
        return;
      }
      setError(
        res.status === 429
          ? "Too many attempts. Wait a few minutes."
          : res.status === 401
            ? "Your sign-in timed out. Start again."
            : mode === "app"
              ? "That code isn't right. Codes change every 30 seconds."
              : "That backup code isn't right, or was already used.",
      );
    } catch {
      setError("Couldn't check the code. Try again.");
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <label className="block space-y-1.5">
        <span className="text-[0.75rem] font-semibold uppercase tracking-wide text-white/50">
          {mode === "app" ? "Code from your authenticator app" : "Backup code"}
        </span>
        <input
          key={mode}
          name="code"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode={mode === "app" ? "numeric" : "text"}
          placeholder={mode === "app" ? "123456" : "xxxxx-xxxxx"}
          className={field}
        />
      </label>
      {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[#C9A227] py-3 text-sm font-semibold text-black transition hover:bg-[#c9a430] disabled:opacity-50"
      >
        {pending ? "Checking…" : "Continue"}
      </button>
      <div className="flex items-center justify-between text-xs text-white/40">
        <button type="button" onClick={() => { setMode(mode === "app" ? "backup" : "app"); setError(null); }} className="text-[#C9A227]/70 hover:text-[#C9A227]">
          {mode === "app" ? "Use a backup code" : "Use the app instead"}
        </button>
        <Link href="/login" className="hover:text-white/70">Start again</Link>
      </div>
    </form>
  );
}
