import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Whether this deployment can take a payment at all.
 *
 * Every other billing test asks what happens once money arrives. This asks the
 * question underneath: which Pesapal, whose credentials, and where the
 * notification is sent. Each of the four can fail on its own, none of them
 * announces itself, and all four have to hold before a single downstream test
 * means anything in production.
 *
 * The verdict order is the substance. A sandbox base makes the rest moot — the
 * IPN can be perfectly registered and no real money will ever move — so
 * reporting a downstream problem first would send someone to fix the wrong
 * thing.
 */

type Input = {
  live: boolean;
  haveCredentials: boolean;
  authOk: boolean;
  storedIpnId: string | null;
  registered: Array<{ ipn_id: string; url: string; status: string }> | null;
  expectedWebhookUrl: string;
};

/** Pesapal reports "1" for a live IPN; "Active" is the description field. */
function isActiveIpn(status: unknown) {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "1" || s === "active";
}

function verdictFor(i: Input) {
  const match = i.storedIpnId && i.registered ? i.registered.find((r) => r.ipn_id === i.storedIpnId) ?? null : null;
  const pointsHere = match ? match.url === i.expectedWebhookUrl : null;

  if (!i.live) return "SANDBOX — CANNOT TAKE REAL MONEY";
  if (!i.haveCredentials) return "NO CREDENTIALS — CHECKOUT WILL FAIL";
  if (!i.authOk) return "CREDENTIALS REJECTED";
  if (!i.storedIpnId || (i.registered && !match)) return "NOTIFICATIONS NOT REGISTERED";
  if (match && (!isActiveIpn(match.status) || !pointsHere)) return "NOTIFICATIONS GO SOMEWHERE ELSE";
  return "READY";
}

const HERE = "https://app.eagleinfosolutions.com/api/webhooks/pesapal";
const healthy: Input = {
  live: true,
  haveCredentials: true,
  authOk: true,
  storedIpnId: "ipn-1",
  registered: [{ ipn_id: "ipn-1", url: HERE, status: "Active" }],
  expectedWebhookUrl: HERE,
};

describe("the four things that all have to hold", () => {
  it("passes when they do", () => {
    expect(verdictFor(healthy)).toBe("READY");
  });

  it("catches the sandbox, which is what the live deployment was actually doing", () => {
    // PESAPAL_ENV was set in no environment, so the base URL was the sandbox on
    // production. Everything downstream can be flawless and no money moves.
    expect(verdictFor({ ...healthy, live: false })).toBe("SANDBOX — CANNOT TAKE REAL MONEY");
  });

  it("catches missing credentials", () => {
    expect(verdictFor({ ...healthy, haveCredentials: false })).toBe("NO CREDENTIALS — CHECKOUT WILL FAIL");
  });

  it("catches credentials the provider will not accept", () => {
    // Live keys against the sandbox host, or the reverse.
    expect(verdictFor({ ...healthy, authOk: false })).toBe("CREDENTIALS REJECTED");
  });

  it("catches nothing registered", () => {
    expect(verdictFor({ ...healthy, storedIpnId: null })).toBe("NOTIFICATIONS NOT REGISTERED");
  });

  it("catches an id belonging to another account or environment", () => {
    expect(verdictFor({ ...healthy, storedIpnId: "ipn-from-sandbox" })).toBe("NOTIFICATIONS NOT REGISTERED");
  });

  it("catches an IPN registered to somewhere else — the localhost case", () => {
    // The defect that would outlive everyone: registered once from a laptop,
    // stored forever, notifications delivered to a machine that is not there.
    expect(verdictFor({
      ...healthy,
      registered: [{ ipn_id: "ipn-1", url: "http://localhost:3000/api/webhooks/pesapal", status: "Active" }],
    })).toBe("NOTIFICATIONS GO SOMEWHERE ELSE");
  });

  it("catches an IPN registered here but not Active", () => {
    expect(verdictFor({
      ...healthy,
      registered: [{ ipn_id: "ipn-1", url: HERE, status: "Disabled" }],
    })).toBe("NOTIFICATIONS GO SOMEWHERE ELSE");
  });
});

describe("it reports the blocker someone should fix first", () => {
  it("says sandbox even when the IPN is also wrong", () => {
    // Both are broken. Fixing the IPN first changes nothing observable, so the
    // sandbox has to be the reported verdict.
    expect(verdictFor({
      ...healthy,
      live: false,
      registered: [{ ipn_id: "ipn-1", url: "http://localhost:3000/api/webhooks/pesapal", status: "Active" }],
    })).toBe("SANDBOX — CANNOT TAKE REAL MONEY");
  });
});

