"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { OrgModule } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { ALL_MODULES, MODULE_LABELS, MODULE_MIN_PLAN, orgModulesTag } from "@/lib/module-access";
import { PLAN_PRICES } from "@/lib/plan-prices";
import { planLabel } from "@/lib/plan-labels";

/**
 * Letting an organisation change its own modules.
 *
 * Until now the choice was made once, during onboarding, before anyone had seen
 * the product — and only a platform administrator could revisit it. So a guess
 * made in the first two minutes became a support request, and the usual guess
 * is to under-select: the module they skipped is simply absent, and nothing
 * ever tells them what they are missing.
 *
 * The reason this could not simply be opened up is that modules and price are
 * coupled: recommendPlanForModules derives the plan from the selection, so
 * "enable Point of Sale" can mean "move to GROWTH". Turning a feature on must
 * therefore never quietly move someone's bill. The rules here are:
 *
 *   - Removing is always allowed and immediate. Nobody needs permission to use
 *     less, and it never raises a charge.
 *   - Adding within the current plan is immediate.
 *   - Adding something the plan does not cover is refused with the plan it
 *     needs and what that costs, for the caller to confirm and upgrade. It is
 *     never applied as a silent upgrade.
 *
 * During a trial every module is already on (see loadOrgModuleList), so this is
 * about the shape of the subscription afterwards.
 */

const PLAN_ORDER = ["STARTER", "STANDARD", "GROWTH", "PREMIUM", "ENTERPRISE"] as const;

function planAtLeast(current: string, required: string): boolean {
  const c = PLAN_ORDER.indexOf(current as (typeof PLAN_ORDER)[number]);
  const r = PLAN_ORDER.indexOf(required as (typeof PLAN_ORDER)[number]);
  // An unknown plan is treated as insufficient rather than waved through.
  if (c < 0 || r < 0) return false;
  return c >= r;
}

export type ModuleChangeResult =
  | { ok: true; enabled: boolean; module: OrgModule }
  | { ok: false; error: string }
  | {
      ok: false;
      needsUpgrade: true;
      module: OrgModule;
      requiredPlan: string;
      requiredPlanLabel: string;
      monthlyPrice: number | null;
      error: string;
    };

export async function setOrgModuleAction(formData: FormData): Promise<ModuleChangeResult> {
  const { user, orgId, org } = await requireOrgSession();

  // Only an owner-level account changes what the business is billed for.
  if (user.role !== "ADMIN") {
    return { ok: false, error: "Only an administrator can change modules." };
  }
  // Honours read-only access exactly as every other mutation does, including
  // an impersonating platform admin, whose session is forced READ_ONLY.
  assertOrgCanMutate({
    access: org.access,
    userRole: user.role,
    userAccessMode: user.accessMode,
    kind: "GENERAL",
  });

  const raw = String(formData.get("module") ?? "");
  const enable = String(formData.get("enable") ?? "") === "true";

  // Named moduleKey, not module: Next forbids assigning to `module`.
  const moduleKey = ALL_MODULES.find((m) => m === raw);
  if (!moduleKey) return { ok: false, error: "Unknown module." };

  if (enable) {
    const required = MODULE_MIN_PLAN[moduleKey];
    if (!planAtLeast(org.plan, required)) {
      // Refused rather than applied — turning on a feature must not move a bill.
      return {
        ok: false,
        needsUpgrade: true,
        module: moduleKey,
        requiredPlan: required,
        requiredPlanLabel: planLabel(required),
        monthlyPrice: PLAN_PRICES[required] ?? null,
        error: `${MODULE_LABELS[moduleKey]} needs the ${planLabel(required)} plan.`,
      };
    }
  }

  try {
    if (enable) {
      await prisma.orgModuleGrant.upsert({
        where: { orgId_module: { orgId, module: moduleKey } },
        create: { orgId, module: moduleKey },
        update: {},
      });
    } else {
      // Deleting the last grant would read as "no grants = all modules", which
      // is the opposite of what was asked. Keep an explicit empty selection by
      // refusing to remove the final one.
      const remaining = await prisma.orgModuleGrant.count({ where: { orgId } });
      if (remaining <= 1) {
        return { ok: false, error: "At least one module has to stay enabled." };
      }
      await prisma.orgModuleGrant.delete({ where: { orgId_module: { orgId, module: moduleKey } } }).catch(() => null);
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not change modules." };
  }

  // "max" matches every other module-grant revalidation in the codebase.
  revalidateTag(orgModulesTag(orgId), "max");
  revalidatePath("/settings/billing");
  return { ok: true, enabled: enable, module: moduleKey };
}
