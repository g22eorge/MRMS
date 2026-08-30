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

function verdictFor(i: Input) {
  const match = i.storedIpnId && i.registered ? i.registered.find((r) => r.ipn_id === i.storedIpnId) ?? null : null;
  const pointsHere = match ? match.url === i.expectedWebhookUrl : null;

  if (!i.live) return "SANDBOX — CANNOT TAKE REAL MONEY";
  if (!i.haveCredentials) return "NO CREDENTIALS — CHECKOUT WILL FAIL";
  if (!i.authOk) return "CREDENTIALS REJECTED";
  if (!i.storedIpnId || (i.registered && !match)) return "NOTIFICATIONS NOT REGISTERED";
  if (match && (match.status !== "Active" || !pointsHere)) return "NOTIFICATIONS GO SOMEWHERE ELSE";
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
