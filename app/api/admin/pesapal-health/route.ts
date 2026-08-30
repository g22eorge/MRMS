import { NextResponse } from "next/server";

import { assertPlatformAdmin } from "@/lib/platform-admin";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import {
  getPlatformSetting, getPesapalConsumerKey, getPesapalConsumerSecret, probePlatformSettingStore,
} from "@/lib/platform-settings";
import { PESAPAL_BASE, getAuthToken, getRegisteredIpns, getStoredIpnId, ipnSettingKey, IS_LIVE } from "@/lib/pesapal";

export const dynamic = "force-dynamic";

/**
 * Can this deployment take a payment at all?
 *
 * Everything else about billing has been checked downstream of the money
 * arriving: the price table, the webhook's verification, what it records when
 * it refuses. All of that assumes a notification reaches us, which assumes an
 * order reached Pesapal in the first place. This checks that chain instead —
 * which provider, whose credentials, and where Pesapal has been told to send
 * the answer.
 *
 * Four things have to hold, and each fails silently on its own:
 *
 *   1. PESAPAL_ENV=production, or the base URL is the sandbox and no real money
 *      can move regardless of how correct everything downstream is.
 *   2. Credentials resolve, from platform settings or environment.
 *   3. Those credentials are accepted by that base URL. Live keys against the
 *      sandbox host are rejected, and vice versa.
 *   4. The stored IPN id is registered, Active, and points at THIS deployment's
 *      webhook. Nothing re-checks it after the first registration, so an id
 *      registered from a laptop points at localhost forever.
 *
 * Read-only. RequestToken is an auth handshake and GetIpnList is a read;
 * nothing here registers an IPN or submits an order. Deliberately does not call
 * getOrCreateIpnId, which would register one as a side effect of asking.
 *
 * No secret is returned — only whether one resolved, and from where.
 */

type Verdict =
  | "READY"
  | "SANDBOX — CANNOT TAKE REAL MONEY"
  | "NO CREDENTIALS — CHECKOUT WILL FAIL"
  | "CREDENTIALS REJECTED"
  | "NOTIFICATIONS NOT REGISTERED"
  | "NOTIFICATIONS GO SOMEWHERE ELSE";

const WEBHOOK_PATH = "/api/webhooks/pesapal";

/**
 * Pesapal reports IPN state as a numeric code, not a word.
 *
 * GetIpnList returns status "1" for a live IPN — "Active" is the separate
 * description field. Comparing against the word produced a false blocker on a
 * correctly registered IPN, with the nonsensical message "the registered IPN is
 * 1, not Active", on a deployment where everything else had just been made
 * right. Both forms are accepted because the provider has used both across its
 * API surface, and anything else is treated as not active rather than assumed
 * fine.
 */
/**
 * IPNs in this account that can never receive a notification.
 *
 * The account is shared across several products and has accumulated
 * registrations pointing at developer machines. Pesapal calls them faithfully
 * and nothing answers, so any payment relying on one is silently never
 * confirmed — the same failure the localhost guard in ipnCallbackUrl() now
 * prevents this codebase from creating.
 *
 * Reported rather than removed: Pesapal's v3 API offers RegisterIPN and
 * GetIpnList and no delete of any kind, so an IPN can be created from here but
 * never retired from here. Clearing them is dashboard work; this exists so the
 * result can be checked afterwards.
 */
function ipnProblem(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "unparseable-url";
  }
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost")) {
    return "points-at-a-developer-machine";
  }
  // A doubled final label (…com.com) is a typo, not a domain.
  const labels = host.split(".");
  if (labels.length > 2 && labels[labels.length - 1] === labels[labels.length - 2]) {
    return "doubled-tld-probably-a-typo";
  }
  return null;
}

function isActiveIpn(status: unknown): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "1" || s === "active";
}

