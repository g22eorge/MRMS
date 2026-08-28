import { readFileSync } from "node:fs";

import { describe, it, expect } from "bun:test";

import {
  DOC_TEMPLATES,
  InvoiceTemplateComponent,
  JobCardTemplateComponent,
  QuotationTemplateComponent,
  ReceiptTemplateComponent,
  resolveTemplateKey,
  type DocKind,
  type TemplateKey,
} from "../../lib/pdf/templates";

/**
 * The template picker advertises a set of document designs, gated by plan tier.
 * Every resolver used to ignore its key and return the one default, so all five
 * choices per kind rendered an identical PDF — an ENTERPRISE customer picking
 * "Executive" got the STARTER default. Nothing failed, nothing logged, and no
 * test looked, so it stayed that way.
 *
 * These tests pin the two properties that were silently false: every advertised
 * key resolves to a component, and no two keys of the same kind resolve to the
 * same one. The second is the one that matters — a resolver that returns the
 * default for everything satisfies the first.
 */

const RESOLVERS: Record<DocKind, (k: TemplateKey) => unknown> = {
  INVOICE: InvoiceTemplateComponent,
  QUOTATION: QuotationTemplateComponent,
  JOB_CARD: JobCardTemplateComponent,
  RECEIPT: ReceiptTemplateComponent,
};

const KINDS = Object.keys(RESOLVERS) as DocKind[];

describe("document template resolution", () => {
  for (const kind of KINDS) {
    const keys = DOC_TEMPLATES.filter((t) => t.kind === kind).map((t) => t.key);

    it(`${kind}: advertises at least one template`, () => {
      expect(keys.length).toBeGreaterThan(0);
    });

    it(`${kind}: every advertised key resolves to a component`, () => {
      for (const key of keys) {
        expect(typeof RESOLVERS[kind](key)).toBe("function");
      }
    });

    it(`${kind}: no two keys resolve to the same component`, () => {
      const byComponent = new Map<unknown, TemplateKey[]>();
      for (const key of keys) {
        const comp = RESOLVERS[kind](key);
        byComponent.set(comp, [...(byComponent.get(comp) ?? []), key]);
      }
      const collisions = [...byComponent.values()].filter((g) => g.length > 1);
      expect(collisions).toEqual([]);
    });
  }

  it("advertises no key without an implementation behind it", () => {
    // The catalogue is the promise; the resolver is the delivery. A key listed
    // here that falls through to the default is the original bug returning.
    const defaults = new Map<DocKind, unknown>(
      KINDS.map((kind) => {
        const first = DOC_TEMPLATES.find((t) => t.kind === kind)!.key;
        return [kind, RESOLVERS[kind](first)];
      }),
    );
    for (const t of DOC_TEMPLATES) {
      const isFirstOfKind = DOC_TEMPLATES.find((x) => x.kind === t.kind)!.key === t.key;
      if (isFirstOfKind) continue;
      expect(RESOLVERS[t.kind](t.key)).not.toBe(defaults.get(t.kind));
    }
  });

  it("falls back to the plan's default when the stored key is no longer offered", () => {
    // Keys have been removed from the catalogue before; an org still holding a
    // retired one must get a working document rather than nothing.
    const resolved = resolveTemplateKey({
      kind: "QUOTATION",
      requestedKey: "quote_executive_retired",
      plan: "ENTERPRISE",
    });
    expect(DOC_TEMPLATES.some((t) => t.kind === "QUOTATION" && t.key === resolved)).toBe(true);
  });

  it("never resolves a template above the org's plan", () => {
    const starter = resolveTemplateKey({
      kind: "INVOICE",
      requestedKey: "invoice_executive",
      plan: "STARTER",
    });
    expect(starter).not.toBe("invoice_executive");
  });
});

/**
 * Every advertised template must carry the TIN and the amount in words.
 *
 * This is a source scan rather than a render check because @react-pdf draws
 * text as glyph codes from a subsetted font — the words are genuinely not
 * extractable from the PDF as text, so "did it print?" cannot be asserted from
 * the output. What can be asserted is that each template's source reaches for
 * the props at all, which is exactly the failure this guards: a design that
 * quietly lacks something the others have is the same defect as a template that
 * silently rendered the default, and that one shipped for months.
 */
describe("every template carries the TIN and the amount in words", () => {
  const FILES: Record<string, string> = {
    invoice_classic:   "lib/pdf/EagleInfoInvoiceAdapter.tsx",
    invoice_modern:    "lib/pdf/InvoiceDocumentV2.tsx",
    invoice_premium:   "lib/pdf/InvoiceDocumentPremium.tsx",
    invoice_minimal:   "lib/pdf/InvoiceDocumentMinimal.tsx",
    invoice_executive: "lib/pdf/InvoiceDocumentExecutive.tsx",
    quote_classic:     "lib/pdf/EagleInfoQuotationAdapter.tsx",
    quote_modern:      "lib/pdf/QuotationDocumentModern.tsx",
    quote_minimal:     "lib/pdf/QuotationDocumentMinimal.tsx",
    quote_detailed:    "lib/pdf/QuotationDocument.tsx",
    quote_executive:   "lib/pdf/QuotationDocumentExecutive.tsx",
  };

  for (const [key, file] of Object.entries(FILES)) {
    it(`${key} renders the amount in words`, () => {
      const src = readFileSync(file, "utf8");
      expect(src).toContain("props.amountWords");
    });

    it(`${key} renders the TIN`, () => {
      const src = readFileSync(file, "utf8");
      expect(src).toContain("props.companyTaxId");
    });
  }
});
