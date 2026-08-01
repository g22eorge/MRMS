"use client";

import { useEffect, useState } from "react";

type Announcement = { id: string; title: string; body: string; level: string };

const KEY = "dismissed-announcements";

const STYLES: Record<string, string> = {
  INFO: "border-sky-400/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  WARNING: "border-amber-400/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  CRITICAL: "border-red-400/40 bg-red-500/10 text-red-700 dark:text-red-300",
};

export function AnnouncementBanner({ announcements }: { announcements: Announcement[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  if (!ready) return null;
  const visible = announcements.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-2">
      {visible.map((a) => (
        <div
          key={a.id}
          className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-2.5 text-[13px] ${STYLES[a.level] ?? STYLES.INFO}`}
        >
          <div>
            <span className="font-bold">{a.title}</span> <span className="opacity-90">{a.body}</span>
          </div>
          <button
            type="button"
            onClick={() => dismiss(a.id)}
            aria-label="Dismiss announcement"
            className="shrink-0 rounded p-0.5 leading-none opacity-70 transition hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
