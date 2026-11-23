"use client";

import QRCode from "qrcode";
import { useState } from "react";

/**
 * Two-step sign-in for the signed-in user: turn it on with an authenticator
 * app, or turn it off. Turning it on is three small steps on one card —
 * password, scan and confirm, then save the backup codes — and it only takes
 * effect once a first code has been accepted, so a half-finished setup cannot
 * lock anyone out.
 */
const field =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] text-[var(--ink)] outline-none focus:border-[var(--accent)]/50";
const primary = "btn-premium rounded-lg px-3 py-1.5 text-[0.8125rem] text-white disabled:opacity-50";
const quiet =
  "rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] font-semibold text-[var(--ink)] disabled:opacity-50";

type Step = "idle" | "password" | "scan" | "codes" | "turnOff";

async function post(path: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/auth/two-factor/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export function TwoFactorCard({ enabled: initiallyEnabled }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [step, setStep] = useState<Step>("idle");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [setupKey, setSetupKey] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const run = async (work: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await work();
    } catch {
      setError("Something went wrong. Try again.");
    }
    setPending(false);
  };

  const start = (form: FormData) =>
    run(async () => {
      const { ok, data } = await post("enable", { password: String(form.get("password") ?? "") });
      if (!ok) return setError("That password isn't right.");
      const uri = String(data.totpURI ?? "");
      setQr(await QRCode.toDataURL(uri, { margin: 1, width: 200 }));
      setSetupKey(new URL(uri).searchParams.get("secret"));
      setBackupCodes(Array.isArray(data.backupCodes) ? (data.backupCodes as string[]) : []);
      setStep("scan");
    });

  const confirm = (form: FormData) =>
    run(async () => {
      const { ok } = await post("verify-totp", { code: String(form.get("code") ?? "").replace(/\s+/g, "") });
      if (!ok) return setError("That code isn't right. Codes change every 30 seconds.");
      setEnabled(true);
      setStep("codes");
    });

  const turnOff = (form: FormData) =>
    run(async () => {
      const { ok } = await post("disable", { password: String(form.get("password") ?? "") });
      if (!ok) return setError("That password isn't right.");
      setEnabled(false);
      setStep("idle");
    });

  const submit = (handler: (form: FormData) => Promise<void>) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handler(new FormData(event.currentTarget));
  };

  return (
    <section className="dc-card space-y-3 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ink)]">Two-step sign-in</h2>
          <p className="text-[0.8125rem] text-[var(--ink-muted)]">
            {enabled ? "On. Signing in asks for a code from your authenticator app." : "A code from your phone, after your password."}
          </p>
        </div>
        {step === "idle" ? (
          <button type="button" className={enabled ? quiet : primary} onClick={() => { setError(null); setStep(enabled ? "turnOff" : "password"); }}>
            {enabled ? "Turn off" : "Turn on"}
          </button>
        ) : null}
      </div>

      {step === "password" ? (
        <form onSubmit={submit(start)} className="flex flex-wrap items-end gap-2">
          <label className="min-w-[14rem] flex-1 space-y-1">
            <span className="text-[0.75rem] text-[var(--ink-muted)]">Your password</span>
            <input type="password" name="password" required autoComplete="current-password" className={field} />
          </label>
          <button type="submit" disabled={pending} className={primary}>{pending ? "Checking…" : "Continue"}</button>
          <button type="button" className={quiet} onClick={() => setStep("idle")}>Cancel</button>
        </form>
      ) : null}

      {step === "scan" ? (
        <div className="space-y-3">
          <p className="text-[0.8125rem] text-[var(--ink-muted)]">Scan this with Google Authenticator, Authy or a similar app, then enter the code it shows.</p>
          <div className="flex flex-wrap items-start gap-4">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- a data URL generated in the browser
              <img src={qr} alt="QR code for your authenticator app" width={160} height={160} className="rounded-lg bg-white p-1.5" />
            ) : null}
            <div className="min-w-[14rem] flex-1 space-y-2">
              {setupKey ? (
                <p className="text-[0.75rem] text-[var(--ink-muted)]">
                  Can&apos;t scan? Enter this key by hand:
                  <span className="mt-1 block break-all rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1 font-mono text-[0.75rem] text-[var(--ink)]">{setupKey}</span>
                </p>
              ) : null}
              <form onSubmit={submit(confirm)} className="flex flex-wrap items-end gap-2">
                <label className="flex-1 space-y-1">
                  <span className="text-[0.75rem] text-[var(--ink-muted)]">Six-digit code</span>
                  <input name="code" required inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className={field} />
                </label>
                <button type="submit" disabled={pending} className={primary}>{pending ? "Checking…" : "Confirm"}</button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {step === "codes" ? (
        <div className="space-y-2 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-3">
          <p className="text-[0.8125rem] font-semibold text-[var(--ink)]">Two-step sign-in is on. Save these backup codes.</p>
          <p className="text-[0.75rem] text-[var(--ink-muted)]">Each works once if you lose your phone. They won&apos;t be shown again.</p>
          <ul className="grid grid-cols-2 gap-1 font-mono text-[0.8125rem] text-[var(--ink)] sm:grid-cols-5">
            {backupCodes.map((code) => <li key={code}>{code}</li>)}
          </ul>
          <button type="button" className={quiet} onClick={() => { setBackupCodes([]); setQr(null); setSetupKey(null); setStep("idle"); }}>
            I&apos;ve saved them
          </button>
        </div>
      ) : null}

      {step === "turnOff" ? (
        <form onSubmit={submit(turnOff)} className="flex flex-wrap items-end gap-2">
          <label className="min-w-[14rem] flex-1 space-y-1">
            <span className="text-[0.75rem] text-[var(--ink-muted)]">Your password</span>
            <input type="password" name="password" required autoComplete="current-password" className={field} />
          </label>
          <button type="submit" disabled={pending} className={quiet}>{pending ? "Checking…" : "Turn off"}</button>
          <button type="button" className={quiet} onClick={() => setStep("idle")}>Cancel</button>
        </form>
      ) : null}

      {error ? <p role="alert" className="text-[0.8125rem] text-red-500">{error}</p> : null}
    </section>
  );
}
