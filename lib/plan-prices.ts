/**
 * plan-prices.ts — Effective plan price resolver
 *
 * Priority:
 *   1. PlatformSetting (PLAN_PRICE_*)  — an override, if one is ever written
 *   2. PLAN_PRICES below              — the prices customers are charged
 *
 * This file used to carry its own table, and it had drifted off the ladder
 * entirely: STARTER 35,000 / PROFESSIONAL 75,000 / ENTERPRISE 120,000, against
 * a product that sells STANDARD 35,000 / GROWTH 75,000 / PREMIUM 120,000 /
 * ENTERPRISE 200,000. PROFESSIONAL is not a plan. The values look like a
 * three-tier ladder that became five and left this behind, shifted by one rung.
 *
 * It mattered because the Pesapal webhook verifies the amount paid against this
 * resolver while checkout charges from PLAN_PRICES. Three of the four
 * purchasable plans were absent here, so the lookup returned null and the
 * webhook bailed; ENTERPRISE was present at the wrong figure and failed the
 * comparison. The webhook answers 200 either way, so Pesapal treated it as
 * delivered and never retried. Money in, subscription not activated, nothing
 * logged. The browser callback reads PLAN_PRICES directly and did activate,
 * which is the only reason this was not visible sooner — it hid the failure
 * behind whether the customer's browser made it back to the site.
 *
 * So there is one table now, and it is the one that takes the money.
 */

import { getPlatformSetting } from "@/lib/platform-settings";

/**
 * The canonical plan prices, in UGX per month.
 *
 * These lived in lib/pesapal.ts, which only declared them and never used them —
 * the payment client was just where they happened to be parked. They belong
 * here, in the module named for them, so the resolver below cannot drift from
 * the figures checkout charges. pesapal.ts re-exports this, so every existing
 * importer is unaffected.
 *
 * STARTER is absent on purpose: it is free.
 */
export const PLAN_PRICES: Record<string, number> = {
  STANDARD:   35_000,
  GROWTH:     75_000,
  PREMIUM:   120_000,
  ENTERPRISE: 200_000,
};

/**
 * The prices charged at checkout, and therefore the prices to verify against.
 * An alias rather than a second table: a second copy is what caused the drift.
 */
export const FALLBACK_PLAN_PRICES: Record<string, number> = { ...PLAN_PRICES };

/** Every plan's effective price, with any PlatformSetting override applied. */
export async function getEffectivePlanPrices(): Promise<Record<string, number>> {
  const prices: Record<string, number> = { ...FALLBACK_PLAN_PRICES };

  await Promise.all(
    Object.keys(FALLBACK_PLAN_PRICES).map(async (plan) => {
      const stored = await getPlatformSetting(`PLAN_PRICE_${plan}`);
      if (stored) {
        const n = Number(stored);
        if (n > 0) prices[plan] = n;
      }
    }),
  );

  return prices;
}

/**
 * The effective price for one plan, or null when the plan has no price.
 *
 * Null is the honest answer for STARTER, which is free, and for any key that is
 * not a plan. Callers verifying a payment must treat null as "do not activate" —
 * which is what the webhook does.
 */
export async function getEffectivePlanPrice(plan: string): Promise<number | null> {
  const stored = await getPlatformSetting(`PLAN_PRICE_${plan}`);
  if (stored) {
    const n = Number(stored);
    if (n > 0) return n;
  }
  return FALLBACK_PLAN_PRICES[plan] ?? null;
}
