import { prisma } from "@/lib/prisma";

export const defaultBranding = {
  id: "singleton",
  companyName: "",
  companyTagline: "",
  companyAddressLine1: "",
  companyAddressLine2: "",
  companyContacts: "",
  companyEmail: "",
  companyWebsite: "",
  /// Printed on documents as the TIN. Empty means the org has none, and nothing
  /// is printed — not an empty "TIN:" label on every document it issues.
  companyTaxId: "",
  /// The organisation's own uploaded logo. Empty means it has none, which prints
  /// no logo rather than another tenant's.
  companyLogoUrl: "",
  documentTitle: "Job Card",
  quotePrefix: "EIS",
  quoteFormat: "{PREFIX} {M}/{YYYY}/{SEQ}",
  quoteValidityDays: 30,
  sequencePadLength: 4,
  vatDefaultApplicable: false,
  vatRatePercent: 18,
  vatInclusive: false,
  vatLabel: "VAT",
  termsText:
    "Quotation valid for 30 days from date issued.\nRepair work begins only after approval is recorded.\nParts availability may affect final timeline.\nHidden pre-existing faults may affect final outcome.\nUncollected devices may attract storage fees after notice.",
  footerText: "",
  // Multi-line "PAYMENT TO" block shown on invoices/receipts. First line is the
  // bank name; remaining lines are branch / account name / account number.
  // Multiple accounts are separated by a blank line. This is the rendered form.
  paymentInstructions: "",
  // Structured source of the above: JSON array of
  // { bankName, branch, accountName, accountNumber } managed in Settings.
  paymentAccounts: "",
  signatureCompanyLabel: "Signed by: Company",
  signatureClientLabel: "Signed by: Client",
  // Color scheme - Black, Gold & White
  primaryColor: "#000000",
  secondaryColor: "#D4AF37",
  accentColor: "#D4AF37",
  backgroundColor: "#FFFFFF",
  surfaceColor: "#F5F5F5",
  borderColor: "#E5E5E5",

  // Template selections
  invoiceTemplateKey: "invoice_classic",
  quotationTemplateKey: "quote_classic",
  jobCardTemplateKey: "job_card_classic",
  receiptTemplateKey: "receipt_classic",
};

type BrandingSettings = typeof defaultBranding;

/**
 * Reads and writes the per-organisation document branding row.
 *
 * This module used to own the table: it ran `CREATE TABLE IF NOT EXISTS` on
 * every call, then inspected `PRAGMA table_info` and issued conditional
 * `ALTER TABLE` statements for fourteen columns that newer code expected. That
 * existed because production schema and datamodel had drifted apart and there
 * was no migration path. Migrations now guarantee the shape, so this is plain
 * Prisma.
 *
 * `coerceRow` is kept: callers rely on every field being a non-null primitive
 * with a default substituted, which is not what the nullable columns give back.
 */

const SINGLETON_ID = "singleton";

function coerceRow(row: Record<string, unknown>): BrandingSettings {
  return {
    id: "singleton",
    companyName: String(row.companyName ?? defaultBranding.companyName),
    companyTagline: row.companyTagline ? String(row.companyTagline) : "",
    companyAddressLine1: String(row.companyAddressLine1 ?? defaultBranding.companyAddressLine1),
    companyAddressLine2: String(row.companyAddressLine2 ?? defaultBranding.companyAddressLine2),
    companyContacts: String(row.companyContacts ?? defaultBranding.companyContacts),
    companyEmail: row.companyEmail ? String(row.companyEmail) : "",
    companyWebsite: row.companyWebsite ? String(row.companyWebsite) : "",
    companyTaxId: row.companyTaxId ? String(row.companyTaxId) : "",
    companyLogoUrl: row.companyLogoUrl ? String(row.companyLogoUrl) : "",
    documentTitle: String(row.documentTitle ?? defaultBranding.documentTitle),
    quotePrefix: String(row.quotePrefix ?? defaultBranding.quotePrefix),
    quoteFormat: String(row.quoteFormat ?? defaultBranding.quoteFormat),
    quoteValidityDays: Number(row.quoteValidityDays ?? defaultBranding.quoteValidityDays),
    sequencePadLength: Number(row.sequencePadLength ?? defaultBranding.sequencePadLength),
    vatDefaultApplicable: Boolean(row.vatDefaultApplicable ?? defaultBranding.vatDefaultApplicable),
    vatRatePercent: Number(row.vatRatePercent ?? defaultBranding.vatRatePercent),
    vatInclusive: Boolean(row.vatInclusive ?? defaultBranding.vatInclusive),
    vatLabel: String(row.vatLabel ?? defaultBranding.vatLabel),
    termsText: String(row.termsText ?? defaultBranding.termsText),
    footerText: String(row.footerText ?? defaultBranding.footerText),
    paymentInstructions: String(row.paymentInstructions ?? defaultBranding.paymentInstructions),
    paymentAccounts: String(row.paymentAccounts ?? defaultBranding.paymentAccounts),
    signatureCompanyLabel: String(row.signatureCompanyLabel ?? defaultBranding.signatureCompanyLabel),
    signatureClientLabel: String(row.signatureClientLabel ?? defaultBranding.signatureClientLabel),
    primaryColor: String(row.primaryColor ?? defaultBranding.primaryColor),
    secondaryColor: String(row.secondaryColor ?? defaultBranding.secondaryColor),
    accentColor: String(row.accentColor ?? defaultBranding.accentColor),
    backgroundColor: String(row.backgroundColor ?? defaultBranding.backgroundColor),
    surfaceColor: String(row.surfaceColor ?? defaultBranding.surfaceColor),
    borderColor: String(row.borderColor ?? defaultBranding.borderColor),

    invoiceTemplateKey: String(row.invoiceTemplateKey ?? defaultBranding.invoiceTemplateKey),
    quotationTemplateKey: String(row.quotationTemplateKey ?? defaultBranding.quotationTemplateKey),
    jobCardTemplateKey: String(row.jobCardTemplateKey ?? defaultBranding.jobCardTemplateKey),
    receiptTemplateKey: String(row.receiptTemplateKey ?? defaultBranding.receiptTemplateKey),
  };
}


