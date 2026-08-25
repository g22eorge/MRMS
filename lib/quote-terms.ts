import { defaultBranding } from "@/lib/document-branding";

/**
 * Document terms that actually relate to the work.
 *
 * The business does two different things: it repairs devices and it sells
 * goods. The terms that shipped with the app only described the first, so a
 * customer buying equipment received a document promising that "repair work
 * begins only after approval is recorded" and warning about storage fees on
 * uncollected devices. None of it applied to what they had bought.
 *
 * Invoices and receipts are transactional, so they carry only the terms for
 * the work in hand. Quotations are different: every client gets one, which
 * makes them the one document that should show the full range. So a quotation
 * prints both sets under their own headings, with the section covering this
 * quote first. A client quoted for equipment learns we also repair, and the
 * headings keep it obvious which clauses bind them.
 *
 * Validity dates are not repeated here because every quotation template prints
 * "Valid until" in its own right.
 *
 * Whatever the owner writes in Settings always wins over all of this.
 */

export type DocumentWorkKind = "REPAIR" | "SALE" | "MIXED";

/** A heading line. The PDF templates bold any line ending in a colon. */
const GOODS_HEAD = "Goods:";
const REPAIRS_HEAD = "Repairs:";

const SALE_LINES = [
  "Prices are subject to stock availability at the time of order.",
  "Goods carry the manufacturer warranty only, where applicable.",
  "Payment is due in full before delivery unless otherwise agreed.",
];

const REPAIR_LINES = [
  "Repair work is carried out only after approval is recorded.",
  "Parts availability may affect the final timeline and cost.",
  "Pre-existing or hidden faults may affect the outcome.",
  "Uncollected devices may attract storage fees after notice.",
];

export const TERMS_REPAIR = REPAIR_LINES.join("\n");
export const TERMS_SALE = SALE_LINES.join("\n");

/**
 * For documents that can cover either line of business, and for the terms an
 * org starts out with. It names both trades instead of describing only one.
 */
export const TERMS_MIXED = [
  "We supply equipment and carry out repairs; only the terms relevant to this document apply.",
  "Goods are subject to stock availability and carry the manufacturer warranty only, where applicable.",
  "Repair work is carried out only after approval is recorded, and parts availability may affect the timeline.",
  "Pre-existing or hidden faults may affect the outcome of a repair.",
  "Uncollected devices may attract storage fees after notice.",
].join("\n");

/**
 * Every terms block this app has ever shipped as a starting value.
 *
 * An org whose stored terms still match one of these has not written its own,
 * so we are free to substitute the context-aware set. This has to be a list,
 * not a single string: when the shipped default changes, orgs created under
 * the older one are still un-customised and must keep being treated that way.
 */
const SHIPPED_DEFAULTS = [
  // The original repair-only block.
  "Quotation valid for 30 days from date issued.\nRepair work begins only after approval is recorded.\nParts availability may affect final timeline.\nHidden pre-existing faults may affect final outcome.\nUncollected devices may attract storage fees after notice.",
  TERMS_MIXED,
  // Whatever the current shipped default is, in case the two drift apart.
  defaultBranding.termsText,
].map((t) => t.trim());

/** True when the org is still on a value the app supplied, not one it wrote. */
export function isShippedDefaultTerms(brandingTerms: string | null | undefined): boolean {
  const stored = (brandingTerms ?? "").trim();
  return stored === "" || SHIPPED_DEFAULTS.includes(stored);
}

/** True for a section heading, which templates render bold and without a bullet. */
export function isTermsHeading(line: string): boolean {
  return line.trim().endsWith(":");
}

/**
 * Choose the terms to print on a transactional document (invoice, receipt,
 * credit note): only the work that document actually covers.
 */
export function pickDocumentTerms(
  brandingTerms: string | null | undefined,
  kind: DocumentWorkKind,
): string {
  if (!isShippedDefaultTerms(brandingTerms)) return (brandingTerms ?? "").trim();
  if (kind === "REPAIR") return TERMS_REPAIR;
  if (kind === "SALE") return TERMS_SALE;
  return TERMS_MIXED;
}

/**
 * Terms for a quotation: both trades, under headings, this quote's own section
 * first. Owner-written terms are printed as-is and never split up.
 */
export function quotationTerms(
  brandingTerms: string | null | undefined,
  kind: "REPAIR" | "SALE",
): string {
  if (!isShippedDefaultTerms(brandingTerms)) return (brandingTerms ?? "").trim();
  const goods = [GOODS_HEAD, ...SALE_LINES];
  const repairs = [REPAIRS_HEAD, ...REPAIR_LINES];
  return (kind === "SALE" ? [...goods, ...repairs] : [...repairs, ...goods]).join("\n");
}

/** Back-compat wrapper for callers that only know repair-or-not. */
export function pickQuoteTerms(brandingTerms: string | null | undefined, isRepair: boolean): string {
  return quotationTerms(brandingTerms, isRepair ? "REPAIR" : "SALE");
}

/** @deprecated prefer TERMS_REPAIR / TERMS_SALE */
export const QUOTE_TERMS_REPAIR = TERMS_REPAIR;
/** @deprecated prefer TERMS_REPAIR / TERMS_SALE */
export const QUOTE_TERMS_SALE = TERMS_SALE;
