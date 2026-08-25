"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Turns a redirect into a visible result.
 *
 * Server actions finish by redirecting, which repaints the page with the new
 * data and says nothing. To the person at the counter a successful save and a
 * silently dropped one look identical, so they tap the button again -- which is
 * how duplicate records get created in the first place. The silence is not just
 * a missing nicety; it is the cause.
 *
 * So an action redirects with ?saved=... or ?failed=..., this reads it, raises
 * a toast, and strips the parameter back out of the URL so a refresh or a
 * shared link does not replay the message.
 */
function FlashToastInner() {
  const params = useSearchParams();
  const router = useRouter();
  // Strict mode mounts effects twice in development; without this the toast
  // fires twice for one save, which is exactly the confusion we are fixing.
  const shown = useRef<string | null>(null);

  const saved = params.get("saved");
  const failed = params.get("failed");

  useEffect(() => {
    const key = saved ? `s:${saved}` : failed ? `f:${failed}` : null;
    if (!key || shown.current === key) return;
    shown.current = key;

    if (saved) toast.success(saved);
    else if (failed) toast.error(failed, { duration: 8000 });

    const next = new URLSearchParams(params.toString());
    next.delete("saved");
    next.delete("failed");
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [saved, failed, params, router]);

  return null;
}

export function FlashToast() {
  // useSearchParams needs a Suspense boundary to avoid opting whole routes
  // into client-side rendering.
  return (
    <Suspense fallback={null}>
      <FlashToastInner />
    </Suspense>
  );
}
