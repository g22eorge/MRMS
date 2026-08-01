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

import { scopedDb as createScopedDb } from "@/lib/prisma-scope";

/** @deprecated Prefer `scopedDb` — alias kept for existing imports during migration. */
export function orgDb(orgId: string | null) {
  if (!orgId) {
    throw new Error("orgDb called without orgId — user is not in an organisation");
  }
  return createScopedDb(orgId);
}
