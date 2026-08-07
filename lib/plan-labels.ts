/**
 * plan-labels.ts — Display names for subscription tiers.
 * Keys are the OrgPlan enum values (STARTER, STANDARD, GROWTH, PREMIUM,
 * ENTERPRISE) and never change; only the branded Duuka labels are display copy.
 */

export const PLAN_LABEL: Record<string, string> = {
  STARTER:    "Duuka",
  STANDARD:   "Duuka Plus",
  GROWTH:     "Duuka Pro",
  PREMIUM:    "Duuka Max",
  ENTERPRISE: "Duuka ProMax",
};

/** Returns the display label, falling back to the raw key if not mapped. */
export function planLabel(key: string): string {
  return PLAN_LABEL[key] ?? key;
}
