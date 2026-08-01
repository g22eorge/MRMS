import { describe, expect, it } from "bun:test";

import {
  DOCUMENTS_NAV,
  DOCUMENTS_ROUTES,
  canAccessDocumentsHub,
  defaultDocumentsRouteForRole,
  documentsNavForRole,
} from "../../lib/documents/routes";

describe("DOCUMENTS_ROUTES", () => {
  it("defines canonical document hub paths", () => {
    expect(DOCUMENTS_ROUTES.home).toBe("/documents");
    expect(DOCUMENTS_ROUTES.invoices).toBe("/documents/invoices");
    expect(DOCUMENTS_ROUTES.templates).toBe("/documents/templates");
  });
});

describe("documentsNavForRole", () => {
  it("returns invoices and related tabs for FINANCE", () => {
    const keys = documentsNavForRole("FINANCE").map((item) => item.key);
    expect(keys).toContain("invoices");
    expect(keys).toContain("credit_notes");
    expect(keys).not.toContain("job_cards");
  });

  it("returns job cards and quotations for TECHNICIAN_INTERNAL", () => {
    const keys = documentsNavForRole("TECHNICIAN_INTERNAL").map((item) => item.key);
    expect(keys).toEqual(["job_cards", "quotations", "delivery_notes"]);
  });

  it("picks invoices as default when available", () => {
    expect(defaultDocumentsRouteForRole("FINANCE")).toBe(DOCUMENTS_ROUTES.invoices);
    expect(defaultDocumentsRouteForRole("SALES_RETAIL")).toBe(DOCUMENTS_ROUTES.quotations);
  });

  it("denies hub access for roles without document nav", () => {
    expect(canAccessDocumentsHub("TECHNICIAN_EXTERNAL")).toBe(false);
    expect(canAccessDocumentsHub("OPS")).toBe(true);
  });

  it("uses canonical hrefs in nav items", () => {
    for (const item of DOCUMENTS_NAV) {
      expect(item.href.startsWith("/documents/")).toBe(true);
    }
  });
});
