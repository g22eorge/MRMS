import { describe, it, expect, mock, beforeEach } from "bun:test";

// ── Mock the DB-dependent module BEFORE importing plan-prices ────────────────
const mockGetPlatformSetting = mock(async (_key: string): Promise<string | null> => null);

mock.module("@/lib/platform-settings", () => ({
  getPlatformSetting: mockGetPlatformSetting,
}));

// Dynamic import so the mock is in place before the module is evaluated.
const { FALLBACK_PLAN_PRICES, getEffectivePlanPrices, getEffectivePlanPrice } =
  await import("@/lib/plan-prices");

// ── FALLBACK_PLAN_PRICES ─────────────────────────────────────────────────────

describe("FALLBACK_PLAN_PRICES", () => {
  // These assertions used to read STARTER 35K / PROFESSIONAL 75K / ENTERPRISE
  // 120K, which is why the defect survived: a test existed and it pinned the
  // wrong ladder. PROFESSIONAL is not a plan this product sells.
  it("matches the ladder customers are actually charged", () => {
    expect(FALLBACK_PLAN_PRICES.STANDARD).toBe(35_000);
    expect(FALLBACK_PLAN_PRICES.GROWTH).toBe(75_000);
    expect(FALLBACK_PLAN_PRICES.PREMIUM).toBe(120_000);
    expect(FALLBACK_PLAN_PRICES.ENTERPRISE).toBe(200_000);
  });

  it("covers exactly the four paid tiers", () => {
    expect(Object.keys(FALLBACK_PLAN_PRICES).sort()).toEqual(
      ["ENTERPRISE", "GROWTH", "PREMIUM", "STANDARD"],
    );
  });

  it("carries no price for the free tier, and none for plans that do not exist", () => {
    expect("STARTER" in FALLBACK_PLAN_PRICES).toBe(false);
    expect("FREE" in FALLBACK_PLAN_PRICES).toBe(false);
    expect("PROFESSIONAL" in FALLBACK_PLAN_PRICES).toBe(false);
  });
});

// ── getEffectivePlanPrices() ─────────────────────────────────────────────────

describe("getEffectivePlanPrices()", () => {
  beforeEach(() => {
    mockGetPlatformSetting.mockReset();
    mockGetPlatformSetting.mockImplementation(async () => null);
  });

  it("returns fallback prices when the DB has nothing stored", async () => {
    const prices = await getEffectivePlanPrices();
    expect(prices).toEqual(FALLBACK_PLAN_PRICES);
  });

  it("overrides one plan when its DB price is valid", async () => {
    mockGetPlatformSetting.mockImplementation(async (key: string) => {
      if (key === "PLAN_PRICE_STANDARD") return "50000";
      return null;
    });

    const prices = await getEffectivePlanPrices();
    expect(prices.STANDARD).toBe(50_000);
    expect(prices.GROWTH).toBe(FALLBACK_PLAN_PRICES.GROWTH);
    expect(prices.ENTERPRISE).toBe(FALLBACK_PLAN_PRICES.ENTERPRISE);
  });

  it("overrides every plan when all DB prices are valid", async () => {
    const overrides: Record<string, number> = {
      PLAN_PRICE_STANDARD: 40_000,
      PLAN_PRICE_GROWTH: 80_000,
      PLAN_PRICE_PREMIUM: 130_000,
      PLAN_PRICE_ENTERPRISE: 250_000,
    };
    mockGetPlatformSetting.mockImplementation(async (key: string) =>
      overrides[key] != null ? String(overrides[key]) : null,
    );

    const prices = await getEffectivePlanPrices();
    expect(prices.STANDARD).toBe(40_000);
    expect(prices.GROWTH).toBe(80_000);
    expect(prices.PREMIUM).toBe(130_000);
    expect(prices.ENTERPRISE).toBe(250_000);
  });

  it("ignores a stored value of '0' and falls back", async () => {
    mockGetPlatformSetting.mockImplementation(async () => "0");
    const prices = await getEffectivePlanPrices();
    expect(prices).toEqual(FALLBACK_PLAN_PRICES);
  });

  it("ignores a negative stored value and falls back", async () => {
    mockGetPlatformSetting.mockImplementation(async () => "-5000");
    const prices = await getEffectivePlanPrices();
    expect(prices).toEqual(FALLBACK_PLAN_PRICES);
  });

  it("ignores a non-numeric stored value and falls back", async () => {
    mockGetPlatformSetting.mockImplementation(async () => "not-a-number");
    const prices = await getEffectivePlanPrices();
    expect(prices).toEqual(FALLBACK_PLAN_PRICES);
  });
});

