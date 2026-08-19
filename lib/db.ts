/**
 * Canonical org-scoped database entry point.
 *
 * Prefer `scopedDb(orgId)` in API routes, Server Components, and Server Actions.
 * `orgDb` is a backward-compatible alias (same implementation).
 */
export {
  scopedDb,
  scopedDbFromSession,
  type ScopedDb,
} from "@/lib/prisma-scope";

import { redirect } from "next/navigation";

import { scopedDb as createScopedDb } from "@/lib/prisma-scope";

/**
 * @deprecated Prefer `scopedDb` — alias kept for existing imports during migration.
 *
 * A user with no org is a normal state, not a bug: they exist between signing up
 * and finishing onboarding, and User.orgId is nullable and SetNull on org delete.
 * Around twenty pages read `getCurrentUserRole()` (whose orgId is `string | null`)
 * and hand the result straight to this function, so throwing here rendered a 500
 * on the clients, finance, documents, inventory and sales pages for anyone in
 * that state. requireOrgSession has always sent them to onboarding instead; this
 * now agrees with it, which fixes every one of those call sites at once.
 */
export function orgDb(orgId: string | null) {
  if (!orgId) {
    redirect("/onboarding");
  }
  return createScopedDb(orgId);
}
