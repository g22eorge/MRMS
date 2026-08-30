import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * A new tenant's documents must not carry another business's identity.
 *
 * The owner asked whether an account can start genuinely fresh. It could not.
 * Two independent paths put Eagle Info onto every commercial tenant's
 * customer-facing documents:
 *
 *   - resolveInvoiceLogo() reads logo files bundled in public/ and takes no
 *     organisation, so every tenant's quotations, invoices and receipts were
 *     stamped with Eagle Info's logo.
 *   - DocumentBrandingSettings defaults to Eagle Info's trading name, its
 *     address on Bombo Road, its two telephone numbers and its signature line,
 *     and onboarding created the row without overriding them.
 *
 * Together a new repair shop's first quotation reached their client as another
 * company's letterhead — the wrong name, the wrong address, and a telephone
 * number that rings a different business. That is worse than a cosmetic bug: it
 * misdirects a customer to a competitor and misrepresents who they are dealing
 * with.
 */

const SCHEMA = readFileSync("prisma/schema.prisma", "utf8");
const ONBOARDING = readFileSync("app/(onboarding)/onboarding/actions.ts", "utf8");
const PDF_UTILS = readFileSync("lib/pdf/pdf-utils.ts", "utf8");

describe("the logo is not handed out to whoever asks", () => {
  it("resolves nothing unless the deployment is the single tenant it belongs to", () => {
    expect(PDF_UTILS).toContain('deployment.mode !== "CARE_SINGLE_TENANT"');
  });

  it("fails closed when the deployment cannot be identified", () => {
    // An unknown deployment must print no logo rather than risk printing one
    // that belongs to someone else.
    expect(PDF_UTILS).toContain("if (!deployment || deployment.mode");
    expect(PDF_UTILS).toContain("return undefined;");
  });

  it("still serves the bundled files on care, which is Eagle Info", () => {
    expect(PDF_UTILS).toContain("eagle-info-logo.png");
  });
});

describe("a new organisation starts as itself, not as Eagle Info", () => {
  it("names the business after itself", () => {
    expect(ONBOARDING).toContain("companyName: businessName");
    expect(ONBOARDING).toContain("signatureCompanyLabel: `Signed by: ${businessName}`");
  });

  it("inherits no address, no telephone numbers and no footer", () => {
    // Blank prints nothing, which is honest. Inherited prints a competitor's
    // contact details on a document going to that tenant's own customer.
    for (const field of [
      'companyAddressLine1: ""',
      'companyAddressLine2: ""',
      'companyContacts: ""',
      'footerText: ""',
    ]) {
      expect(ONBOARDING).toContain(field);
    }
  });

  it("still derives its own document code, which was already correct", () => {
    // Kept because document numbers are globally unique while counters are
    // per-org: every tenant inheriting "EIS" collided on day one.
    expect(ONBOARDING).toContain("quotePrefix: defaultDocumentCodeForSlug(slug)");
  });
});

describe("the schema defaults are still Eagle Info's, and that is the remaining hazard", () => {
  it("records what they are, so the next creation path does not inherit them silently", () => {
    // Deliberately not migrated: changing a default on a live SQLite database
    // rewrites the table, and the defaults are correct for care. Onboarding is
    // currently the only path that creates a branding row — this test exists so
    // that a second path added later is written knowing what it would inherit.
    expect(SCHEMA).toContain('companyName           String        @default("Eagle Info Solutions")');
    expect(SCHEMA).toContain('companyContacts       String        @default("+256772 006 344 | +256754 006 344")');
  });

  it("has exactly one place that creates a branding row", () => {
    // If this fails, a new creation path exists and must set the fields above
    // explicitly, or it reintroduces the leak.
    const files = [ONBOARDING];
    const creates = files.join("\n").match(/documentBrandingSettings\.create/g) ?? [];
    expect(creates.length).toBe(1);
  });
});

