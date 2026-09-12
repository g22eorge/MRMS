"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Keeps a chosen page size across visits to the same list.
 *
 * The size already survives a refresh, because it lives in the URL. What it did
 * not survive was coming back: every sidebar and menu link is a plain /clients
 * with no query, so choosing 50, going to the dashboard and returning put the
 * reader back on 20 — and did it silently, which is why it reads as the setting
 * not working rather than as the link not carrying it.
 *
 * There is no click handler here. Choosing a size navigates to a URL that
 * carries it, so simply recording what is in the URL captures the choice, and
 * arriving without one is the case worth restoring. That only works because
 * sizeHrefBuilder now always emits the parameter, including for the default —
 * otherwise choosing 20 would look identical to expressing no preference, and
 * the reader could never get back down.
 *
 * Per pathname, so a wide inventory list does not force the same width on jobs.
 * Storage is best-effort: a private window or blocked site data simply means
 * the size stops being remembered, which is where this started.
 */

const KEY = "duuka:page-size:";

export function RememberPageSize({ pageSize }: { pageSize: number }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const explicit = params.get("size");

  useEffect(() => {
    if (!pathname) return;

    if (explicit) {
      try {
        window.localStorage.setItem(KEY + pathname, explicit);
      } catch {
        // Storage unavailable; the size still works for this visit.
      }
      return;
    }

    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(KEY + pathname);
    } catch {
      return;
    }
    if (!saved || Number(saved) === pageSize) return;

    // replace, not push: restoring a preference must not put a step in the
    // history that the back button has to walk through twice.
    const next = new URLSearchParams(params.toString());
    next.set("size", saved);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [pathname, explicit, params, pageSize, router]);

  return null;
}
