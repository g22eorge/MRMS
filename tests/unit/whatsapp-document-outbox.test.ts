import { describe, expect, it } from "bun:test";

import {
  WHATSAPP_PDF_DOCUMENT_KEY,
  isWhatsAppPdfDocumentRow,
  parseWhatsAppDocumentVars,
} from "../../lib/notifications/whatsapp-document-outbox";

describe("parseWhatsAppDocumentVars()", () => {
  it("parses valid document metadata", () => {
    const vars = parseWhatsAppDocumentVars(
      JSON.stringify({
        documentKind: "invoice",
        filename: "invoice-123.pdf",
        caption: "Your invoice",
        staffName: "Alex",
        staffRole: "ADMIN",
        staffUserId: "user-1",
        auditAction: "INVOICE_SENT_WHATSAPP",
        auditDetail: { invoiceNumber: "INV-1" },
      }),
    );

    expect(vars?.documentKind).toBe("invoice");
    expect(vars?.filename).toBe("invoice-123.pdf");
    expect(vars?.auditDetail?.invoiceNumber).toBe("INV-1");
  });

  it("rejects incomplete metadata", () => {
    expect(parseWhatsAppDocumentVars(JSON.stringify({ documentKind: "invoice" }))).toBeNull();
    expect(parseWhatsAppDocumentVars("not-json")).toBeNull();
  });
});

describe("isWhatsAppPdfDocumentRow()", () => {
  it("detects PDF document rows by templateKey", () => {
    expect(
      isWhatsAppPdfDocumentRow({ channel: "WHATSAPP", templateKey: WHATSAPP_PDF_DOCUMENT_KEY }),
    ).toBe(true);
    expect(isWhatsAppPdfDocumentRow({ channel: "WHATSAPP", templateKey: "JOB_STATUS_UPDATE" })).toBe(false);
  });
});