/**
 * Branding for an org, falling back to the legacy `singleton` row and finally
 * to the built-in defaults.
 *
 * Historically the row id was the literal string `singleton`; per-org rows use
 * the org id as their own id and also set `orgId`. Both shapes are still read so
 * an install that predates multi-tenancy keeps its branding.
 */
export async function getDocumentBrandingSettings(orgId?: string): Promise<BrandingSettings> {
  try {
    const row = orgId
      ? (await prisma.documentBrandingSettings.findFirst({
          where: { OR: [{ id: orgId }, { orgId }] },
        })) ?? (await prisma.documentBrandingSettings.findUnique({ where: { id: SINGLETON_ID } }))
      : await prisma.documentBrandingSettings.findUnique({ where: { id: SINGLETON_ID } });

    if (row) return coerceRow(row as unknown as Record<string, unknown>);

    // Nothing configured yet: seed the legacy singleton so the settings screen
    // has a row to edit, and hand back the defaults either way. An upsert
    // rather than createMany+skipDuplicates, which SQLite does not support.
    await prisma.documentBrandingSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
    return defaultBranding;
  } catch {
    return defaultBranding;
  }
}

export async function saveDocumentBrandingSettings(orgId: string, data: BrandingSettings) {
  // The org id doubles as the row id, so each org owns one row and never
  // collides with the legacy singleton.
  const fields = {
    orgId,
    companyName: data.companyName,
    companyTagline: data.companyTagline,
    companyAddressLine1: data.companyAddressLine1,
    companyAddressLine2: data.companyAddressLine2,
    companyContacts: data.companyContacts,
    companyEmail: data.companyEmail,
    companyWebsite: data.companyWebsite,
    companyTaxId: data.companyTaxId,
    companyLogoUrl: data.companyLogoUrl,
    documentTitle: data.documentTitle,
    quotePrefix: data.quotePrefix,
    quoteFormat: data.quoteFormat,
    quoteValidityDays: data.quoteValidityDays,
    sequencePadLength: data.sequencePadLength,
    vatDefaultApplicable: data.vatDefaultApplicable,
    vatRatePercent: data.vatRatePercent,
    vatInclusive: data.vatInclusive,
    vatLabel: data.vatLabel,
    termsText: data.termsText,
    footerText: data.footerText,
    paymentInstructions: data.paymentInstructions,
    paymentAccounts: data.paymentAccounts,
    signatureCompanyLabel: data.signatureCompanyLabel,
    signatureClientLabel: data.signatureClientLabel,
    primaryColor: data.primaryColor,
    secondaryColor: data.secondaryColor,
    accentColor: data.accentColor,
    backgroundColor: data.backgroundColor,
    surfaceColor: data.surfaceColor,
    borderColor: data.borderColor,
    invoiceTemplateKey: data.invoiceTemplateKey,
    quotationTemplateKey: data.quotationTemplateKey,
    jobCardTemplateKey: data.jobCardTemplateKey,
    receiptTemplateKey: data.receiptTemplateKey,
  };

  // Conflict on orgId, not id. Rows created through Prisma carry a cuid and hold
  // the org in its own UNIQUE orgId column, so `where: { id: orgId }` matched
  // nothing and the create then died on the orgId index — branding saves failed
  // outright for every org whose row this function did not create itself. Main
  // found this against real data: six of seven rows.
  await prisma.documentBrandingSettings.upsert({
    where: { orgId },
    create: { id: orgId, ...fields },
    update: fields,
  });
}
