"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

/**
 * IdleLogout — signs the user out after a period of inactivity so an unattended
 * machine doesn't stay logged in. Activity (mouse/keyboard/touch/scroll) resets
 * the timer; the last-activity timestamp lives in localStorage so every open tab
 * agrees and a single active tab keeps them all alive. A short countdown warning
 * appears before logout so no unsaved work is lost by surprise.
 *
 * Mounted once in the authenticated app layout.
 */
const DEFAULT_IDLE_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const DEFAULT_WARN_MS = 60 * 1000; // warn 60s before signing out
const STORAGE_KEY = "duuka:lastActivity";

export function IdleLogout({
  idleMs = DEFAULT_IDLE_MS,
  warnMs = DEFAULT_WARN_MS,
}: {
  idleMs?: number;
  warnMs?: number;
}) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const signingOut = useRef(false);
  const lastWrite = useRef(0);

  useEffect(() => {
    function markActive() {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        /* private mode / disabled storage — timer still runs off in-memory writes */
      }
      // Clear any visible warning without re-subscribing the effect.
      setSecondsLeft((prev) => (prev === null ? prev : null));
    }

    // Seed once so a fresh mount doesn't immediately look "idle".
    markActive();

    function onActivity() {
      const now = Date.now();
      if (now - lastWrite.current < 1000) return; // throttle writes to ~1/s
      lastWrite.current = now;
      markActive();
    }

    // NOTE: visibilitychange is intentionally excluded — returning to a tab
    // after being away should NOT count as activity, so a walk-away still logs out.
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const interval = window.setInterval(() => {
      let last = 0;
      try {
        last = Number(localStorage.getItem(STORAGE_KEY) || "0");
      } catch {
        /* ignore */
      }
      const idle = Date.now() - last;

      if (idle >= idleMs) {
        if (signingOut.current) return;
        signingOut.current = true;
        window.clearInterval(interval);
        void authClient
          .signOut()
          .catch(() => {})
          .finally(() => router.replace("/login?reason=idle"));
      } else if (idle >= idleMs - warnMs) {
        setSecondsLeft(Math.max(1, Math.ceil((idleMs - idle) / 1000)));
      } else {
        setSecondsLeft((prev) => (prev === null ? prev : null));
      }
    }, 1000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(interval);
    };
  }, [idleMs, warnMs, router]);

  function staySignedIn() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    lastWrite.current = Date.now();
    setSecondsLeft(null);
  }

  if (secondsLeft === null) return null;

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/50 p-4" role="alertdialog" aria-modal="true" aria-label="Inactivity warning">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 text-center shadow-2xl">
        <p className="text-[15px] font-bold text-[var(--ink)]">Still there?</p>
        <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
          You&apos;ll be signed out in <span className="font-bold text-[var(--ink)] tabular-nums">{secondsLeft}s</span> due to inactivity.
        </p>
        <button
          type="button"
          onClick={staySignedIn}
          className="btn-premium mt-4 w-full rounded-lg px-4 py-2 text-sm font-semibold"
        >
          Stay signed in
        </button>
      </div>
    </div>
  );
}