// ── getEffectivePlanPrice() ──────────────────────────────────────────────────

describe("getEffectivePlanPrice()", () => {
  beforeEach(() => {
    mockGetPlatformSetting.mockReset();
    mockGetPlatformSetting.mockImplementation(async () => null);
  });

  it("returns the fallback price for every purchasable plan when DB is empty", async () => {
    expect(await getEffectivePlanPrice("STANDARD")).toBe(35_000);
    expect(await getEffectivePlanPrice("GROWTH")).toBe(75_000);
    expect(await getEffectivePlanPrice("PREMIUM")).toBe(120_000);
    expect(await getEffectivePlanPrice("ENTERPRISE")).toBe(200_000);
  });

  it("returns null for a plan with no price, which the webhook treats as do-not-activate", async () => {
    // STARTER is free — there is no amount to verify and no payment to take.
    expect(await getEffectivePlanPrice("STARTER")).toBeNull();
    // PROFESSIONAL was in the old table and is not a plan.
    expect(await getEffectivePlanPrice("PROFESSIONAL")).toBeNull();
    expect(await getEffectivePlanPrice("UNKNOWN")).toBeNull();
    expect(await getEffectivePlanPrice("FREE")).toBeNull();
    expect(await getEffectivePlanPrice("")).toBeNull();
  });

  it("returns the DB price when one is stored", async () => {
    mockGetPlatformSetting.mockImplementation(async () => "99000");
    expect(await getEffectivePlanPrice("GROWTH")).toBe(99_000);
  });

  it("ignores zero stored value and falls back for known plans", async () => {
    mockGetPlatformSetting.mockImplementation(async () => "0");
    expect(await getEffectivePlanPrice("STANDARD")).toBe(35_000);
  });
});

// ── The invariant that was broken ────────────────────────────────────────────

describe("checkout and the webhook agree on every purchasable plan", () => {
  /**
   * The defect this guards: checkout charged from one table and the Pesapal
   * webhook verified against another. Three of four plans were absent from the
   * verifier and returned null; the fourth was present at 120,000 against a
   * 200,000 charge. Either way the webhook bailed — and it answers HTTP 200, so
   * Pesapal never retried. Money taken, subscription not activated, silently.
   *
   * The billing page offers exactly these four. If a fifth is ever added and
   * given no price, this fails rather than taking the customer's money and
   * doing nothing with it.
   */
  const PURCHASABLE = ["STANDARD", "GROWTH", "PREMIUM", "ENTERPRISE"] as const;

  it("every plan the billing page sells has a price to verify against", async () => {
    for (const plan of PURCHASABLE) {
      const price = await getEffectivePlanPrice(plan);
      expect(typeof price).toBe("number");
      expect(price).toBeGreaterThan(0);
    }
  });

  it("the verifier returns exactly what checkout charges", async () => {
    // Same object by construction now, but assert it: the whole failure was two
    // tables that were supposed to match and did not.
    const { PLAN_PRICES: charged } = await import("@/lib/plan-prices");
    for (const plan of PURCHASABLE) {
      expect(await getEffectivePlanPrice(plan)).toBe(charged[plan]);
    }
  });

  it("the billing page and the price table offer the same set of plans", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/(app)/settings/billing/page.tsx", "utf8");
    const offered = [...src.matchAll(/price:\s*PLAN_PRICES\.([A-Z]+)/g)].map((m) => m[1]).sort();
    expect(offered).toEqual([...PURCHASABLE].sort());
    expect(Object.keys(FALLBACK_PLAN_PRICES).sort()).toEqual([...PURCHASABLE].sort());
  });
});
