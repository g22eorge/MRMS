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

/**
 * Resolve the numbering tag for an org id via its slug.
 *
 * Accepts an optional client so callers INSIDE an interactive `$transaction` can
 * pass `tx` — issuing this read on the global `prisma` client while a tx holds
 * the connection deadlocks on Turso/libSQL (same class as getOrgNumberConfig).
 * Out-of-transaction callers keep the default global client.
 */
export async function orgTagFor(orgId: string, db: Pick<typeof prisma, "organization"> = prisma) {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { slug: true },
  });
  return orgNumberTag(org?.slug);
}

/**
 * Is this document code already claimed by a different org?
 *
 * The document-number columns are globally `@unique` while the counters are
 * per-org, so two orgs sharing a code compose the same number and the second
 * one's write fails. The code is what keeps them apart, which makes its
 * uniqueness a hard requirement rather than a nicety.
 */
export async function documentCodeTakenByAnotherOrg(orgId: string, code: string): Promise<boolean> {
  const wanted = code.trim().toUpperCase();
  if (!wanted) return false;
  try {
    const rows = await prisma.$queryRaw<Array<{ orgId: unknown; id: unknown; quotePrefix: unknown }>>`
      SELECT orgId, id, "quotePrefix" FROM "DocumentBrandingSettings"`;

    const ownerOf = (r: { orgId: unknown; id: unknown }) => (r.orgId ? String(r.orgId) : String(r.id));
    const codeOf = (r: { quotePrefix: unknown }) => String(r.quotePrefix ?? "").trim().toUpperCase();

    // Keeping the code you already have is always allowed. Several orgs share
    // "EIS" today from the old shared default; enforcing uniqueness against them
    // retroactively would lock every one of them out of saving Branding at all.
    // So this grandfathers what exists and only blocks NEW collisions.
    const own = rows.find((r) => ownerOf(r) === orgId);
    if (own && codeOf(own) === wanted) return false;

    return rows.some((r) => {
      const owner = ownerOf(r);
      // The shared 'singleton' row belongs to nobody, so it never blocks a claim.
      return owner !== orgId && owner !== "singleton" && codeOf(r) === wanted;
    });
  } catch {
    // Branding table unreadable — don't block the save on a check we can't run.
    return false;
  }
}

/**
 * Default document code for an org that has never set one: derived from its
 * globally-unique slug, so a brand-new tenant is collision-free on day one
 * instead of inheriting the shared "EIS" default.
 */
