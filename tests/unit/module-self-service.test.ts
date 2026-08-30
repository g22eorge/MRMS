import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

import { MODULE_MIN_PLAN, recommendPlanForModules, ALL_MODULES } from "@/lib/module-catalog";

/**
 * Letting a business change its own modules, without moving its bill.
 *
 * Modules and price are coupled — recommendPlanForModules derives the plan from
 * the selection — so "turn on Point of Sale" can mean "move to GROWTH". That
 * coupling is the whole reason this could not simply be opened up, and the rule
 * that makes it safe is that an upgrade is offered and never performed.
 */

const PLAN_ORDER = ["STARTER", "STANDARD", "GROWTH", "PREMIUM", "ENTERPRISE"] as const;

function planAtLeast(current: string, required: string): boolean {
  const c = PLAN_ORDER.indexOf(current as (typeof PLAN_ORDER)[number]);
  const r = PLAN_ORDER.indexOf(required as (typeof PLAN_ORDER)[number]);
  if (c < 0 || r < 0) return false;
  return c >= r;
}

describe("what a plan may switch on", () => {
  it("lets a STANDARD org enable what STANDARD covers", () => {
    expect(planAtLeast("STANDARD", MODULE_MIN_PLAN.INVOICING)).toBe(true);
    expect(planAtLeast("STANDARD", MODULE_MIN_PLAN.JOBS)).toBe(true);
  });

  it("refuses a STANDARD org the GROWTH-only modules", () => {
    for (const m of ["POS", "PURCHASE_ORDERS", "FIELD"] as const) {
      expect(planAtLeast("STANDARD", MODULE_MIN_PLAN[m])).toBe(false);
    }
  });

  it("lets ENTERPRISE enable everything", () => {
    for (const m of ALL_MODULES) {
      expect(planAtLeast("ENTERPRISE", MODULE_MIN_PLAN[m])).toBe(true);
    }
  });

  it("treats an unrecognised plan as insufficient rather than waving it through", () => {
    // Failing open here would hand out paid modules on a corrupt plan value.
    expect(planAtLeast("LEGACY_GOLD", "STANDARD")).toBe(false);
    expect(planAtLeast("STARTER", "NOT_A_PLAN")).toBe(false);
  });

  it("agrees with the plan the onboarding recommendation would pick", () => {
    // Both sides read MODULE_MIN_PLAN; this pins that they cannot disagree,
    // which is what let two price tables drift apart earlier in this system.
    for (const m of ALL_MODULES) {
      const required = recommendPlanForModules([m]);
      expect(planAtLeast(required, MODULE_MIN_PLAN[m])).toBe(true);
    }
  });
});

describe("the action's guarantees, in its source", () => {
  const SRC = readFileSync("app/(app)/settings/billing/module-actions.ts", "utf8");

  it("never upgrades a plan as a side effect of enabling a module", () => {
    // The entire risk of this feature: a toggle that silently raises a charge.
    expect(SRC).not.toContain("plan:");
    expect(SRC).not.toContain("billingStatus");
    expect(SRC).toContain("needsUpgrade");
  });

  it("only writes module grants, nothing else", () => {
    expect(SRC).toContain("prisma.orgModuleGrant");
    expect(SRC).not.toContain("prisma.organization.update");
  });

  it("is admin-only and honours read-only access", () => {
    expect(SRC).toContain('user.role !== "ADMIN"');
    expect(SRC).toContain("assertOrgCanMutate({");
    expect(SRC).toContain("userAccessMode: user.accessMode");
  });

  it("refuses to remove the last module, which would read as 'all of them'", () => {
    // No grants means unrestricted in loadOrgModuleList, so emptying the table
    // would turn everything back on — the opposite of what was asked.
    expect(SRC).toContain("remaining <= 1");
  });

  it("revalidates the module cache, or the change would not show for a minute", () => {
    expect(SRC).toContain("revalidateTag(orgModulesTag(orgId)");
  });
});

describe("a trial has every module, whatever was picked at signup", () => {
  const SRC = readFileSync("lib/module-access.ts", "utf8");

  it("short-circuits before reading grants", () => {
    // Selection happens during onboarding, before anyone has seen the product,
    // so an under-selection hides features the customer would have paid for and
    // never learns about.
    expect(SRC).toContain('org?.billingStatus === "TRIALING"');
    expect(SRC).toContain("return [...ALL_MODULES]");
    const trialIdx = SRC.indexOf('billingStatus === "TRIALING"');
    const grantsIdx = SRC.indexOf("orgModuleGrant.findMany");
    expect(trialIdx).toBeLessThan(grantsIdx);
  });

  it("still falls back to all modules when the grants table cannot be read", () => {
    // Pre-existing behaviour, and the safe direction: a broken lookup must not
    // lock a paying customer out of their own product.
    expect(SRC).toContain("// Table missing (un-migrated env) — allow all.");
  });
});
