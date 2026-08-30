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