describe("registering an IPN refuses to pin production to localhost", () => {
  const SRC = readFileSync("lib/pesapal.ts", "utf8");

  it("guards the URL rather than defaulting quietly", () => {
    expect(SRC).toContain("export function ipnCallbackUrl()");
    expect(SRC).toContain("Refusing to register a localhost IPN URL in production");
  });

  it("is the single path both registration sites use", async () => {
    // The admin action had its own copy of the localhost default, so the guard
    // would have covered one of the two ways to register.
    const actions = readFileSync("app/(platform)/platform/settings/actions.ts", "utf8");
    expect(actions).toContain("ipnCallbackUrl()");
    expect(actions).not.toContain('"http://localhost:3000"');
    expect(SRC).toContain("registerIpn(ipnCallbackUrl())");
  });
});

describe("the check itself changes nothing", () => {
  const SRC = readFileSync("app/api/admin/pesapal-health/route.ts", "utf8");

  it("never registers an IPN as a side effect of asking about one", () => {
    // getOrCreateIpnId registers when nothing is stored, which would make the
    // diagnostic create the very thing it is meant to report as missing.
    // Matched as calls, not mentions — the route's comment names it precisely
    // to say it is not called.
    for (const call of ["getOrCreateIpnId(", "registerIpn(", "submitOrder(", "setPlatformSetting("]) {
      expect(SRC).not.toContain(call);
    }
    expect(SRC).toContain("getOrCreateIpnId, which would register one");
  });

  it("returns no secret, only whether one resolved and from where", () => {
    expect(SRC).toContain("resolved: haveCredentials");
    expect(SRC).not.toMatch(/key,\s*$|consumerKey:|secret:\s*(key|secret|dbSecret)/m);
  });

  it("is platform-admin only and rate limited", () => {
    expect(SRC).toContain("assertPlatformAdmin()");
    expect(SRC).toContain("rateLimit.platformAdmin");
  });
});

describe("the IPN id is scoped to the Pesapal account that issued it", () => {
  const SRC = readFileSync("lib/pesapal.ts", "utf8");

  /**
   * The trap in the go-live change. An IPN id belongs to the account that
   * registered it, and sandbox and live are different accounts. This deployment
   * has only ever run against the sandbox, so a single un-namespaced key could
   * only ever hold a sandbox id — which would then be handed to the live host
   * as notification_id the moment PESAPAL_ENV was set. Going live would silently
   * not work, in exactly the shape of the defect it was meant to end.
   */
  function keyFor(live: boolean) {
    return live ? "PESAPAL_IPN_ID_LIVE" : "PESAPAL_IPN_ID_SANDBOX";
  }
  function storedFor(live: boolean, settings: Record<string, string>) {
    const scoped = settings[keyFor(live)];
    if (scoped) return scoped;
    return live ? null : settings.PESAPAL_IPN_ID ?? null;
  }

  it("does not hand a sandbox id to the live account", () => {
    // The state this deployment is actually in today.
    const settings = { PESAPAL_IPN_ID: "sandbox-ipn-from-today" };
    expect(storedFor(false, settings)).toBe("sandbox-ipn-from-today");
    expect(storedFor(true, settings)).toBeNull();
  });

  it("so flipping the environment registers a fresh one instead of reusing it", () => {
    // null is what makes getOrCreateIpnId register against the live account.
    expect(storedFor(true, { PESAPAL_IPN_ID: "sandbox-ipn" })).toBeNull();
  });

  it("keeps each environment's id, so switching back does not re-register", () => {
    const settings = { PESAPAL_IPN_ID_SANDBOX: "s-1", PESAPAL_IPN_ID_LIVE: "l-1" };
    expect(storedFor(false, settings)).toBe("s-1");
    expect(storedFor(true, settings)).toBe("l-1");
  });

  it("reads the legacy key only in sandbox, which is the only place it is sound", () => {
    // Every value ever written under the old key was written while pointing at
    // the sandbox, so honouring it there is correct and honouring it live is not.
    expect(SRC).toContain('return IS_LIVE ? null : getPlatformSetting("PESAPAL_IPN_ID");');
  });

  it("is what every read and write goes through", () => {
    const page = readFileSync("app/(platform)/platform/settings/page.tsx", "utf8");
    const actions = readFileSync("app/(platform)/platform/settings/actions.ts", "utf8");
    const health = readFileSync("app/api/admin/pesapal-health/route.ts", "utf8");
    for (const src of [page, health]) {
      expect(src).not.toContain('"PESAPAL_IPN_ID"');
    }
    // The Clear action allow-lists keys server-side, so the scoped names have
    // to be on it or clearing silently fails with "Invalid key".
    expect(actions).toContain('"PESAPAL_IPN_ID_SANDBOX"');
    expect(actions).toContain('"PESAPAL_IPN_ID_LIVE"');
    expect(actions).toContain("setPlatformSetting(ipnSettingKey()");
    expect(health).toContain("getStoredIpnId()");
    expect(page).toContain("getStoredIpnId()");
  });
});

