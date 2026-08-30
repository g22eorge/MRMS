import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { OrgModule } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { ALL_MODULES } from "@/lib/module-catalog";

export * from "@/lib/module-catalog";

/** Cache tag for an org's module grants — revalidate this on any grant change. */
export const orgModulesTag = (orgId: string) => `org-modules:${orgId}`;

// Module grants change rarely (admin toggles), but getOrgModules runs on every
// authenticated navigation. Cache per org with a short TTL + tag revalidation so
// a toggle takes effect immediately and normal loads skip the round-trip.
function loadOrgModuleList(orgId: string): Promise<OrgModule[]> {
  return unstable_cache(
    async () => {
      try {
        // A trial gets everything, whatever was picked at signup.
        //
        // Modules are chosen during onboarding, before anyone has seen the
        // product, so the choice is a guess — and an under-selection is
        // invisible: the feature they would have paid for simply is not there,
        // and they never learn it existed. Opening the trial turns that guess
        // into something they can answer from use rather than from a form, and
        // the plan is then priced on what they actually reached for.
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { billingStatus: true },
        });
        if (org?.billingStatus === "TRIALING") return [...ALL_MODULES];

        const grants = await prisma.orgModuleGrant.findMany({ where: { orgId }, select: { module: true } });
        // No explicit grants = unrestricted (all modules on by default).
        return grants.length === 0 ? [...ALL_MODULES] : grants.map((g) => g.module);
      } catch {
        // Table missing (un-migrated env) — allow all.
        return [...ALL_MODULES];
      }
    },
    ["org-modules", orgId],
    { tags: [orgModulesTag(orgId)], revalidate: 60 },
  )();
}

/** Returns the set of enabled modules for an org. */
export async function getOrgModules(orgId: string): Promise<Set<OrgModule>> {
  return new Set(await loadOrgModuleList(orgId));
}

/** Server-side guard: redirects to /dashboard if the module is not granted. */
export async function requireModule(module: OrgModule): Promise<void> {
  const { orgId } = await requireOrgSession();
  const enabled = await getOrgModules(orgId);
  if (!enabled.has(module)) {
    redirect("/dashboard?blocked=module");
  }
}
