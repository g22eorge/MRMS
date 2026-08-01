import { prisma } from "@/lib/prisma";

/**
 * Org-scoped document numbering (Option A: org-prefixed, globally unique).
 *
 * The document-number columns (jobNumber, saleNumber, grnNumber, …) are declared
 * globally `@unique`, but the generators produce per-org sequences — so a second
 * org's first document of the period collides with the first org's and P2002s,
 * blocking the second tenant from transacting.
 *
 * Fix without a schema migration: prefix every generated number with the org's
 * uppercased slug. `Organization.slug` is `@unique`, and uppercasing is a
 * bijection over the slug charset ([a-z0-9-]), so the tag is itself globally
 * unique — which makes the full number globally unique while keeping the
 * existing `@unique` columns and all global lookups (public status page,
 * invoice findUnique) working unchanged.
 */
export function orgNumberTag(slug: string | null | undefined) {
  const normalized = (slug ?? "").trim().toUpperCase();
  return normalized || "ORG";
}

/** Resolve the numbering tag for an org id via its slug. */
export async function orgTagFor(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { slug: true },
  });
  return orgNumberTag(org?.slug);
}

/**
 * Highest trailing sequence for `inner` (e.g. "GRN-2026-") across existing
 * numbers, tolerating both tagged ("ACME-GRN-2026-0007") and legacy untagged
 * ("GRN-2026-0007") values so the sequence continues smoothly post-transition.
 * Parses numerically (not string-sorted), which also fixes the >9999 wrap bug.
 */
export function maxNumberSequence(inner: string, numbers: string[]) {
  const escaped = inner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}(\\d+)`);
  let max = 0;
  for (const value of numbers) {
    const match = value.match(re);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/** Compose a globally-unique, org-tagged document number. */
export function composeOrgNumber(tag: string, inner: string, seq: number, pad = 4) {
  return `${tag}-${inner}${String(seq).padStart(pad, "0")}`;
}
