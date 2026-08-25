import { describe, expect, it } from "vitest";

import { defaultBranding } from "@/lib/document-branding";
import {
  TERMS_MIXED,
  TERMS_REPAIR,
  TERMS_SALE,
  isShippedDefaultTerms,
  isTermsHeading,
  pickDocumentTerms,
  pickQuoteTerms,
  quotationTerms,
} from "@/lib/quote-terms";

// The repair-only block the app originally shipped. Orgs created before the
// wording changed still carry this exact string, and must keep being treated
// as un-customised.
const LEGACY_DEFAULT =
  "Quotation valid for 30 days from date issued.\nRepair work begins only after approval is recorded.\nParts availability may affect final timeline.\nHidden pre-existing faults may affect final outcome.\nUncollected devices may attract storage fees after notice.";

describe("isShippedDefaultTerms", () => {
  it("recognises the current shipped default", () => {
    expect(isShippedDefaultTerms(defaultBranding.termsText)).toBe(true);
  });

  it("still recognises the original repair-only default", () => {
    expect(isShippedDefaultTerms(LEGACY_DEFAULT)).toBe(true);
  });

  it("treats blank as un-customised", () => {
    expect(isShippedDefaultTerms("")).toBe(true);
    expect(isShippedDefaultTerms("   ")).toBe(true);
    expect(isShippedDefaultTerms(null)).toBe(true);
  });

  it("treats anything the owner wrote as customised", () => {
    expect(isShippedDefaultTerms("Payment on collection.")).toBe(false);
  });
});

describe("pickDocumentTerms", () => {
  it("gives a sales document sales terms, not repair terms", () => {
    const terms = pickDocumentTerms(LEGACY_DEFAULT, "SALE");
    expect(terms).toBe(TERMS_SALE);
    expect(terms).not.toMatch(/repair/i);
    expect(terms).not.toMatch(/storage fees/i);
  });

  it("gives a repair document repair terms", () => {
    expect(pickDocumentTerms(LEGACY_DEFAULT, "REPAIR")).toBe(TERMS_REPAIR);
  });

  it("names both trades when the document could be either", () => {
    const terms = pickDocumentTerms(LEGACY_DEFAULT, "MIXED");
    expect(terms).toBe(TERMS_MIXED);
    expect(terms).toMatch(/supply equipment/i);
    expect(terms).toMatch(/repairs/i);
  });

  it("never overrides terms the owner wrote", () => {
    const own = "Payment on collection. No exceptions.";
    for (const kind of ["REPAIR", "SALE", "MIXED"] as const) {
      expect(pickDocumentTerms(own, kind)).toBe(own);
    }
  });

  it("trims stored terms rather than printing stray whitespace", () => {
    expect(pickDocumentTerms("  Payment on collection.  ", "SALE")).toBe("Payment on collection.");
  });
});

describe("quotationTerms", () => {
  // Every client gets a quotation, so it carries both trades under headings
  // rather than only the half that covers this particular quote.
  it("shows both sections whichever the quote is for", () => {
    for (const kind of ["REPAIR", "SALE"] as const) {
      const terms = quotationTerms(LEGACY_DEFAULT, kind);
      expect(terms).toContain("Goods:");
      expect(terms).toContain("Repairs:");
      for (const line of [...TERMS_SALE.split("\n"), ...TERMS_REPAIR.split("\n")]) {
        expect(terms).toContain(line);
      }
    }
  });

  it("leads with the section covering this quote", () => {
    const sale = quotationTerms(LEGACY_DEFAULT, "SALE").split("\n");
    const repair = quotationTerms(LEGACY_DEFAULT, "REPAIR").split("\n");
    expect(sale[0]).toBe("Goods:");
    expect(repair[0]).toBe("Repairs:");
  });

  it("prints owner-written terms as one block, never split into sections", () => {
    const own = "Payment on collection. No exceptions.";
    expect(quotationTerms(own, "SALE")).toBe(own);
    expect(quotationTerms(own, "REPAIR")).toBe(own);
  });

  it("marks only the headings as headings", () => {
    const lines = quotationTerms(LEGACY_DEFAULT, "SALE").split("\n");
    expect(lines.filter(isTermsHeading)).toEqual(["Goods:", "Repairs:"]);
  });
});

describe("pickQuoteTerms", () => {
  it("still maps the repair flag onto the quotation terms", () => {
    expect(pickQuoteTerms(LEGACY_DEFAULT, true)).toBe(quotationTerms(LEGACY_DEFAULT, "REPAIR"));
    expect(pickQuoteTerms(LEGACY_DEFAULT, false)).toBe(quotationTerms(LEGACY_DEFAULT, "SALE"));
  });
});
