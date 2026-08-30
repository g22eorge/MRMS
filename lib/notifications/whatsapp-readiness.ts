import { whatsappConfigSummaryForOrg } from "@/lib/notifications/whatsapp";

/**
 * Whether this organisation can actually send a WhatsApp message.
 *
 * The configuration already resolves per org, and several places already ask
 * whether it exists. What none of them did was say so *where a send happens* —
 * so an unconfigured business could set up reminders, press send on a document,
 * and watch a job move through its statuses while nothing ever reached a
 * client. Every failure was recorded in the outbox, and nobody had a reason to
 * open the outbox, because the screens that queued the messages looked fine.
 *
 * That is the same shape as the payment defects found in this system: the
 * failure is silent, the interface reads as success, and the discovery comes
 * weeks later from the customer. A messaging feature that quietly sends nothing
 * is worse than one that is plainly absent, because the business has stopped
 * chasing its clients by other means.
 *
 * WhatsApp is deliberately not treated as required. Email works from the first
 * minute, so the honest message is "this one channel is not set up yet", never
 * "notifications are broken".
 */

export type WhatsAppReadiness = {
  ready: boolean;
  /** Present only when not ready — short enough to sit in a notice. */
  headline: string | null;
  detail: string | null;
  /** Where the person can go and fix it. Null when they cannot. */
  settingsHref: string | null;
};

const SETTINGS_HREF = "/settings/notifications/whatsapp";

export async function getWhatsAppReadiness(orgId: string | undefined): Promise<WhatsAppReadiness> {
  // A failure to resolve configuration is not evidence of configuration.
  const summary = await whatsappConfigSummaryForOrg(orgId).catch(() => ({ configured: false }) as const);

  if (summary.configured) {
    return { ready: true, headline: null, detail: null, settingsHref: null };
  }

  return {
    ready: false,
    headline: "WhatsApp is not set up yet — these messages will not send",
    detail:
      "WhatsApp needs your own Meta Business number, and Meta has to approve your message templates, " +
      "which usually takes a few days. Email works now and needs nothing. Until WhatsApp is connected, " +
      "anything queued for it is written to the outbox and marked failed rather than delivered.",
    settingsHref: SETTINGS_HREF,
  };
}
