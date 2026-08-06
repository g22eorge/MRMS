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

/**
 * Org numbering config sourced from Branding settings (quotePrefix, e.g. "EIS",
 * and sequencePadLength). Cached briefly per org so the numbering path — which
 * runs inside interactive transactions — doesn't pay a branding round-trip on
 * every allocation. Branding rarely changes; a short TTL is plenty.
 */
type OrgNumberConfig = { prefix: string; pad: number };
const numberConfigCache = new Map<string, { value: OrgNumberConfig; expires: number }>();
const NUMBER_CONFIG_TTL_MS = 60_000;

export async function getOrgNumberConfig(orgId?: string): Promise<OrgNumberConfig> {
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
    const rows = orgId
      ? await prisma.$queryRaw<Array<{ quotePrefix: unknown; sequencePadLength: unknown }>>`
          SELECT "quotePrefix", "sequencePadLength"
          FROM "DocumentBrandingSettings"
          WHERE id = ${orgId} OR orgId = ${orgId} OR id = 'singleton'
          ORDER BY CASE WHEN id = ${orgId} OR orgId = ${orgId} THEN 0 ELSE 1 END
          LIMIT 1`
      : await prisma.$queryRaw<Array<{ quotePrefix: unknown; sequencePadLength: unknown }>>`
          SELECT "quotePrefix", "sequencePadLength"
          FROM "DocumentBrandingSettings" WHERE id = 'singleton' LIMIT 1`;
    const row = rows?.[0];
    if (row) {
      const prefix = String(row.quotePrefix ?? "EIS").trim().toUpperCase() || "EIS";
      const padNum = Number(row.sequencePadLength);
      const pad = Number.isFinite(padNum) && padNum > 0 ? padNum : 4;
      value = { prefix, pad };
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