export function defaultDocumentCodeForSlug(slug: string | null | undefined) {
  return orgNumberTag(slug);
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

/**
 * Org numbering config sourced from Branding settings (quotePrefix, e.g. "EIS",
 * and sequencePadLength). Cached briefly per org so the numbering path — which
 * runs inside interactive transactions — doesn't pay a branding round-trip on
 * every allocation. Branding rarely changes; a short TTL is plenty.
 */
type OrgNumberConfig = { prefix: string; pad: number };
// The narrow slice of a Prisma client we need — satisfied by both the global
// client and a transaction client (tx). Threading `tx` in is what keeps the read
// on the transaction's own connection (see below).
type NumberConfigDb = Pick<typeof prisma, "$queryRaw">;
const numberConfigCache = new Map<string, { value: OrgNumberConfig; expires: number }>();
const NUMBER_CONFIG_TTL_MS = 60_000;

export async function getOrgNumberConfig(orgId?: string, db: NumberConfigDb = prisma): Promise<OrgNumberConfig> {
  const key = orgId ?? "__default__";
  const now = Date.now();
  const cached = numberConfigCache.get(key);
  if (cached && cached.expires > now) return cached.value;

  let value: OrgNumberConfig = { prefix: "EIS", pad: 4 };
  try {
    // Deliberately a minimal read of only the two columns we need — NOT
    // getDocumentBrandingSettings(), which runs ensureRawTable() (CREATE/ALTER
    // TABLE DDL). This function runs inside interactive write-transactions during
    // document-number allocation, and on Turso/libSQL a DDL statement issued
    // while such a transaction is open can deadlock it until it times out. Both
    // columns are original, so this SELECT never needs a migration.
    //
    // Just as important: run the read on the caller's `db` (the transaction
    // client when called from nextDocumentNumber). On Turso/libSQL the interactive
    // transaction holds the single connection, so issuing this SELECT on the GLOBAL
    // client instead would wait for a connection the open tx never releases —
    // a deadlock that only surfaces on a cache miss (a fresh org's first payment,
    // or any org on a cold serverless instance) and never locally (SQLite WAL).
    // Only the org's OWN row decides its code. The shared 'singleton' row is
    // consulted for padding alone: falling back to it for the prefix gave every
    // org without branding the same "EIS", and because the document-number
    // columns are globally unique, that made a second tenant's writes collide.
    const rows = orgId
      ? await db.$queryRaw<Array<{ quotePrefix: unknown; sequencePadLength: unknown }>>`
          SELECT "quotePrefix", "sequencePadLength"
          FROM "DocumentBrandingSettings"
          WHERE id = ${orgId} OR orgId = ${orgId}
          LIMIT 1`
      : await db.$queryRaw<Array<{ quotePrefix: unknown; sequencePadLength: unknown }>>`
          SELECT "quotePrefix", "sequencePadLength"
          FROM "DocumentBrandingSettings" WHERE id = 'singleton' LIMIT 1`;
    const row = rows?.[0];
    if (row) {
      const prefix = String(row.quotePrefix ?? "EIS").trim().toUpperCase() || "EIS";
      const padNum = Number(row.sequencePadLength);
      const pad = Number.isFinite(padNum) && padNum > 0 ? padNum : 4;
      value = { prefix, pad };
    } else if (orgId) {
      // No branding of its own — derive a unique code from the org's slug, which
      // is itself globally unique. The admin can set a shorter one in Branding.
      const slugRows = await db.$queryRaw<Array<{ slug: unknown }>>`
        SELECT slug FROM "Organization" WHERE id = ${orgId} LIMIT 1`;
      const padRows = await db.$queryRaw<Array<{ sequencePadLength: unknown }>>`
        SELECT "sequencePadLength" FROM "DocumentBrandingSettings" WHERE id = 'singleton' LIMIT 1`;
      const padNum = Number(padRows?.[0]?.sequencePadLength);
      value = {
        prefix: orgNumberTag(slugRows?.[0]?.slug ? String(slugRows[0].slug) : null),
        pad: Number.isFinite(padNum) && padNum > 0 ? padNum : 4,
      };
    }
  } catch {
    // Branding table missing/unreadable — fall back to the EIS default.
  }
  numberConfigCache.set(key, { value, expires: now + NUMBER_CONFIG_TTL_MS });
  return value;
}

/** Drop a cached numbering config so a Branding change takes effect immediately. */
export function invalidateOrgNumberConfig(orgId?: string) {
  numberConfigCache.delete(orgId ?? "__default__");
}

/**
 * Highest trailing sequence for a given year across mixed number formats —
 * tolerates the new slash form ("EIS/2026/0041", "EIS/INV/2026/0044") and every
 * legacy form ("EAGLE-INFO-SOLUTIONS-EI-2026-0040", "EI-2026-0040"). Used so a
 * format switch continues the sequence instead of restarting at 0001.
 */
export function maxSequenceForYear(numbers: string[], year: number) {
  const re = new RegExp(`${year}[-/](\\d+)(?!.*\\d)`);
  let max = 0;
  for (const value of numbers) {
    if (!value) continue;
    const match = value.match(re);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/** Compose a slash-style repair number, e.g. "EIS/2026/0041". */
export function composeJobNumber(prefix: string, year: number, seq: number, pad = 4) {
  return `${prefix}/${year}/${String(seq).padStart(pad, "0")}`;
}

/** Compose a slash-style document number, e.g. "EIS/INV/2026/0044". */
export function composeDocumentNumber(prefix: string, type: string, year: number, seq: number, pad = 4) {
  return `${prefix}/${type}/${year}/${String(seq).padStart(pad, "0")}`;
}
