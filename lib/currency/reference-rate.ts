import { prisma } from "@/lib/prisma";
import { isSupportedCurrency, ratePremiumPct } from "@/lib/currency";

/**
 * Published reference rates, for monitoring what transfers actually cost.
 *
 * This module never converts money and never posts to the ledger. Every figure
 * in the books comes from what the bank statement showed; a published rate is
 * an interbank number that no small business transacts at, and treating it as
 * truth would make the accounts disagree with reality while looking precise.
 *
 * What it is for: a business moving money to AED and RMB suppliers every month
 * wants to see that one transfer settled 4% above the published rate and
 * another 9%. That comparison is what identifies an expensive channel. It is a
 * management number, not an accounting one.
 *
 * Everything here fails soft. A missing, stale or unreachable rate means the
 * comparison is not shown — never a blocked save, never a wrong number.
 */

/** How long a cached rate is considered good enough to compare against. */
const MAX_AGE_HOURS = 36;

/** Where rates come from. Overridable so the provider is not baked in. */
function providerUrl(base: string) {
  const template = process.env.FX_REFERENCE_URL?.trim();
  if (template) return template.replace("{base}", encodeURIComponent(base));
  // A keyless default so this works without configuration. Any provider
  // returning { rates: { QUOTE: number } } can be substituted through the env.
  return `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
}

export type ReferenceRate = {
  base: string;
  quote: string;
  rate: number;
  source: string;
  fetchedAt: Date;
  /** True when the cached value is older than MAX_AGE_HOURS. */
  stale: boolean;
};

/**
 * The cached reference rate for a pair, or null.
 *
 * Reads only. Callers on a render path must never trigger a network fetch — a
 * page that waits on a third party is a page that hangs when the third party
 * does. Refreshing is the cron's job.
 */
export async function getReferenceRate(base: string, quote: string): Promise<ReferenceRate | null> {
  const b = base.toUpperCase().trim();
  const q = quote.toUpperCase().trim();
  if (b === q) return null;

  const row = await prisma.fxReferenceRate
    .findUnique({ where: { base_quote: { base: b, quote: q } } })
    .catch(() => null);
  if (!row || !(row.rate > 0)) return null;

  const ageHours = (Date.now() - row.fetchedAt.getTime()) / 3_600_000;
  return {
    base: row.base,
    quote: row.quote,
    rate: row.rate,
    source: row.source,
    fetchedAt: row.fetchedAt,
    stale: ageHours > MAX_AGE_HOURS,
  };
}

/**
 * How far a settled rate sat above the published one, or null.
 *
 * Null whenever the honest answer is "we cannot say": no cached rate, a stale
 * one, or no settled rate on the row. Showing a comparison against a rate from
 * last month would be worse than showing nothing, because it looks current.
 */
export async function settlementPremium(params: {
  currency: string;
  baseCurrency: string;
  settledRate: number | null | undefined;
}): Promise<{ premiumPct: number; reference: ReferenceRate } | null> {
  if (!params.settledRate || params.settledRate <= 0) return null;
  const ref = await getReferenceRate(params.currency, params.baseCurrency);
  if (!ref || ref.stale) return null;
  const premiumPct = ratePremiumPct(params.settledRate, ref.rate);
  if (premiumPct === null) return null;
  return { premiumPct, reference: ref };
}

/**
 * Fetch and cache rates for the pairs an organisation actually transacts in.
 *
 * Driven by the currencies present on supplier bills rather than by a fixed
 * list, so a business buying in AED and RMB fetches two pairs and not twenty.
 * Returns a per-pair outcome so a cron run can be read rather than guessed at.
 */
export async function refreshReferenceRates(params: {
  quote: string;
  bases: string[];
  fetchImpl?: typeof fetch;
}): Promise<Array<{ base: string; quote: string; ok: boolean; rate?: number; error?: string }>> {
  const doFetch = params.fetchImpl ?? fetch;
  const quote = params.quote.toUpperCase().trim();
  const results: Array<{ base: string; quote: string; ok: boolean; rate?: number; error?: string }> = [];

  for (const raw of params.bases) {
    const base = raw.toUpperCase().trim();
    if (base === quote || !isSupportedCurrency(base)) continue;

    try {
      // A timeout matters more than the retry: this runs on a schedule, so a
      // hung request costs a whole day's refresh rather than one page load.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await doFetch(providerUrl(base), { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        results.push({ base, quote, ok: false, error: `provider returned ${res.status}` });
        continue;
      }
      const body = (await res.json()) as { rates?: Record<string, unknown> };
      const value = Number(body?.rates?.[quote]);
      if (!Number.isFinite(value) || value <= 0) {
        results.push({ base, quote, ok: false, error: `no usable ${quote} rate in the response` });
        continue;
      }

      await prisma.fxReferenceRate.upsert({
        where: { base_quote: { base, quote } },
        create: { base, quote, rate: value, source: new URL(providerUrl(base)).host, fetchedAt: new Date() },
        update: { rate: value, source: new URL(providerUrl(base)).host, fetchedAt: new Date() },
      });
      results.push({ base, quote, ok: true, rate: value });
    } catch (err) {
      results.push({ base, quote, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return results;
}
