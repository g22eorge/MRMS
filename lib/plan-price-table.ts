/**
 * Canonical plan prices, in UGX per month. Dependency-free on purpose: the
 * onboarding form (a client component) renders these, and any import chain
 * reaching server modules (@prisma/client, platform-settings) crashes the
 * browser bundle. Server logic lives in lib/plan-prices.ts, which re-exports
 * this table.
 *
 * STARTER is absent on purpose: it is free.
 */
export const PLAN_PRICES: Record<string, number> = {
  STANDARD:   19_900,
  GROWTH:     39_900,
  PREMIUM:    69_900,
  ENTERPRISE: 99_900,
};

/**
 * The prices charged at checkout, and therefore the prices to verify against.
 * An alias rather than a second table: a second copy is what caused the drift.
 */
export const FALLBACK_PLAN_PRICES: Record<string, number> = { ...PLAN_PRICES };
