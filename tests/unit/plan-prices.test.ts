import { describe, it, expect, mock, beforeEach } from "bun:test";
import { readFileSync } from "node:fs";

// ── Mock the DB-dependent module BEFORE importing plan-prices ────────────────
const mockGetPlatformSetting = mock(async (_key: string): Promise<string | null> => null);

mock.module("@/lib/platform-settings", () => ({
  getPlatformSetting: mockGetPlatformSetting,
}));

// Dynamic import so the mock is in place before the module is evaluated.
const { PLAN_PRICES, FALLBACK_PLAN_PRICES, getEffectivePlanPrices, getEffectivePlanPrice } =
  await import("@/lib/plan-prices");

// ── FALLBACK_PLAN_PRICES ─────────────────────────────────────────────────────

describe("FALLBACK_PLAN_PRICES", () => {
  // These assertions used to read STARTER 35K / PROFESSIONAL 75K / ENTERPRISE
  // 120K, which is why the defect survived: a test existed and it pinned the
  // wrong ladder. PROFESSIONAL is not a plan this product sells.
  it("matches the ladder customers are actually charged", () => {
    // Reset to attract sign-ups: 19,900 to enter, 99,900 at the top, with the
    // two middle rungs chosen to keep each step a real upgrade.
    expect(FALLBACK_PLAN_PRICES.STANDARD).toBe(19_900);
    expect(FALLBACK_PLAN_PRICES.GROWTH).toBe(39_900);
    expect(FALLBACK_PLAN_PRICES.PREMIUM).toBe(69_900);
    expect(FALLBACK_PLAN_PRICES.ENTERPRISE).toBe(99_900);
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
    expect(await getEffectivePlanPrice("STANDARD")).toBe(19_900);
    expect(await getEffectivePlanPrice("GROWTH")).toBe(39_900);
    expect(await getEffectivePlanPrice("PREMIUM")).toBe(69_900);
    expect(await getEffectivePlanPrice("ENTERPRISE")).toBe(99_900);
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
    expect(await getEffectivePlanPrice("STANDARD")).toBe(19_900);
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
    // Matches `price: prices.X` rather than `price: PLAN_PRICES.X`: the page now
    // reads the override-aware prices, because charging the base table while the
    // webhook verified against an override would reject every payment. The
    // property is unchanged — the page must offer exactly the purchasable plans.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/(app)/settings/billing/page.tsx", "utf8");
    const offered = [...src.matchAll(/price:\s*prices\.([A-Z]+)/g)].map((m) => m[1]).sort();
    expect(offered).toEqual([...PURCHASABLE].sort());
    expect(Object.keys(FALLBACK_PLAN_PRICES).sort()).toEqual([...PURCHASABLE].sort());
  });
});

describe("nothing quotes a price from its own copy", () => {
  /**
   * The pricing change that set this ladder found two more tables nobody had
   * noticed: the onboarding form, which quotes a prospect at signup, and the
   * billing-reconcile script, which decides whether a recorded amount looks
   * wrong. Neither used PLAN_PRICES, so the test forbidding raw reads of it
   * could not see them — they held literals instead.
   *
   * Editing only the canonical table would have left a prospect quoted 35,000
   * and charged 19,900, on the screen where they decide to buy.
   */
  const read = (f: string) => readFileSync(f, "utf8");

  it("the onboarding form reads the canonical table", () => {
    const src = read("app/(onboarding)/onboarding/OnboardingForm.tsx");
    expect(src).toContain("price: PLAN_PRICES.STANDARD");
    expect(src).toContain("price: PLAN_PRICES.ENTERPRISE");
  });

  it("no purchasable price appears as a literal in the onboarding form", () => {
    const src = read("app/(onboarding)/onboarding/OnboardingForm.tsx");
    for (const n of Object.values(PLAN_PRICES)) {
      const grouped = n.toLocaleString("en-US").replace(/,/g, "_");
      expect(src).not.toContain(grouped);
      expect(src).not.toContain(String(n));
    }
  });

  it("the reconcile script's copy matches, since a .mjs cannot import the module", () => {
    // It is allowed to hold a copy; it is not allowed to disagree.
    const src = read("scripts/billing-reconcile.mjs");
    const m = src.match(/const CHARGED = \{([^}]*)\}/);
    expect(m).not.toBeNull();
    const copied: Record<string, number> = {};
    for (const pair of m![1].split(",")) {
      const [k, v] = pair.split(":").map((x) => x.trim());
      if (k) copied[k] = Number(v.replace(/_/g, ""));
    }
    expect(copied).toEqual(PLAN_PRICES);
  });
});
