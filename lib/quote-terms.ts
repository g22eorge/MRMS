import { defaultBranding } from "@/lib/document-branding";

/**
 * Quotation terms that actually relate to the work.
 *
 * The stored branding default is repair-heavy ("repair begins after approval",
 * "uncollected devices attract storage fees") — noise on a quote for goods.
 * When an org hasn't written its own terms, pick a concise set that matches
 * whether the quote is for a repair job or a sale, instead of one generic wall
 * of text that half-applies.
 */

export const QUOTE_TERMS_REPAIR = [
  "Repair begins once this quotation is approved.",
  "Parts availability may affect the final timeline and cost.",
  "Pre-existing or hidden faults may affect the outcome.",
  "Uncollected devices may attract storage fees after notice.",
].join("\n");

export const QUOTE_TERMS_SALE = [
  "Prices are subject to stock availability at the time of order.",
  "Goods carry the manufacturer warranty only, where applicable.",
  "Payment is due in full before delivery unless otherwise agreed.",
].join("\n");

// The stored default shipped with the app. An org that still has exactly this
// text has not customised its terms, so we may swap in the context-aware set.
const LEGACY_DEFAULT_QUOTE_TERMS = defaultBranding.termsText.trim();

/**
 * Choose the terms to print on a quotation.
 * - Custom org terms win (respect what the owner wrote in Settings).
 * - Empty or the untouched app default -> the concise repair/sale set.
 */
export function pickQuoteTerms(brandingTerms: string | null | undefined, isRepair: boolean): string {
  const custom = (brandingTerms ?? "").trim();
  if (custom && custom !== LEGACY_DEFAULT_QUOTE_TERMS) return custom;
  return isRepair ? QUOTE_TERMS_REPAIR : QUOTE_TERMS_SALE;
}
