import { describe, expect, it } from "bun:test";

import {
  buildOverdueReminderMessages,
  computeInvoiceDaysOverdue,
  matchesOverdueAgingBucket,
} from "../../lib/commercial/invoice-reminders";

describe("computeInvoiceDaysOverdue()", () => {
  it("uses due date when present", () => {
    const now = new Date("2026-07-14T12:00:00Z");
    const dueDate = new Date("2026-07-01T12:00:00Z");
    expect(
      computeInvoiceDaysOverdue({
        dueDate,
        issuedAt: new Date("2026-06-01T12:00:00Z"),
        now,
      }),
    ).toBe(13);
  });

  it("falls back to issued date when due date is missing", () => {
    const now = new Date("2026-07-14T12:00:00Z");
    expect(
      computeInvoiceDaysOverdue({
        dueDate: null,
        issuedAt: new Date("2026-07-10T12:00:00Z"),
        now,
      }),
    ).toBe(4);
  });
});

describe("matchesOverdueAgingBucket()", () => {
  it("matches standard aging bands", () => {
    expect(matchesOverdueAgingBucket(10, "1-30")).toBe(true);
    expect(matchesOverdueAgingBucket(45, "31-60")).toBe(true);
    expect(matchesOverdueAgingBucket(90, "61+")).toBe(true);
    expect(matchesOverdueAgingBucket(45, "1-30")).toBe(false);
  });

  it("treats non-overdue invoices as non-matching", () => {
    expect(matchesOverdueAgingBucket(0, "all")).toBe(false);
    expect(matchesOverdueAgingBucket(-2, "1-30")).toBe(false);
  });
});

describe("buildOverdueReminderMessages()", () => {
  it("includes balance, overdue days, and optional pdf link", () => {
    const copy = buildOverdueReminderMessages({
      recipientName: "Jane",
      invoiceNumber: "INV-001",
      balance: 120000,
      currency: "UGX",
      daysOverdue: 42,
      pdfUrl: "https://app.example.com/api/jobs/job-1/invoice",
    });

    expect(copy.emailSubject).toContain("INV-001");
    expect(copy.whatsappBody).toContain("Jane");
    expect(copy.whatsappBody).toContain("42 days overdue");
    expect(copy.whatsappBody).toContain("120,000");
    expect(copy.emailBody).toContain("https://app.example.com/api/jobs/job-1/invoice");
  });
});