export async function GET(req: Request) {
  const admin = await assertPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rl = await rateLimit.platformAdmin(admin.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many admin operations. Wait a moment and retry." },
      { status: 429, headers: rateLimitHeaders(rl.retryAfterMs) },
    );
  }

  const blockers: string[] = [];

  // ── 1. Which Pesapal ────────────────────────────────────────────────────────
  const live = IS_LIVE;
  if (!live) {
    blockers.push(
      "PESAPAL_ENV is not \"production\", so orders go to Pesapal's sandbox. Sandbox transactions move no real money and do not appear in the live merchant dashboard.",
    );
  }

  // ── 2. Credentials, and from where ──────────────────────────────────────────
  // Asked first, because getPlatformSetting returns null both when a value is
  // absent and when the table cannot be read. Without this, "no credentials
  // configured" and "the settings store is broken" are the same answer, and
  // they call for completely different actions.
  const store = await probePlatformSettingStore();

  const [dbKey, dbSecret, key, secret] = await Promise.all([
    getPlatformSetting("PESAPAL_CONSUMER_KEY").catch(() => null),
    getPlatformSetting("PESAPAL_CONSUMER_SECRET").catch(() => null),
    getPesapalConsumerKey().catch(() => null),
    getPesapalConsumerSecret().catch(() => null),
  ]);
  const haveCredentials = Boolean(key && secret);
  const credentialSource = dbKey && dbSecret ? "platform settings" : haveCredentials ? "environment" : "none";
  if (!haveCredentials) {
    blockers.push(
      store.readable
        ? "No Pesapal consumer key/secret resolves, and the settings store reads fine — so they were never configured. Submitting an order throws before Pesapal is contacted, and the customer never reaches a payment page."
        : `No Pesapal consumer key/secret resolves, but the settings store could not be read (${store.error}). The credentials may exist and be unreachable — fix the store before concluding anything about them.`,
    );
  }

  // ── 3. Are they accepted by that host ───────────────────────────────────────
  let authOk = false;
  let authError: string | null = null;
  if (haveCredentials) {
    try {
      await getAuthToken();
      authOk = true;
    } catch (err) {
      authError = err instanceof Error ? err.message.slice(0, 200) : "Pesapal did not answer";
      blockers.push(`Pesapal rejected these credentials against ${PESAPAL_BASE}: ${authError}`);
    }
  }

  // ── 4. Where Pesapal sends the notification ─────────────────────────────────
  const configuredBase = process.env.NEXT_PUBLIC_APP_URL ?? null;
  const requestOrigin = new URL(req.url).origin;
  const expectedWebhookUrl = `${configuredBase ?? requestOrigin}${WEBHOOK_PATH}`;

  // NEXT_PUBLIC_APP_URL is not only the IPN address — it builds the
  // post-payment redirect, every password-reset and invite link, document share
  // links and notification deep links. When it names a different host than the
  // one being served, a customer who pays is redirected across origins, does
  // not carry their session cookie there, and lands on a login page instead of
  // the confirmation. Notifications still arrive, so this warns rather than
  // blocks — but it is the difference between a payment that worked and a
  // payment the customer believes failed.
  const configuredHost = configuredBase ? new URL(configuredBase).host : null;
  const servedHost = new URL(requestOrigin).host;
  const baseMismatch = Boolean(configuredHost && configuredHost !== servedHost);

  // Scoped to this environment: a sandbox id is not evidence of a live one.
  const storedIpnId = await getStoredIpnId().catch(() => null);
  let registered: Array<{ ipn_id: string; url: string; status: string }> | null = null;
  let ipnLookupError: string | null = null;
  if (authOk) {
    try {
      registered = await getRegisteredIpns();
    } catch (err) {
      ipnLookupError = err instanceof Error ? err.message.slice(0, 200) : "GetIpnList did not answer";
    }
  }

  const match = storedIpnId && registered ? registered.find((i) => i.ipn_id === storedIpnId) ?? null : null;
  const pointsHere = match ? match.url === expectedWebhookUrl : null;

  if (!storedIpnId) {
    blockers.push("No PESAPAL_IPN_ID is stored, so nothing tells Pesapal where to send the payment notification.");
  } else if (registered && !match) {
    blockers.push(`The stored IPN id ${storedIpnId} is not in this account's registered list. It belongs to a different Pesapal account or environment.`);
  } else if (match && !isActiveIpn(match.status)) {
    blockers.push(`The registered IPN's status is "${match.status}", which is not active. Pesapal reports 1 (or "Active") for a live IPN.`);
  } else if (match && !pointsHere) {
    blockers.push(`Pesapal sends notifications to ${match.url}, which is not this deployment's webhook (${expectedWebhookUrl}). Every notification is delivered somewhere that cannot act on it.`);
  }

  // Ordered by what has to be true first: a sandbox base makes the rest moot.
  let verdict: Verdict;
  if (!live) verdict = "SANDBOX — CANNOT TAKE REAL MONEY";
  else if (!haveCredentials) verdict = "NO CREDENTIALS — CHECKOUT WILL FAIL";
  else if (!authOk) verdict = "CREDENTIALS REJECTED";
  else if (!storedIpnId || (registered && !match)) verdict = "NOTIFICATIONS NOT REGISTERED";
  else if (match && (!isActiveIpn(match.status) || !pointsHere)) verdict = "NOTIFICATIONS GO SOMEWHERE ELSE";
  else verdict = "READY";

  return NextResponse.json({
    readOnly: true,
    verdict,
    canTakeRealMoney: verdict === "READY",
    blockers,
    provider: {
      mode: live ? "LIVE" : "SANDBOX",
      baseUrl: PESAPAL_BASE,
      switchedBy: 'PESAPAL_ENV — anything other than "production" is the sandbox',
    },
    settingsStore: {
      readable: store.readable,
      error: store.error,
      keyCount: store.keys.length,
      // Names only. These answer the question; the values are secrets.
      keys: store.keys,
      hasPesapalConsumerKey: store.keys.includes("PESAPAL_CONSUMER_KEY"),
      hasPesapalConsumerSecret: store.keys.includes("PESAPAL_CONSUMER_SECRET"),
    },
    credentials: {
      resolved: haveCredentials,
      source: credentialSource,
      /** Distinguishes "never configured" from "configured but unreadable". */
      absenceIsTrustworthy: store.readable,
      acceptedByProvider: haveCredentials ? authOk : null,
      error: authError,
    },
    notifications: {
      storedIpnId: storedIpnId ?? null,
      storedUnder: ipnSettingKey(),
      expectedWebhookUrl,
      registeredTo: match?.url ?? null,
      status: match?.status ?? null,
      statusIsActive: match ? isActiveIpn(match.status) : null,
      pointsAtThisDeployment: pointsHere,
      allRegistered: registered?.map((i) => ({ id: i.ipn_id, url: i.url, status: i.status })) ?? null,
      // Hygiene, not a blocker: these belong to other integrations on a shared
      // account and cannot break this one. Listed so they can be cleared by
      // hand and the result verified by re-running this.
      undeliverableRegistrations: registered
        ? registered
            .map((i) => ({ id: i.ipn_id, url: i.url, problem: ipnProblem(i.url) }))
            .filter((i) => i.problem !== null)
        : null,
      cleanupNote:
        "Pesapal v3 has no delete-IPN endpoint — RegisterIPN and GetIpnList only — so these can be removed " +
        "only from the Pesapal dashboard, not from here. Re-run this check afterwards to confirm.",
      lookupError: ipnLookupError,
      note: "Not checked when credentials fail, because the list cannot be fetched without a token.",
    },
    deployment: {
      configuredBase,
      requestOrigin,
      baseMatchesServedHost: !baseMismatch,
      warning: baseMismatch
        ? `NEXT_PUBLIC_APP_URL is ${configuredBase}, but this was served from ${requestOrigin}. ` +
          "A customer who completes payment is redirected to the other host, does not carry their " +
          "session cookie across origins, and lands on the login page instead of the confirmation. " +
          "The same value builds password-reset, invite, document-share and notification links. " +
          "Set it to the host customers actually use, and register the IPN only after that."
        : null,
    },
  });
}
