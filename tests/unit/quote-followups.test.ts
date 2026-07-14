import { describe, expect, it } from "bun:test";

import {
  DEFAULT_DRAFT_STALE_DAYS,
  buildQuoteFollowUpMessages,
  computeQuoteDaysPending,
  shouldExpireQuotationDraft,
} from "../../lib/commercial/quote-followups";

describe("quote follow-ups", () => {
  it("computes days pending from anchor date", () => {
    const anchor = new Date("2026-07-01T12:00:00Z");
    const now = new Date("2026-07-04T12:00:00Z");
    expect(computeQuoteDaysPending({ anchor, now })).toBe(3);
  });

  it("builds follow-up copy with pdf link", () => {
    const copy = buildQuoteFollowUpMessages({
      recipientName: "Jane",
      quoteNumber: "QT-1001",
      totalAmount: 150000,
      currency: "UGX",
      daysPending: 5,
      pdfUrl: "https://app.example.com/api/quotations/q1",
    });
    expect(copy.whatsappBody).toContain("QT-1001");
    expect(copy.emailBody).toContain("https://app.example.com/api/quotations/q1");
  });

  it("expires drafts past validUntil", () => {
    expect(
      shouldExpireQuotationDraft(
        {
          status: "DRAFT",
          createdAt: new Date("2026-07-01"),
          validUntil: new Date("2026-07-10"),
        },
        { now: new Date("2026-07-11") },
      ),
    ).toBe(true);
  });

  it("expires drafts older than stale threshold", () => {
    const createdAt = new Date("2026-06-01");
    const now = new Date("2026-07-14");
    expect(
      shouldExpireQuotationDraft(
        { status: "DRAFT", createdAt, validUntil: null },
        { now, staleDays: DEFAULT_DRAFT_STALE_DAYS },
      ),
    ).toBe(true);
  });

  it("does not expire non-draft quotations", () => {
    expect(
      shouldExpireQuotationDraft(
        { status: "SENT", createdAt: new Date("2026-01-01"), validUntil: null },
        { now: new Date("2026-07-14") },
      ),
    ).toBe(false);
  });
});
