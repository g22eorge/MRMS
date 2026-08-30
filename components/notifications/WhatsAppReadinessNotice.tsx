import Link from "next/link";

import { getWhatsAppReadiness } from "@/lib/notifications/whatsapp-readiness";

/**
 * Says that WhatsApp will not send, at the point where someone is about to
 * rely on it. Renders nothing at all once configured, so it costs a configured
 * business no screen space and never becomes noise to scroll past.
 */
export async function WhatsAppReadinessNotice({
  orgId,
  compact = false,
}: {
  orgId: string | undefined;
  /** For inline placements — the tab beside a message list, not a settings page. */
  compact?: boolean;
}) {
  const readiness = await getWhatsAppReadiness(orgId);
  if (readiness.ready) return null;

  return (
    <div
      role="status"
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[0.8125rem]"
    >
      <p className="font-semibold text-amber-500">{readiness.headline}</p>
      {!compact && <p className="mt-1 text-[var(--ink-muted)]">{readiness.detail}</p>}
      {readiness.settingsHref && (
        <Link
          href={readiness.settingsHref}
          className="mt-2 inline-block font-semibold text-[var(--accent)] underline underline-offset-2"
        >
          Set up WhatsApp
        </Link>
      )}
    </div>
  );
}
