import { prisma } from "@/lib/prisma";
import { tableColumns } from "@/lib/db/introspect";

export const defaultBranding = {
  id: "singleton",
  companyName: "",
  companyTagline: "",
  companyAddressLine1: "",
  companyAddressLine2: "",
  companyContacts: "",
  companyEmail: "",
  companyWebsite: "",
  companyTaxId: "",
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
    "We supply equipment and carry out repairs; only the terms relevant to this document apply.\nGoods are subject to stock availability and carry the manufacturer warranty only, where applicable.\nRepair work is carried out only after approval is recorded, and parts availability may affect the timeline.\nPre-existing or hidden faults may affect the outcome of a repair.\nUncollected devices may attract storage fees after notice.",
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
  secondaryColor: "#C9A227",
  accentColor: "#C9A227",
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

let rawTableEnsured = false;

function hasDelegate() {
  return Boolean((prisma as unknown as { documentBrandingSettings?: unknown }).documentBrandingSettings);
}

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

async function ensureRawTable() {
  if (rawTableEnsured) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DocumentBrandingSettings" (
      id TEXT PRIMARY KEY,
      companyName TEXT NOT NULL,
      companyTagline TEXT,
      companyAddressLine1 TEXT NOT NULL,
      companyAddressLine2 TEXT NOT NULL,
      companyContacts TEXT NOT NULL,
      companyEmail TEXT,
      companyWebsite TEXT,
      companyTaxId TEXT,
      documentTitle TEXT NOT NULL,
      quotePrefix TEXT NOT NULL,
      quoteFormat TEXT NOT NULL,
      quoteValidityDays INTEGER NOT NULL,
      sequencePadLength INTEGER NOT NULL,
      vatDefaultApplicable BOOLEAN NOT NULL,
      vatRatePercent REAL NOT NULL,
      vatInclusive BOOLEAN NOT NULL DEFAULT 0,
      vatLabel TEXT NOT NULL,
      termsText TEXT NOT NULL,
      footerText TEXT NOT NULL,
      signatureCompanyLabel TEXT NOT NULL,
      signatureClientLabel TEXT NOT NULL,
      invoiceTemplateKey TEXT NOT NULL DEFAULT 'invoice_classic',
      quotationTemplateKey TEXT NOT NULL DEFAULT 'quote_classic',
      jobCardTemplateKey TEXT NOT NULL DEFAULT 'job_card_classic',
      receiptTemplateKey TEXT NOT NULL DEFAULT 'receipt_classic',
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Older installs may have the table without the newer template columns.
  // Keep this local to branding to avoid hard dependency on /api/admin/db-fix.
  const colSet = await tableColumns("DocumentBrandingSettings");

  // Allowlist guards against accidental SQL injection if call sites ever change.
  const ADDABLE_COLUMNS: ReadonlySet<string> = new Set([
    "invoiceTemplateKey", "quotationTemplateKey", "jobCardTemplateKey", "receiptTemplateKey",
    "primaryColor", "secondaryColor", "accentColor", "backgroundColor", "surfaceColor", "borderColor",
    "orgId", "vatInclusive", "paymentInstructions", "paymentAccounts", "companyTaxId",
  ]);
  const addColumn = async (name: string, dflt: string, type = "TEXT") => {
    if (!ADDABLE_COLUMNS.has(name)) return;
    if (colSet.has(name)) return;
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "DocumentBrandingSettings" ADD COLUMN "${name}" ${type} DEFAULT ${dflt}`,
    ).catch(() => {/* ignore if already exists in concurrent request */});
    colSet.add(name);
  };
  await addColumn("invoiceTemplateKey", "'invoice_classic'");
  await addColumn("quotationTemplateKey", "'quote_classic'");
  await addColumn("jobCardTemplateKey", "'job_card_classic'");
  await addColumn("receiptTemplateKey", "'receipt_classic'");
  await addColumn("primaryColor",   "'#000000'");
  await addColumn("secondaryColor", "'#C9A227'");
  await addColumn("accentColor",    "'#C9A227'");
  await addColumn("backgroundColor","'#FFFFFF'");
  await addColumn("surfaceColor",   "'#F5F5F5'");
  await addColumn("borderColor",    "'#E5E5E5'");
  await addColumn("orgId",          "NULL");
  await addColumn("vatInclusive",   "0", "BOOLEAN");
  await addColumn("paymentInstructions", "''");
  await addColumn("paymentAccounts", "''");
  // NULL, not '': an org with no TIN should print nothing at all rather than an
  // empty "TIN:" label on every document it issues.
  await addColumn("companyTaxId", "NULL");

  rawTableEnsured = true;
}

async function getViaRaw(orgId?: string) {
  try {
    await ensureRawTable();

    // Try org-specific row first (id = orgId), then legacy singleton
    const rows = orgId
      ? await prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT *
          FROM "DocumentBrandingSettings"
          WHERE id = ${orgId} OR orgId = ${orgId} OR id = 'singleton'
          ORDER BY CASE WHEN id = ${orgId} OR orgId = ${orgId} THEN 0 ELSE 1 END
          LIMIT 1
        `
      : await prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT * FROM "DocumentBrandingSettings" WHERE id = 'singleton' LIMIT 1
        `;

    if (!rows[0]) {
      await prisma.$executeRaw`
        INSERT INTO "DocumentBrandingSettings" (
          id, companyName, companyTagline, companyAddressLine1, companyAddressLine2,
          companyContacts, companyEmail, companyWebsite, companyTaxId, documentTitle,
          quotePrefix, quoteFormat, quoteValidityDays, sequencePadLength,
          vatDefaultApplicable, vatRatePercent, vatInclusive, vatLabel, termsText,
          footerText, signatureCompanyLabel, signatureClientLabel,
          invoiceTemplateKey, quotationTemplateKey, jobCardTemplateKey, receiptTemplateKey,
          updatedAt
        ) VALUES (
          ${defaultBranding.id}, ${defaultBranding.companyName}, ${defaultBranding.companyTagline},
          ${defaultBranding.companyAddressLine1}, ${defaultBranding.companyAddressLine2},
          ${defaultBranding.companyContacts}, ${defaultBranding.companyEmail}, ${defaultBranding.companyWebsite}, ${defaultBranding.companyTaxId},
          ${defaultBranding.documentTitle}, ${defaultBranding.quotePrefix}, ${defaultBranding.quoteFormat},
          ${defaultBranding.quoteValidityDays}, ${defaultBranding.sequencePadLength},
          ${defaultBranding.vatDefaultApplicable}, ${defaultBranding.vatRatePercent}, ${defaultBranding.vatInclusive}, ${defaultBranding.vatLabel},
          ${defaultBranding.termsText}, ${defaultBranding.footerText},
          ${defaultBranding.signatureCompanyLabel}, ${defaultBranding.signatureClientLabel},
          ${defaultBranding.invoiceTemplateKey}, ${defaultBranding.quotationTemplateKey}, ${defaultBranding.jobCardTemplateKey}, ${defaultBranding.receiptTemplateKey},
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(id) DO NOTHING
      `;
      return defaultBranding;
    }

    return coerceRow(rows[0]);
  } catch {
    return defaultBranding;
  }
}

export async function saveDocumentBrandingSettings(orgId: string, data: BrandingSettings) {
  // Always use raw SQL — handles both SQLite and Turso, and is immune to schema drift
  // because ensureRawTable() adds any missing columns before we write.
  await ensureRawTable();

  // The row id, which is NOT always the orgId. Rows created through Prisma carry
  // a cuid and hold the orgId in its own column, and orgId is UNIQUE. Inserting
  // with id = orgId therefore did not collide on id, so ON CONFLICT(id) never
  // fired and the write died on the orgId index instead: saving branding
  // settings failed outright for every org whose row this function did not
  // create itself — six of the seven rows in this database. Resolving the
  // existing row's id first makes the conflict target the row that is actually
  // there, and falls back to the orgId for a genuinely new one.
  const existing: Array<{ id: string }> = await prisma.$queryRawUnsafe(
    `SELECT id FROM "DocumentBrandingSettings" WHERE orgId = ? LIMIT 1`,
    orgId,
  );
  const rowId = existing[0]?.id ?? orgId;

  await prisma.$executeRaw`
    INSERT INTO "DocumentBrandingSettings" (
      id, orgId,
      companyName, companyTagline, companyAddressLine1, companyAddressLine2,
      companyContacts, companyEmail, companyWebsite, companyTaxId, documentTitle,
      quotePrefix, quoteFormat, quoteValidityDays, sequencePadLength,
      vatDefaultApplicable, vatRatePercent, vatInclusive, vatLabel, termsText,
      footerText, paymentInstructions, paymentAccounts, signatureCompanyLabel, signatureClientLabel,
      primaryColor, secondaryColor, accentColor, backgroundColor, surfaceColor, borderColor,
      invoiceTemplateKey, quotationTemplateKey, jobCardTemplateKey, receiptTemplateKey,
      updatedAt
    ) VALUES (
      ${rowId}, ${orgId},
      ${data.companyName}, ${data.companyTagline},
      ${data.companyAddressLine1}, ${data.companyAddressLine2},
      ${data.companyContacts}, ${data.companyEmail}, ${data.companyWebsite}, ${data.companyTaxId},
      ${data.documentTitle}, ${data.quotePrefix}, ${data.quoteFormat},
      ${data.quoteValidityDays}, ${data.sequencePadLength},
      ${data.vatDefaultApplicable}, ${data.vatRatePercent}, ${data.vatInclusive}, ${data.vatLabel},
      ${data.termsText}, ${data.footerText}, ${data.paymentInstructions}, ${data.paymentAccounts}, ${data.signatureCompanyLabel},
      ${data.signatureClientLabel},
      ${data.primaryColor}, ${data.secondaryColor}, ${data.accentColor},
      ${data.backgroundColor}, ${data.surfaceColor}, ${data.borderColor},
      ${data.invoiceTemplateKey}, ${data.quotationTemplateKey},
      ${data.jobCardTemplateKey}, ${data.receiptTemplateKey},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(id) DO UPDATE SET
      orgId = excluded.orgId,
      companyName = excluded.companyName,
      companyTagline = excluded.companyTagline,
      companyAddressLine1 = excluded.companyAddressLine1,
      companyAddressLine2 = excluded.companyAddressLine2,
      companyContacts = excluded.companyContacts,
      companyEmail = excluded.companyEmail,
      companyWebsite = excluded.companyWebsite,
      companyTaxId = excluded.companyTaxId,
      documentTitle = excluded.documentTitle,
      quotePrefix = excluded.quotePrefix,
      quoteFormat = excluded.quoteFormat,
      quoteValidityDays = excluded.quoteValidityDays,
      sequencePadLength = excluded.sequencePadLength,
      vatDefaultApplicable = excluded.vatDefaultApplicable,
      vatRatePercent = excluded.vatRatePercent,
      vatInclusive = excluded.vatInclusive,
      vatLabel = excluded.vatLabel,
      termsText = excluded.termsText,
      footerText = excluded.footerText,
      paymentInstructions = excluded.paymentInstructions,
      paymentAccounts = excluded.paymentAccounts,
      signatureCompanyLabel = excluded.signatureCompanyLabel,
      signatureClientLabel = excluded.signatureClientLabel,
      primaryColor = excluded.primaryColor,
      secondaryColor = excluded.secondaryColor,
      accentColor = excluded.accentColor,
      backgroundColor = excluded.backgroundColor,
      surfaceColor = excluded.surfaceColor,
      borderColor = excluded.borderColor,
      invoiceTemplateKey = excluded.invoiceTemplateKey,
      quotationTemplateKey = excluded.quotationTemplateKey,
      jobCardTemplateKey = excluded.jobCardTemplateKey,
      receiptTemplateKey = excluded.receiptTemplateKey,
      updatedAt = CURRENT_TIMESTAMP
  `;
}

export async function getDocumentBrandingSettings(orgId?: string): Promise<BrandingSettings> {
  return getViaRaw(orgId);
}