describe("it warns when the app URL is not the host customers use", () => {
  const SRC = readFileSync("app/api/admin/pesapal-health/route.ts", "utf8");

  /**
   * Found on the live commercial deployment: NEXT_PUBLIC_APP_URL was
   * https://mrms-apga.vercel.app while customers use
   * app.eagleinfosolutions.com. The callback redirects a paying customer to the
   * configured host, which is a different registrable domain, so the session
   * cookie is not sent and they land on /login instead of the confirmation.
   * They have paid, and every visible signal says they have not.
   */
  function mismatch(configured: string | null, served: string) {
    const configuredHost = configured ? new URL(configured).host : null;
    return Boolean(configuredHost && configuredHost !== new URL(served).host);
  }

  it("catches the vercel.app-versus-custom-domain case exactly as found", () => {
    expect(mismatch("https://mrms-apga.vercel.app", "https://app.eagleinfosolutions.com")).toBe(true);
  });

  it("is quiet when they agree", () => {
    expect(mismatch("https://app.eagleinfosolutions.com", "https://app.eagleinfosolutions.com")).toBe(false);
  });

  it("ignores a differing path or trailing slash, comparing hosts", () => {
    expect(mismatch("https://app.eagleinfosolutions.com/", "https://app.eagleinfosolutions.com")).toBe(false);
  });

  it("is quiet when nothing is configured, which other checks already cover", () => {
    expect(mismatch(null, "https://app.eagleinfosolutions.com")).toBe(false);
  });

  it("warns rather than blocks, because notifications still arrive", () => {
    // It must not be a blocker: the IPN would work. What breaks is the
    // customer's experience of a payment that in fact succeeded.
    expect(SRC).toContain("baseMatchesServedHost");
    expect(SRC).not.toContain("blockers.push(`NEXT_PUBLIC_APP_URL");
  });

  it("says what it costs, not just that it differs", () => {
    expect(SRC).toContain("lands on the login page instead of the confirmation");
  });
});

describe("it distinguishes 'never configured' from 'could not be read'", () => {
  const SRC = readFileSync("app/api/admin/pesapal-health/route.ts", "utf8");
  const STORE = readFileSync("lib/platform-settings.ts", "utf8");

  /**
   * getPlatformSetting catches every read error and returns null, so the check
   * reported "NO CREDENTIALS" for two states that call for opposite actions:
   * credentials that were never entered, and credentials that exist behind a
   * broken settings table. Telling someone to go and enter keys they already
   * have is the wrong answer, and there was no way to tell which it was.
   */
  it("asks the store directly rather than inferring from a null", () => {
    expect(SRC).toContain("probePlatformSettingStore()");
    expect(SRC).toContain("absenceIsTrustworthy: store.readable");
  });

  it("says something different for each case", () => {
    expect(SRC).toContain("they were never configured");
    expect(SRC).toContain("may exist and be unreachable");
  });

  it("reports key names, never values", () => {
    expect(STORE).toContain("SELECT key FROM");
    expect(STORE).not.toContain("SELECT key, value FROM");
    expect(SRC).toContain("hasPesapalConsumerKey");
    // The secret itself must never reach the response.
    expect(SRC).not.toContain("value: secret");
    expect(SRC).not.toContain("consumerSecret:");
  });

  it("stays a pure read — it does not create the table to answer whether it exists", () => {
    // ensureTable() runs CREATE TABLE IF NOT EXISTS. Calling it here would make
    // an unreadable store report as readable-and-empty.
    const probe = STORE.slice(STORE.indexOf("export async function probePlatformSettingStore"));
    const body = probe.slice(0, probe.indexOf("\n}\n"));
    expect(body).not.toContain("ensureTable");
  });

  it("treats an unreadable store as a reason to distrust the answer, not to pass", () => {
    // It must still block: unreadable is not evidence that checkout works.
    const idx = SRC.indexOf("if (!haveCredentials)");
    expect(SRC.slice(idx, idx + 700)).toContain("blockers.push");
  });
});

