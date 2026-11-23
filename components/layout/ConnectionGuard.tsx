"use client";

import { useEffect, useState } from "react";

/**
 * Says so when the connection drops, and holds back anything that would be
 * lost by sending it into the void.
 *
 * The till saves each line to the server as it is added, so a sale in progress
 * is already safe when a shop's connection drops. What was not safe was the
 * next tap: a form sent with no connection ended in the browser's own error
 * page, which reads as "the system crashed" and loses whatever was typed in
 * that form. While offline this stops the send and leaves the screen as it is;
 * the banner clears itself when the connection returns.
 *
 * It also registers the service worker whose only job is an honest
 * "No connection" page on reload (public/sw.js).
 */
export function ConnectionGuard() {
  const [offline, setOffline] = useState(false);
  const [nudged, setNudged] = useState(false);

  useEffect(() => {
    const sync = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine) setNudged(false);
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    // Capture on the window, ahead of React's own listener, so a form is
    // stopped before any server action starts.
    const holdSubmit = (event: Event) => {
      if (navigator.onLine) return;
      const form = event.target as HTMLFormElement | null;
      if (form?.method?.toLowerCase() === "get") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setNudged(true);
    };
    window.addEventListener("submit", holdSubmit, true);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("submit", holdSubmit, true);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-[0.8125rem] font-semibold text-black shadow-lg"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-black/70" aria-hidden />
      {nudged ? "Not sent. Still no connection — try again when it is back." : "No connection. What you have saved is safe."}
    </div>
  );
}
