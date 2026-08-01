import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getDocumentBrandingSettings } from "@/lib/document-branding";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATDocDate } from "@/lib/date-eat";
import { compactText } from "@/lib/pdf/pdf-utils";
import { InvoiceTemplateComponent, resolveTemplateKey } from "@/lib/pdf/templates";
import type { PdfLineItem } from "@/lib/pdf/pdf-line-items";

export type GenerateStandaloneInvoiceResult =
  | { ok: true; buffer: Buffer; filename: string }
  | { ok: false; error: string };

export async function generateStandaloneInvoiceBuffer(
  invoiceId: string,
  expectedOrgId?: string,
): Promise<GenerateStandaloneInvoiceResult> {
  const invoice = await prisma.invoice.findFirst({
    where: expectedOrgId ? { id: invoiceId, orgId: expectedOrgId } : { id: invoiceId },
    select: {
      id: true,
      orgId: true,
      invoiceNumber: true,
      invoiceType: true,
      subject: true,
      issuedAt: true,
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
      notes: true,
      currency: true,
      status: true,
      lines: {
        select: {
          description: true,
          quantity: true,
          unitPrice: true,
          discountAmount: true,
          lineTotal: true,
          taxAmount: true,
        },
        orderBy: { createdAt: "asc" },
      },
      client: {
        select: {
          fullName: true,
          phone: true,
          email: true,
          organization: true,
          address: true,
        },
      },
    },
  });

  if (!invoice) return { ok: false, error: "Invoice not found" };
  if (invoice.status === "VOID") {
    return { ok: false, error: "Cannot generate PDF for voided invoice" };
  }

  const orgId = invoice.orgId ?? undefined;
  const org = orgId
    ? await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true, baseCurrency: true } }).catch(() => null)
    : null;
  const currency = normalizeCurrency(invoice.currency ?? org?.baseCurrency, "UGX");
  const branding = await getDocumentBrandingSettings(orgId);
  const templateKey = resolveTemplateKey({
    kind: "INVOICE",
    requestedKey: (branding as unknown as { invoiceTemplateKey?: string | null }).invoiceTemplateKey,
    plan: org?.plan ?? "STARTER",
  });
  const InvoiceDoc = InvoiceTemplateComponent(templateKey);
  const logoUrl = await (await import("@/lib/pdf/pdf-utils")).resolveInvoiceLogo();

  const rawLines = invoice.lines ?? [];
  const lineItems: PdfLineItem[] | undefined = rawLines.length > 0
    ? rawLines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: formatMoney(l.unitPrice, currency),
        discount: l.discountAmount > 0 ? formatMoney(l.discountAmount, currency) : undefined,
        lineTotal: formatMoney(l.lineTotal, currency),
      }))
    : undefined;

  const subtotal = rawLines.reduce((s, l) => s + l.lineTotal, 0);
  const taxAmount = rawLines.reduce((s, l) => s + (l.taxAmount ?? 0), 0);
  const total = subtotal + taxAmount;
  const issuedAtDate = invoice.issuedAt ?? new Date();
  const dueDateVal = invoice.dueDate ?? new Date(issuedAtDate.getTime() + 14 * 86400000);
  const client = invoice.client;

  const element = createElement(InvoiceDoc as never, {
    companyName: branding.companyName,
    companyTagline: branding.companyTagline ?? "",
    companyAddressLine1: branding.companyAddressLine1,
    companyAddressLine2: branding.companyAddressLine2,
    companyContacts: branding.companyContacts,
    companyEmail: branding.companyEmail ?? "",
    companyWebsite: branding.companyWebsite ?? "",
    companyLogoUrl: logoUrl,
    documentTitle: "INVOICE",
    invoiceNumber: invoice.invoiceNumber,
    dateIssued: formatEATDocDate(issuedAtDate),
    validUntil: formatEATDocDate(dueDateVal),
    repairId: "—",
    preparedByName: "Office",
    preparedByRole: "System",
    clientName: client?.fullName ?? "—",
    clientPhone: client?.phone ?? "",
    clientEmail: client?.email ?? "",
    clientOrganization: client?.organization ?? "",
    deviceType: invoice.invoiceType,
    deviceLabel: compactText(invoice.subject ?? invoice.invoiceType, 60),
    serialOrImei: "",
    accessories: "",
    physicalCondition: "",
    customerIssue: invoice.notes ?? "",
    diagnosisSummary: "",
    scopeOfWork: "",
    repairCost: formatMoney(total, currency),
    vatApplicable: taxAmount > 0,
    vatLabel: "Tax",
    vatAmount: formatMoney(taxAmount, currency),
    totalAmountPayable: formatMoney(total, currency),
    estimatedDuration: "",
    approvalStatus: invoice.status,
    recommendation: "",
    notes: invoice.notes ?? "",
    status: invoice.status,
    currency,
    termsText: branding.termsText ?? "",
    footerText: branding.footerText ?? "",
    signatureCompanyLabel: "Authorized Signatory",
    signatureClientLabel: "Client Signature",
    lineItems,
    documentMode: invoice.invoiceType === "MERCHANDISE" ? "PRODUCT" : invoice.invoiceType,
    subtotalValue: formatMoney(subtotal, currency),
  });

  const pdf = await renderToBuffer(element as never);
  return {
    ok: true,
    buffer: pdf,
    filename: `invoice-${invoice.invoiceNumber}.pdf`,
  };
}