describe("each organisation has its own logo, stored per organisation", () => {
  const BLOB = readFileSync("lib/blob-storage.ts", "utf8");
  const BRANDING_PAGE = readFileSync("app/(app)/settings/branding/page.tsx", "utf8");

  /**
   * What this replaced: uploadLogoAction wrote every upload to
   * public/eagle-info-logo.<ext> — one shared path with one tenant's name in
   * it. On the multi-tenant deployment a tenant uploading their logo replaced
   * it for every other tenant, and on a read-only serverless filesystem the
   * write failed outright. The feature was simultaneously broken and
   * cross-tenant.
   */
  it("no longer writes a shared file into public/", () => {
    expect(BRANDING_PAGE).not.toContain("eagle-info-logo.${ext}");
    expect(BRANDING_PAGE).not.toContain("writeFile");
  });

  it("stores under a key scoped to the organisation", () => {
    expect(BLOB).toContain("`org-logos/${orgId}/");
  });

  it("validates type, size and magic bytes before storing", () => {
    // A renamed executable must not become a logo, and the declared MIME type
    // is not evidence of anything.
    expect(BLOB).toContain("LOGO_TYPES.has(file.type)");
    expect(BLOB).toContain("LOGO_MAX_BYTES");
    expect(BLOB).toContain("hasValidImageSignature(file.type, bytes)");
  });

  it("refuses SVG, which is a script-bearing format", () => {
    const types = BLOB.slice(BLOB.indexOf("const LOGO_TYPES"), BLOB.indexOf("const LOGO_MAX_BYTES"));
    expect(types).not.toContain("svg");
    expect(types).toContain("image/png");
  });

  it("is admin-only and honours read-only access", () => {
    expect(BRANDING_PAGE).toContain('currentUser.role !== "ADMIN"');
    expect(BRANDING_PAGE).toContain("assertOrgCanMutate({");
  });

  it("replaces the row before deleting the old file", () => {
    // The other order loses the logo entirely if the delete succeeds and the
    // update then fails.
    const upload = BRANDING_PAGE.slice(BRANDING_PAGE.indexOf("async function uploadLogoAction"));
    const update = upload.indexOf("documentBrandingSettings.update");
    const del = upload.indexOf("deleteBlobObject(previousKey)");
    expect(update).toBeGreaterThan(-1);
    expect(update).toBeLessThan(del);
  });

  it("can be removed, and the file removed with it", () => {
    expect(BRANDING_PAGE).toContain("async function removeLogoAction");
    expect(BRANDING_PAGE).toContain("companyLogoUrl: null, companyLogoKey: null");
  });
});

describe("the document renderer prefers the organisation's own logo", () => {
  const PDF_UTILS = readFileSync("lib/pdf/pdf-utils.ts", "utf8");

  it("looks the logo up for the organisation it is rendering for", () => {
    expect(PDF_UTILS).toContain("resolveInvoiceLogo(orgId?: string | null)");
    expect(PDF_UTILS).toContain("select: { companyLogoUrl: true }");
  });

  it("prints nothing rather than a bundled logo when the org's cannot be fetched", () => {
    // Falling through would put another business's mark on the document, which
    // is the failure this whole entry exists for.
    expect(PDF_UTILS).toContain("// A stored logo that cannot be fetched prints nothing rather than falling");
  });

  it("every document route asks for its own organisation", () => {
    const routes = [
      "app/api/invoices/[id]/pdf/route.ts",
      "app/api/credit-notes/[id]/route.ts",
      "app/api/sales/[id]/receipt/route.ts",
      "app/api/refunds/[id]/route.ts",
      "app/api/delivery-notes/[id]/route.ts",
      "app/api/payments/[id]/receipt/route.ts",
      "app/api/portal/receipt/[paymentId]/route.ts",
      "lib/pdf/generate-invoice.ts",
    ];
    for (const f of routes) {
      const src = readFileSync(f, "utf8");
      expect(src).toMatch(/resolveInvoiceLogo\((orgId|session\.org\.id)\)/);
      // The org-blind call is what stamped every tenant with the same logo.
      expect(src).not.toContain("resolveInvoiceLogo()");
    }
  });
});
