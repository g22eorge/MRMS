import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * The browser callback, which had been left behind.
 *
 * Pesapal drives two paths for every successful payment: it redirects the
 * customer here, and separately notifies the webhook. The webhook was audited,
 * corrected and tested. This one was not, and had drifted from it in three
 * ways that only matter once real money moves — which is exactly when they
 * would have been discovered.
 */

const CALLBACK = readFileSync("app/api/billing/callback/route.ts", "utf8");
const WEBHOOK = readFileSync("app/api/webhooks/pesapal/route.ts", "utf8");
const SHARED = readFileSync("lib/billing/apply-payment.ts", "utf8");

describe("both paths verify through one implementation", () => {
  it("neither carries its own copy of the price check any more", () => {
    // Two copies is what let the webhook verify against a ladder the product
    // had stopped selling. The same shape had already reappeared here.
    for (const src of [CALLBACK, WEBHOOK]) {
      expect(src).toContain("verifyPaymentAgainstPlan");
      expect(src).not.toContain("PLAN_PRICES[");
    }
  });

  it("the callback no longer ignores a platform price override", () => {
    // It read the raw table while the webhook read the override, so a custom
    // price made the customer's own browser refuse a payment the server had
    // already accepted.
    expect(CALLBACK).not.toContain("PLAN_PRICES");
    expect(SHARED).toContain("getEffectivePlanPrice(plan)");
  });

  it("and neither applies the payment itself", () => {
    for (const src of [CALLBACK, WEBHOOK]) {
      expect(src).toContain("applyPaymentToOrg");
      expect(src).not.toContain("prisma.organization.update(");
    }
  });
});

describe("the callback records why it refused", () => {
  it("writes a reason on every refusal instead of only redirecting", () => {
    // Previously: four bare `return NextResponse.redirect(...payment=failed)`.
    // The customer saw the same page; nobody could afterwards say what happened.
    expect(CALLBACK).toContain("recordBillingEvent");
    expect(CALLBACK).toContain("charge.rejected.");
  });

  it("covers the thrown-exception path too, which was the last silent one", () => {
    expect(CALLBACK).toContain('refuse(base, "exception-during-verification"');
  });

  it("never lets bookkeeping strand the customer", () => {
    // A failed write must not turn a completed payment into a blank page.
    expect(CALLBACK).toContain("could not record rejection");
  });

  it("records the successful charge under the webhook's own idempotency key", () => {
    // So the ledger has exactly one entry per transaction whichever path wins,
    // and still has one if the webhook never arrives.
    const key = "`pesapal:${orderTrackingId}:completed`";
    expect(CALLBACK).toContain(key);
    expect(WEBHOOK).toContain(key);
  });
});

describe("the guard that makes double delivery safe", () => {
  it("is evaluated inside the UPDATE, not only in the read before it", () => {
    // The callback and the webhook genuinely race: both can read a null
    // flwSubscriptionId before either writes. A read-then-write check would
    // let both through.
    expect(SHARED).toContain("updateMany");
    expect(SHARED).toContain("{ flwSubscriptionId: { not: orderTrackingId } }");
    expect(SHARED).toContain("count === 0");
  });

  it("treats a null subscription id as not-yet-applied", () => {
    // SQL: NOT (NULL = 'x') is NULL, not true — so a bare `not` filter would
    // exclude the never-paid organisation and refuse every first payment.
    expect(SHARED).toContain("{ flwSubscriptionId: null }");
  });

  it("keys on the transaction, so next month's payment still extends", () => {
    expect(SHARED).toContain("org.flwSubscriptionId === orderTrackingId");
  });
});
