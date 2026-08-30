import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Deciding whether a customer is owed money.
 *
 * The verdict this route reaches is the whole product: "PAID BUT NEVER
 * ACTIVATED" means money arrived and nothing was delivered for it, and someone
 * will act on that. Getting it wrong in either direction is expensive — a false
 * positive refunds a customer who was served, a false negative leaves one who
 * paid for nothing.
 *
 * The rule is reproduced here against the same inputs rather than imported,
 * because the route's decision is inline. The source assertions at the end are
 * what keep the two from drifting apart.
 */

const PLAN_PRICES: Record<string, number> = {
  STANDARD: 35_000, GROWTH: 75_000, PREMIUM: 120_000, ENTERPRISE: 200_000,
};
const CURRENCY = "UGX";

function verdictFor(tx: { status: string; amount: number; currency: string; plan: string | null },
                    org: { flwSubscriptionId: string | null } | null,
                    trackingId: string) {
  const completed = tx.status === "Completed";
  if (!tx.plan) return "UNREADABLE REFERENCE";
  const expected = PLAN_PRICES[tx.plan] ?? null;
  const amountMatches = expected != null && tx.amount === expected && tx.currency === CURRENCY;
  const activatedByThis = org?.flwSubscriptionId === trackingId;

  if (!completed) return "NOT COMPLETED";
  if (!org) return "ORGANISATION GONE";
  if (!activatedByThis) return "PAID BUT NEVER ACTIVATED";
  if (!amountMatches) return "PAID, ACTIVATED, WRONG AMOUNT";
  return "PAID AND ACTIVATED";
}

const ID = "track-abc";

describe("the verdict that decides whether money is owed", () => {
  it("owes nothing when the payment reached the organisation", () => {
    expect(verdictFor(
      { status: "Completed", amount: 75_000, currency: "UGX", plan: "GROWTH" },
      { flwSubscriptionId: ID }, ID,
    )).toBe("PAID AND ACTIVATED");
  });

  it("flags money taken with nothing delivered — the case this exists for", () => {
    // Completed at Pesapal, and the organisation carries no trace of it.
    expect(verdictFor(
      { status: "Completed", amount: 200_000, currency: "UGX", plan: "ENTERPRISE" },
      { flwSubscriptionId: null }, ID,
    )).toBe("PAID BUT NEVER ACTIVATED");
  });

  it("does not credit a payment because SOME other payment activated the org", () => {
    // The subtle one. An organisation activated by a different transaction is
    // not evidence that THIS one was honoured — a customer who paid twice is
    // owed for the second.
    expect(verdictFor(
      { status: "Completed", amount: 75_000, currency: "UGX", plan: "GROWTH" },
      { flwSubscriptionId: "a-different-tracking-id" }, ID,
    )).toBe("PAID BUT NEVER ACTIVATED");
  });

  it("owes nothing for a payment that never completed", () => {
    for (const status of ["Failed", "Reversed", "Pending", "Invalid"]) {
      expect(verdictFor(
        { status, amount: 75_000, currency: "UGX", plan: "GROWTH" },
        { flwSubscriptionId: null }, ID,
      )).toBe("NOT COMPLETED");
    }
  });

  it("says so when the organisation is gone rather than guessing", () => {
    expect(verdictFor(
      { status: "Completed", amount: 75_000, currency: "UGX", plan: "GROWTH" },
      null, ID,
    )).toBe("ORGANISATION GONE");
  });

  it("separates an activated payment whose amount is wrong from a clean one", () => {
    // Underpaid but activated: not owed a refund, but not nothing either.
    expect(verdictFor(
      { status: "Completed", amount: 35_000, currency: "UGX", plan: "ENTERPRISE" },
      { flwSubscriptionId: ID }, ID,
    )).toBe("PAID, ACTIVATED, WRONG AMOUNT");
  });

  it("treats a foreign currency as a mismatch even at the right number", () => {
    expect(verdictFor(
      { status: "Completed", amount: 200_000, currency: "KES", plan: "ENTERPRISE" },
      { flwSubscriptionId: ID }, ID,
    )).toBe("PAID, ACTIVATED, WRONG AMOUNT");
  });

  it("refuses to attribute a payment whose reference cannot be read", () => {
    expect(verdictFor(
      { status: "Completed", amount: 75_000, currency: "UGX", plan: null },
      null, ID,
    )).toBe("UNREADABLE REFERENCE");
  });
});

describe("the route matches the rule tested here", () => {
  const SRC = readFileSync("app/api/admin/verify-payments/route.ts", "utf8");

  it("decides in the same order, so an unactivated payment is never reported as fine", () => {
    const order = ["NOT COMPLETED", "ORGANISATION GONE", "PAID BUT NEVER ACTIVATED", "PAID, ACTIVATED, WRONG AMOUNT", "PAID AND ACTIVATED"];
    const positions = order.map((v) => SRC.indexOf(`verdict = "${v}"`));
    expect(positions.every((p) => p > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("ties activation to THIS tracking id, not merely to an active organisation", () => {
    expect(SRC).toContain("org?.flwSubscriptionId === trackingId");
  });

  it("changes nothing on either side", () => {
    for (const write of ["prisma.organization.update", "prisma.organization.create", "recordBillingEvent"]) {
      expect(SRC).not.toContain(write);
    }
  });

  it("is platform-admin only and rate limited on both methods", () => {
    expect((SRC.match(/assertPlatformAdmin\(\)/g) ?? []).length).toBe(2);
    expect((SRC.match(/rateLimit\.platformAdmin/g) ?? []).length).toBe(2);
  });
});