describe("Pesapal reports IPN state as a code, not a word", () => {
  const SRC = readFileSync("app/api/admin/pesapal-health/route.ts", "utf8");

  /**
   * Caught on the live deployment. Every IPN in the real account — including
   * Pesapal's own invoicing endpoint — comes back with status "1". Comparing
   * against the string "Active" blocked a correctly registered IPN and said
   * "the registered IPN is 1, not Active", which reads as gibberish precisely
   * when someone has just got everything else right.
   */
  it("accepts the numeric code the real API returns", () => {
    expect(verdictFor({
      ...healthy,
      registered: [{ ipn_id: "ipn-1", url: HERE, status: "1" }],
    })).toBe("READY");
  });

  it("still accepts the word, since the provider uses both", () => {
    expect(isActiveIpn("Active")).toBe(true);
    expect(isActiveIpn("active")).toBe(true);
    expect(isActiveIpn("1")).toBe(true);
  });

  it("does not wave through an unknown status", () => {
    // Failing open here would report a dead IPN as ready to take money.
    for (const bad of ["0", "2", "Disabled", "", null, undefined]) {
      expect(isActiveIpn(bad)).toBe(false);
    }
    expect(verdictFor({
      ...healthy,
      registered: [{ ipn_id: "ipn-1", url: HERE, status: "0" }],
    })).toBe("NOTIFICATIONS GO SOMEWHERE ELSE");
  });

  it("says what active looks like when it complains", () => {
    expect(SRC).toContain('Pesapal reports 1 (or "Active") for a live IPN');
  });
});

describe("it names the registrations that can never receive a notification", () => {
  const SRC = readFileSync("app/api/admin/pesapal-health/route.ts", "utf8");

  /**
   * The live account holds 27 IPNs across several products, and more than half
   * cannot be delivered to: eleven point at developer machines, three at a
   * domain with a doubled TLD. Pesapal calls them faithfully and nothing
   * answers. They cannot break this integration — they belong to others — but
   * any payment relying on one is silently never confirmed.
   */
  function problem(url: string): string | null {
    let host: string;
    try { host = new URL(url).hostname.toLowerCase(); } catch { return "unparseable-url"; }
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost")) {
      return "points-at-a-developer-machine";
    }
    const labels = host.split(".");
    if (labels.length > 2 && labels[labels.length - 1] === labels[labels.length - 2]) {
      return "doubled-tld-probably-a-typo";
    }
    return null;
  }

  it("catches the developer-machine registrations, as found in the real account", () => {
    for (const url of [
      "http://localhost:3000/api/payment/ipn",
      "http://localhost:3203/payment-callbacks/wallet-payment-status",
      "http://127.0.0.1:3001/ipn",
    ]) {
      expect(problem(url)).toBe("points-at-a-developer-machine");
    }
  });

  it("catches the doubled TLD, which is a typo rather than a domain", () => {
    expect(problem("https://staging-commerce-api.maliyangu.com.com/payment-callbacks/wallet-payment-status"))
      .toBe("doubled-tld-probably-a-typo");
  });

  it("leaves every legitimate registration alone", () => {
    for (const url of [
      "https://app.eagleinfosolutions.com/api/webhooks/pesapal",
      "https://invoicing.pesapal.com/PaymentProcessed/payment",
      "https://eaglestays.ug/api/bookings/pesapal-ipn/",
      "https://commerceserver-staging.maliyangu.com/payment-callbacks/subscription-payment-status",
      "https://server.nestlily.com/subscription-payment-status",
    ]) {
      expect(problem(url)).toBeNull();
    }
  });

  it("does not mistake a two-label domain for a doubled TLD", () => {
    // "com.com" as the whole host has no third label to compare against.
    expect(problem("https://example.com/ipn")).toBeNull();
  });

  it("reports rather than deletes, and says why", () => {
    // Pesapal v3 has RegisterIPN and GetIpnList and no delete of any kind, so
    // an IPN can be created from here and never retired from here.
    expect(SRC).toContain("undeliverableRegistrations");
    expect(SRC).toContain("no delete-IPN endpoint");
    expect(SRC).not.toContain("DeleteIpn");
  });

  it("keeps it out of the blockers, since these belong to other integrations", () => {
    const idx = SRC.indexOf("undeliverableRegistrations");
    expect(SRC.slice(Math.max(0, idx - 400), idx)).not.toContain("blockers.push");
  });
});
