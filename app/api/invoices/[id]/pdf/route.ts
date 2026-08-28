import { NextRequest, NextResponse } from "next/server";
import { amountInWords } from "@/lib/amount-in-words";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { getDocumentBrandingSettings } from "@/lib/document-branding";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATDocDate } from "@/lib/date-eat";
import { compactText } from "@/lib/pdf/pdf-utils";
import { InvoiceTemplateComponent, resolveTemplateKey } from "@/lib/pdf/templates";

import { pickDocumentTerms } from "@/lib/quote-terms";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // `?inline=1` renders in the in-app preview iframe; default downloads.
  const inline = _req.nextUrl.searchParams.get("inline") === "1";
  const { user, orgId } = await requireOrgSession();
  if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, orgId },
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
      jobId: true,
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

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
  const { resolveInvoiceLogo } = await import("@/lib/pdf/pdf-utils");
  const logoUrl = await resolveInvoiceLogo();

  const subtotal = invoice.lines.reduce((s, l) => s + l.lineTotal, 0);
  const taxAmount = invoice.lines.reduce((s, l) => s + (l.taxAmount ?? 0), 0);
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
    companyTaxId: branding.companyTaxId || null,
    companyLogoUrl: logoUrl,
    documentTitle: "INVOICE",
    invoiceNumber: invoice.invoiceNumber,
    dateIssued: formatEATDocDate(issuedAtDate),
    validUntil: formatEATDocDate(dueDateVal),
    repairId: invoice.jobId ?? "—",
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
    repairCost: formatMoney(subtotal + taxAmount, currency),
    vatApplicable: taxAmount > 0,
    vatLabel: "Tax",
    vatAmount: formatMoney(taxAmount, currency),
    totalAmountPayable: formatMoney(subtotal + taxAmount, currency),
    amountWords: amountInWords(subtotal + taxAmount, currency),
    estimatedDuration: "",
    approvalStatus: invoice.status,
    recommendation: "",
    notes: invoice.notes ?? "",
    status: invoice.status,
    currency,
    termsText: pickDocumentTerms(branding.termsText, invoice.jobId ? "REPAIR" : "SALE"),
    footerText: branding.footerText ?? "",
    // Without this the Payment To block is missing, so an invoice downloaded from
    // Documents carried no bank details while the same invoice generated from the
    // job did. Customers cannot pay what they cannot see.
    paymentInstructions: branding.paymentInstructions ?? "",
    signatureCompanyLabel: "Authorized Signatory",
    signatureClientLabel: "Client Signature",
    lineItems: invoice.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: formatMoney(l.unitPrice, currency),
      discount: l.discountAmount > 0 ? formatMoney(l.discountAmount, currency) : undefined,
      lineTotal: formatMoney(l.lineTotal, currency),
    })),
    documentMode: invoice.invoiceType === "MERCHANDISE" ? "PRODUCT" : invoice.invoiceType,
    subtotalValue: formatMoney(subtotal, currency),
  });

  const pdf = await renderToBuffer(element as never);
  return new Response(new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    },
  });
}
