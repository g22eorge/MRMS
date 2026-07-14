import { describe, expect, it } from "bun:test";

import { documentPdfUrl, resolveLinkedDocumentRecipient } from "../../lib/notifications/share-document";

describe("resolveLinkedDocumentRecipient()", () => {
  const job = { fullName: "Job Client", phone: "+256700", email: "job@example.com" };
  const invoice = { fullName: "Invoice Client", phone: "+256701", email: "invoice@example.com" };
  const sale = { fullName: "Sale Client", phone: "+256702", email: "sale@example.com" };
  const credit = { fullName: "Credit Client", phone: "+256703", email: "credit@example.com" };

  it("prefers job client over invoice and sale clients", () => {
    expect(
      resolveLinkedDocumentRecipient({
        jobClient: job,
        invoiceClient: invoice,
        saleClient: sale,
      }),
    ).toBe(job);
  });

  it("falls back through invoice, sale, then credit-note sale client", () => {
    expect(resolveLinkedDocumentRecipient({ invoiceClient: invoice, saleClient: sale })).toBe(invoice);
    expect(resolveLinkedDocumentRecipient({ saleClient: sale })).toBe(sale);
    expect(resolveLinkedDocumentRecipient({ creditNoteSaleClient: credit })).toBe(credit);
    expect(resolveLinkedDocumentRecipient({})).toBeNull();
  });
});

describe("documentPdfUrl()", () => {
  it("prefixes app URL and normalizes path", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    expect(documentPdfUrl("/api/refunds/abc")).toBe("https://app.example.com/api/refunds/abc");
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });
});
