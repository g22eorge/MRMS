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

describe("a trial gets the modules it chose at signup", () => {
  const SRC = readFileSync("lib/module-access.ts", "utf8");
  const ACTION = readFileSync("app/(app)/settings/billing/module-actions.ts", "utf8");

  it("does not open every module to a trial", () => {
    // It used to, so that an under-selection at signup would not hide features.
    // In practice a clothes shop that had picked point of sale and inventory
    // spent its trial looking at jobs, intake and technicians.
    expect(SRC).not.toContain('billingStatus === "TRIALING"');
    expect(SRC).toContain("orgModuleGrant.findMany");
  });

  it("leaves adding a module to the administrator, within the plan", () => {
    // The replacement for "show everything": discovery by choice, in Settings
    // -> Billing. The plan check is the same on a trial as off it, so a module
    // above the plan cannot be switched on free and then kept when the trial
    // ends -- the action offers the plan it needs instead.
    expect(ACTION).toContain("if (!planAtLeast(org.plan, required))");
    expect(ACTION).not.toContain("TRIALING");
  });

  it("keeps the customer list out of the repair module", async () => {
    // Every business has customers. Filed under JOBS, a shop without repairs
    // had no customer list.
    const { HREF_MODULE, hrefModuleAllowed } = await import("@/lib/nav/href-module");
    expect(HREF_MODULE["/clients"]).toBeUndefined();
    expect(hrefModuleAllowed("/clients", new Set(["POS"]))).toBe(true);
    expect(hrefModuleAllowed("/jobs", new Set(["POS"]))).toBe(false);
    expect(hrefModuleAllowed("/service", new Set(["POS"]))).toBe(false);
  });

  it("gates every module's pages on the server, not only in the menus", () => {
    // A hidden menu item is not access control: the address can be typed.
    const gates: Array<[string, string]> = [
      ["jobs", "JOBS"], ["intake", "JOBS"], ["technicians", "JOBS"], ["warranty", "JOBS"],
      ["payout-followups", "JOBS"], ["service", "JOBS"], ["field", "FIELD"], ["pos", "POS"],
      ["sales", "SALES"], ["targets", "TARGETS"], ["complaints", "COMPLAINTS"],
      ["reports", "REPORTS"], ["ai-insights", "REPORTS"],
      ["inventory/purchase-orders", "PURCHASE_ORDERS"], ["inventory/suppliers", "PURCHASE_ORDERS"],
      ["inventory/stock-counts", "INVENTORY"],
      ["documents/invoices", "INVOICING"], ["documents/quotations", "INVOICING"], ["documents/receipts", "INVOICING"],
    ];
    for (const [segment, moduleKey] of gates) {
      const layout = readFileSync(`app/(app)/${segment}/layout.tsx`, "utf8");
      expect(layout).toContain(`requireModule(OrgModule.${moduleKey})`);
    }
  });

  it("still falls back to all modules when the grants table cannot be read", () => {
    // Pre-existing behaviour, and the safe direction: a broken lookup must not
    // lock a paying customer out of their own product.
    expect(SRC).toContain("// Table missing (un-migrated env) — allow all.");
  });
});

describe("screens every business shares follow the modules it chose", () => {
  it("gives repair-shaped roles a neutral dashboard when there is no repair module", () => {
    const page = readFileSync("app/(app)/dashboard/page.tsx", "utf8");
    expect(page).toContain('!enabledModules.has("JOBS") && REPAIR_DASHBOARD_ROLES.has(user.role)');
    expect(page).toContain("<WorkspaceDashboard");
    // Built from the same model as the menus, so the two cannot disagree, and
    // carrying no money figures of its own.
    const workspace = readFileSync("app/(app)/dashboard/sections/WorkspaceDashboard.tsx", "utf8");
    expect(workspace).toContain("buildSidebarModel(role, permissions, enabledModules)");
    expect(workspace).not.toContain("formatMoney");
  });

  it("drops job counts and repair history from the client pages", () => {
    const list = readFileSync("app/(app)/clients/page.tsx", "utf8");
    expect(list).toContain("...(hasJobs ? [{");
    const detail = readFileSync("app/(app)/clients/[id]/page.tsx", "utf8");
    expect(detail).toContain("secondary={canEdit && hasJobs ? (");
    expect(detail).toContain("{hasJobs ? (");
  });
});

describe("deactivated accounts are listed apart from active ones", () => {
  const page = readFileSync("app/(app)/settings/users/page.tsx", "utf8");

  it("filters the list by the chosen view", () => {
    expect(page).toContain('.filter((item) => item.isActive === (view === "active"))');
  });

  it("opens the list a requested person is in", () => {
    // Deactivating someone redirects back with their id; they have just left
    // the active list, and the page must not silently show somebody else.
    expect(page).toContain('params.view !== "active" && requested && !requested.isActive');
  });
});

describe("a deactivated organisation is out of the platform's working view", () => {
  it("is listed under its own tab, not dimmed among the active ones", () => {
    const table = readFileSync("app/(platform)/platform/OrgTable.tsx", "utf8");
    expect(table).toContain('if (org.isActive !== (view === "active")) return false;');
    expect(table).not.toContain("opacity-40");
  });

  it("raises no alerts and is not counted among customers", () => {
    // It keeps the billing status it had when it was switched off, so it used
    // to show a "past due" alert nobody could act on.
    const page = readFileSync("app/(platform)/platform/page.tsx", "utf8");
    expect(page).toContain("const liveOrgs = orgs.filter((o) => o.isActive);");
    expect(page).toContain('const pastDueOrgs = liveOrgs.filter((o) => o.billingStatus === "PAST_DUE");');
    expect(page).toContain('const trialing = liveOrgs.filter((o) => o.billingStatus === "TRIALING");');
  });

  it("gets no trial reminders and no status changes from the billing job", () => {
    const job = readFileSync("lib/billing/subscription-lifecycle.ts", "utf8");
    expect(job).toContain('where: { isActive: true, billingStatus: "TRIALING", trialEndsAt: { gt: now } }');
    expect(job).toContain('where: { isActive: true, billingStatus: "ACTIVE", planRenewsAt: { lt: now } }');
  });
});
