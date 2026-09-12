import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * One price, from one source, everywhere money is involved.
 *
 * This system has already had the defect once: two price tables, one used to
 * charge and one to verify, and every payment rejected for an amount mismatch
 * with nothing written down. That was fixed by giving the webhook and the
 * browser callback a single implementation.
 *
 * The platform price override reintroduced it from the other side. Only the
 * verification path read getEffectivePlanPrice; checkout, the prices shown to
 * the customer, and both admin tools read the raw table. So setting
 * PLAN_PRICE_GROWTH would have quoted the old price, charged the old price,
 * and had the webhook reject it against the new one — the same failure, arrived
 * at by a different route, and dormant only because nobody had used the
 * override yet.
 *
 * A source scan, because the property is "nobody reads the wrong table" and
 * that is a fact about the files rather than about one call.
 */

const CHARGE_AND_VERIFY = [
  // Quotes the price, and charges it.
  "app/(app)/settings/billing/page.tsx",
  // Verifies what arrived, on both delivery paths.
  "lib/billing/apply-payment.ts",
  // Decides whether a customer is owed money.
  "app/api/admin/verify-payments/route.ts",
  // Reports amounts that do not match what we charge.
  "app/api/admin/billing-reconcile/route.ts",
];

describe("every path that charges or verifies reads the effective price", () => {
  for (const file of CHARGE_AND_VERIFY) {
    const src = readFileSync(file, "utf8");

    it(`${file} uses the override-aware reader`, () => {
      expect(src).toMatch(/getEffectivePlanPrices?\(/);
    });

    it(`${file} does not read the raw table`, () => {
      // PLAN_PRICES is the fallback the effective reader falls back to. Read
      // directly on a money path, it silently ignores any override.
      expect(src).not.toMatch(/PLAN_PRICES\s*\[/);
    });
  }
});

describe("the checkout charge specifically", () => {
  const SRC = readFileSync("app/(app)/settings/billing/page.tsx", "utf8");

  it("submits the effective amount, not a constant", () => {
    expect(SRC).toContain("const amount = await getEffectivePlanPrice(targetPlan)");
    expect(SRC).toContain("amount,");
  });

  it("refuses to submit an order with no configured price", () => {
    // Submitting undefined as an amount would take a payment for nothing.
    expect(SRC).toContain("if (amount == null) throw new Error");
  });

  it("charges in the same currency the verifier requires", () => {
    // A literal "UGX" here and CURRENCY there is the same drift in miniature.
    expect(SRC).toContain("currency: CURRENCY,");
  });
});

describe("a failed checkout is a message, not a stack trace", () => {
  const SRC = readFileSync("app/(app)/settings/billing/page.tsx", "utf8");

  it("catches instead of throwing out of the server action", () => {
    // Unconfigured credentials, an unregisterable IPN, or Pesapal being down
    // all threw unhandled, so pressing Subscribe produced a bare error page
    // with a digest and no explanation. Observed in the dev server log.
    expect(SRC).toContain('redirect("/settings/billing?payment=unavailable")');
    expect(SRC).toContain('console.error("[billing/subscribe]"');
  });

  it("tells the customer they were not charged, which is the whole message", () => {
    expect(SRC).toContain("You have not been charged");
  });

  it("does not blame the customer's details for our own outage", () => {
    expect(SRC).toContain("problem on our side");
  });

  it("still redirects to the payment page on success", () => {
    // The catch must not swallow the happy path — redirect() throws internally,
    // so a try block wrapped around it would treat success as failure.
    expect(SRC).toContain("redirect(redirectUrl);");
  });
});
