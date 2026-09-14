/**
 * WhatsApp renewal / send-health assessment for an org.
 *
 * The system has no subscription monitor: Meta never exposes "this WhatsApp
 * account needs renewing" as a field. What it does expose is send failures —
 * each one lands in the outbox with a Meta error code and message. This module
 * turns that trail into a plain verdict for the settings screen so an admin can
 * tell, in the system, that the WhatsApp connection needs attention (payment,
 * verification, token) rather than discovering it weeks later from a client.
 */
import { prisma } from "@/lib/prisma";
import {
  whatsappConfigSummaryForOrg,
  whatsappHealthCheckForOrg,
} from "@/lib/notifications/whatsapp";

export type WhatsAppRenewalStatus = "ok" | "attention" | "broken";

export type WhatsAppRenewalAssessment = {
  status: WhatsAppRenewalStatus;
  /** Present only when there is something to say. */
  headline: string | null;
  detail: string | null;
  /** Meta error codes (without the `API_ERROR_` prefix) seen on recent failures. */
  metaCodes: string[];
  /** The most recent failure's raw error text, for the admin to read. */
  sampleError: string | null;
  latestFailureAt: Date | null;
  /** WhatsApp outbox rows in FAILED or DEAD in the lookback window. */
  failures: number;
};

/** How far back to scan the outbox for send failures. */
const LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Meta codes that are per-message problems, not account-renewal signals. A
 * recipient who is not on WhatsApp (133010), an unapproved template (132000) or a
 * 24-hour window boundary (131030/131026/131042) should never trigger a "renew
 * your account" banner.
 */
const NON_RENEWAL_CODES = new Set(["133010", "132000", "131030", "131026", "131042"]);

function renewalHint(
  metaCodes: string[],
  sampleError: string | null,
): { headline: string; detail: string } | null {
  const text = (sampleError ?? "").toLowerCase();
  const mentionsPayment = /\b(payment|top[\s-]?up|funds|billing|invoice|subscription|renewal)\b/.test(text);
  const mentionsVerification = /\b(verif|display name|re[- ]?verification)\b/.test(text);
  const mentionsToken = /\b(token|oauth|expired)\b/.test(text);

  const has = (...codes: string[]) => codes.some((c) => metaCodes.includes(c));

  if (has("190") || mentionsToken) {
    return {
      headline: "WhatsApp access token has expired or been revoked",
      detail:
        "Meta is rejecting sends because the API token is no longer valid. Regenerate the system-user access token in Meta Business Manager and save it in the form below.",
    };
  }
  if (has("131055", "131057", "132571") || mentionsPayment) {
    return {
      headline: "Meta is blocking sends — payment or top-up needs renewing",
      detail:
        "WhatsApp Cloud API is conversation-based pricing: Meta stops sending when it cannot charge the payment method on file. Add or renew the payment method in Meta Business Manager (Business settings → WhatsApp Account → Payment settings).",
    };
  }
  if (has("131047") || mentionsVerification) {
    return {
      headline: "WhatsApp Business Account verification needs attention",
      detail:
        "Meta normally blocks sending until the business (or display name) verification is completed or renewed. Finish the outstanding verification steps in Meta Business Manager.",
    };
  }
  if (has("131056", "131058", "131072")) {
    return {
      headline: "WhatsApp Business Account is in a state that blocks sending",
      detail:
        "Open Meta Business Manager → WhatsApp Account and check the WhatsApp Business Account status (migration, suspended or re-verification). Resolve whatever alert is shown there, then retry from the outbox.",
    };
  }
  if (metaCodes.length > 0) {
    return {
      headline: `Meta is rejecting WhatsApp sends${
        metaCodes.length > 0 ? ` (code${metaCodes.length > 1 ? "s" : ""} ${metaCodes.join(", ")})` : ""
      }`,
      detail:
        "The recent failure below was returned by the WhatsApp Cloud API. Open Meta Business Manager and check your WhatsApp Account's payment method, verification status and subscription before retrying from the outbox.",
    };
  }
  return null;
}

export async function assessWhatsAppRenewal(orgId: string): Promise<WhatsAppRenewalAssessment> {
  const summary = await whatsappConfigSummaryForOrg(orgId).catch(() => ({ configured: false }));

  if (!summary.configured) {
    return {
      status: "attention",
      headline: "WhatsApp is not set up — messages are queuing but nothing is being sent",
      detail:
        "Add your Meta WhatsApp Business API credentials in the form below. Until then every WhatsApp message is written to the outbox and marked failed rather than delivered.",
      metaCodes: [],
      sampleError: null,
      latestFailureAt: null,
      failures: 0,
    };
  }

  const health = await whatsappHealthCheckForOrg(orgId).catch(() => null);

  const since = new Date(Date.now() - LOOKBACK_MS);
  const recent = await prisma.outboundMessage
    .findMany({
      where: { orgId, channel: "WHATSAPP", createdAt: { gte: since } },
      select: { status: true, lastErrorCode: true, lastError: true, lastAttemptAt: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    })
    .catch(() => []);

  const failed = recent.filter((r) => r.status === "FAILED" || r.status === "DEAD");
  const latestFailureAt = failed[0]?.lastAttemptAt ?? null;
  const sampleError = failed.find((r) => r.lastError)?.lastError ?? null;
  const metaCodes = [
    ...new Set(
      failed
        .map((r) => (r.lastErrorCode ?? "").replace(/^API_ERROR_/, ""))
        .filter((c) => /^\d+$/.test(c) && !NON_RENEWAL_CODES.has(c)),
    ),
  ];

  if (health && !health.ok) {
    return {
      status: "broken",
      headline: "WhatsApp connection check failed",
      detail: health.error ?? null,
      metaCodes,
      sampleError,
      latestFailureAt,
      failures: failed.length,
    };
  }

  const hint = renewalHint(metaCodes, sampleError);
  if (hint) {
    return { status: "broken", ...hint, metaCodes, sampleError, latestFailureAt, failures: failed.length };
  }

  if (failed.length > 0) {
    return {
      status: "attention",
      headline: `${failed.length} WhatsApp message${failed.length === 1 ? "" : "s"} failed to send in the last 14 days`,
      detail:
        "Messages are reaching the outbox but landing as failed, so they are not being delivered. The most recent error is shown below; open the outbox for the full list.",
      metaCodes,
      sampleError,
      latestFailureAt,
      failures: failed.length,
    };
  }

  return {
    status: "ok",
    headline: null,
    detail: null,
    metaCodes: [],
    sampleError: null,
    latestFailureAt: null,
    failures: 0,
  };
}