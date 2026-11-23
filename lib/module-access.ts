import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { OrgModule } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { ALL_MODULES } from "@/lib/module-catalog";

export * from "@/lib/module-catalog";
// Runtime enum for server consumers (module-catalog is client-safe and no
// longer re-exports it — see its header). This module is server-only
// (next/cache, next/navigation, prisma), so the value import is safe here.
export { OrgModule };

/** Cache tag for an org's module grants — revalidate this on any grant change. */
export const orgModulesTag = (orgId: string) => `org-modules:${orgId}`;

// Module grants change rarely (admin toggles), but getOrgModules runs on every
// authenticated navigation. Cache per org with a short TTL + tag revalidation so
// a toggle takes effect immediately and normal loads skip the round-trip.
function loadOrgModuleList(orgId: string): Promise<OrgModule[]> {
  return unstable_cache(
    async () => {
      try {
        // What the business chose is what it gets, on a trial too.
        //
        // A trial used to open every module, on the reasoning that a choice
        // made at signup is a guess and an under-selection is invisible. In
        // practice it put a repair workflow -- jobs, intake, technicians,
        // warranty -- in front of a clothes shop that had picked point of sale
        // and inventory, for the whole of its first month. The answer to
        // "they might not know what else exists" is the module list in
        // Settings -> Billing, where an administrator can switch on any module
        // the plan covers and is told which plan the others need
        // (setOrgModuleAction), not showing everything to everyone.
        const grants = await prisma.orgModuleGrant.findMany({ where: { orgId }, select: { module: true } });
        // No grants at all means an organisation from before modules were
        // chosen at signup. Unrestricted, so nothing it uses disappears.
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
