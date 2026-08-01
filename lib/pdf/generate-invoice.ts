import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import { getClientBill } from "@/lib/billing";
import { formatEATDocDate } from "@/lib/date-eat";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { getDocumentBrandingSettings } from "@/lib/document-branding";
import { nextAvailableInvoiceNumber } from "@/lib/commercial/document-workflow";
import { canGenerateInvoiceForStatus, formatQuotationNumber } from "@/lib/documents";
import { compactText, compactListText, prettyEnum, resolveInvoiceLogo } from "@/lib/pdf/pdf-utils";
import type { PdfLineItem } from "@/lib/pdf/pdf-line-items";
import { InvoiceTemplateComponent, resolveTemplateKey } from "@/lib/pdf/templates";
import { prisma } from "@/lib/prisma";

export type GenerateInvoiceResult =
  | { ok: true; buffer: Buffer; filename: string; invoiceNumber: string; clientPhone: string }
  | { ok: false; error: string };

export type GenerateInvoiceOptions = {
  /** HTTP download: create/update Invoice row with org-scoped numbering */
  persistInvoiceRecord?: boolean;
  /** Skip all DB writes (read-only re-download of an existing invoice) */
  skipPersist?: boolean;
};

export async function generateInvoiceBuffer(
  jobId: string,
  staffName: string,
  staffRole: string,
  staffUserId?: string,
  expectedOrgId?: string,
  options: GenerateInvoiceOptions = {},
): Promise<GenerateInvoiceResult> {
  const job = await prisma.job.findUnique({
    where: expectedOrgId ? { id: jobId, orgId: expectedOrgId } : { id: jobId },
    select: {
      id: true, jobNumber: true, status: true, repairPath: true,
      invoiceNumber: true, invoiceIssuedAt: true,
      orgId: true,
      deviceType: true, brand: true, model: true, serialOrImei: true,
      accessories: true, physicalNotes: true, issueDescription: true,
      diagnosisNotes: true, externalDiagnosis: true, recommendedRepair: true,
      recommendationOption: true, clientConversationNote: true,
      partsNeeded: true, clientBill: true, vatApplicable: true,
      workDone: true, partsReplaced: true,
      clientApproved: true, approvalDate: true, quotedAt: true,
      repairTimeline: true, timelineNote: true, technicianNotes: true, statusNote: true,
      receivedAt: true, completedAt: true, closedAt: true,
      client: { select: { id: true, fullName: true, phone: true, email: true, organization: true } },
    },
  });

  if (!job) return { ok: false, error: "Job not found" };
  if (!canGenerateInvoiceForStatus(job.status)) {
    return { ok: false, error: "Invoice can only be generated after repair reaches pickup/completion stage" };
  }

  // Pull Invoice record (if one exists) to get line items and document type
  const invoiceRecord = await prisma.invoice.findUnique({
    where: { jobId: job.id },
    select: {
      invoiceType: true,
      lines: {
        select: {
          description: true, quantity: true, unitPrice: true,
          discountAmount: true, lineTotal: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  }).catch(() => null);

  const orgId = job.orgId ?? undefined;
  const org = orgId ? await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true, baseCurrency: true } }).catch(() => null) : null;
  const currency = normalizeCurrency(org?.baseCurrency, "UGX");
  const branding = await getDocumentBrandingSettings(orgId);
  const templateKey = resolveTemplateKey({
    kind: "INVOICE",
    requestedKey: (branding as unknown as { invoiceTemplateKey?: string | null }).invoiceTemplateKey,
    plan: org?.plan ?? "STARTER",
  });
  const InvoiceDoc = InvoiceTemplateComponent(templateKey);
  const clientBill = getClientBill(job) ?? 0;
  const vatApplicable = job.vatApplicable ?? true;
  const vatRate = Math.max(0, branding.vatRatePercent) / 100;
  const repairCost = vatApplicable && clientBill > 0 ? clientBill / (1 + vatRate) : clientBill;
  const vatAmount = vatApplicable ? Math.max(clientBill - repairCost, 0) : 0;

  // Build line items from Invoice.lines (if any)
  const rawLines = invoiceRecord?.lines ?? [];
  const lineItems: PdfLineItem[] | undefined = rawLines.length > 0
    ? rawLines.map((l) => ({
        description: l.description,
        quantity:    l.quantity,
        unitPrice:   formatMoney(l.unitPrice, currency),
        discount:    l.discountAmount > 0 ? formatMoney(l.discountAmount, currency) : undefined,
        lineTotal:   formatMoney(l.lineTotal, currency),
      }))
    : undefined;

  // Determine document mode from invoice type
  const invType = invoiceRecord?.invoiceType;
  const documentMode =
    invType === "MERCHANDISE" ? "PRODUCT" :
    invType === "SERVICE"     ? "SERVICE" :
    invType === "CONTRACT"    ? "CONTRACT" :
    "REPAIR";
  const issuedAtDate = new Date();
  const dueDate = new Date(issuedAtDate);
  dueDate.setDate(dueDate.getDate() + branding.quoteValidityDays);
  const logoUrl = await resolveInvoiceLogo();
  const normalizedFooterText = (branding.footerText ?? "").trim();
  const issuedAtForNumber = job.invoiceIssuedAt ?? issuedAtDate;
  const quotationNumber = formatQuotationNumber(
    job.jobNumber, issuedAtForNumber, branding.quotePrefix,
    branding.quoteFormat, branding.sequencePadLength,
  );
  const preferredInvoiceNumber = job.invoiceNumber?.trim() || `INV-${quotationNumber.replace(/\s+/g, "-")}`;
  let invoiceNumber = preferredInvoiceNumber;
  const invoiceTotal = clientBill;

  if (options.skipPersist) {
    invoiceNumber = job.invoiceNumber?.trim() || preferredInvoiceNumber;
  } else if (options.persistInvoiceRecord && orgId) {
    try {
      invoiceNumber = await prisma.$transaction(async (tx) => {
        const existingInvoice = await tx.invoice.findFirst({
          where: { orgId, jobId: job.id },
          select: { id: true, invoiceNumber: true },
        });
        const safeInvoiceNumber = await nextAvailableInvoiceNumber(
          tx,
          existingInvoice?.invoiceNumber ?? preferredInvoiceNumber,
          existingInvoice?.id,
        );

        if (existingInvoice) {
          await tx.invoice.update({
            where: { id: existingInvoice.id },
            data: {
              invoiceNumber: safeInvoiceNumber,
              issuedAt: issuedAtDate,
              totalAmount: invoiceTotal,
              status: invoiceTotal <= 0 ? "PAID" : "ISSUED",
            },
          });
        } else {
          await tx.invoice.create({
            data: {
              orgId,
              jobId: job.id,
              invoiceNumber: safeInvoiceNumber,
              issuedAt: issuedAtDate,
              totalAmount: invoiceTotal,
              status: invoiceTotal <= 0 ? "PAID" : "ISSUED",
            },
          });
        }

        await tx.job.update({
          where: { id: job.id },
          data: {
            invoiceIssuedAt: issuedAtDate,
            invoiceNumber: safeInvoiceNumber,
          },
        });

        return safeInvoiceNumber;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to persist invoice record";
      return { ok: false, error: message };
    }

    if (staffUserId) {
      await prisma.auditLog.create({
        data: {
          jobId: job.id,
          userId: staffUserId,
          action: "INVOICE_GENERATED",
          detail: JSON.stringify({ invoiceNumber }),
          orgId: job.orgId,
        },
      }).catch(() => null);
    }
  } else if (staffUserId) {
    invoiceNumber = `INV-${quotationNumber.replace(/\s+/g, "-")}`;
    await prisma.$transaction([
      prisma.job.update({
        where: { id: job.id },
        data: { invoiceIssuedAt: issuedAtDate, invoiceNumber },
      }),
      prisma.auditLog.create({
        data: {
          jobId: job.id,
          userId: staffUserId,
          action: "INVOICE_GENERATED",
          detail: JSON.stringify({ invoiceNumber }),
          orgId: job.orgId,
        },
      }),
    ]).catch(() => null);
  }

  const docElement = createElement(InvoiceDoc as never, {
    companyName: branding.companyName,
    companyTagline: branding.companyTagline ?? "",
    companyAddressLine1: branding.companyAddressLine1,
    companyAddressLine2: branding.companyAddressLine2,
    companyContacts: branding.companyContacts,
    companyEmail: branding.companyEmail ?? "",
    companyWebsite: branding.companyWebsite ?? "",
    companyLogoUrl: logoUrl,
    documentTitle: "INVOICE",
    quotationNumber,
    invoiceNumber,
    dateIssued: formatEATDocDate(issuedAtDate),
    validUntil: formatEATDocDate(dueDate),
    repairId: job.jobNumber,
    preparedByName: staffName,
    preparedByRole: staffRole,
    clientName: job.client.fullName,
    clientPhone: job.client.phone,
    clientEmail: compactText(job.client.email, 36),
    clientOrganization: compactText(job.client.organization, 40),
    deviceType: prettyEnum(job.deviceType),
    deviceLabel: compactText(`${job.brand} ${job.model}`, 45),
    serialOrImei: compactText(job.serialOrImei, 30),
    accessories: compactText(job.accessories, 60),
    physicalCondition: compactText(job.physicalNotes, 80),
    customerIssue: compactListText(job.issueDescription, 180),
    diagnosisSummary: compactListText(job.diagnosisNotes ?? job.externalDiagnosis, 180),
    scopeOfWork: compactListText(job.recommendedRepair ?? job.workDone, 180),
    workDone: compactListText(job.workDone, 180),
    partsReplaced: compactListText(job.partsReplaced, 180),
    repairCost: formatMoney(repairCost, currency),
    vatApplicable,
    vatLabel: `${branding.vatLabel ?? "VAT"} (${branding.vatRatePercent ?? 0}%)`,
    vatAmount: formatMoney(vatAmount, currency),
    totalAmountPayable: formatMoney(clientBill, currency),
    estimatedDuration: compactText(job.repairTimeline ?? job.timelineNote, 60),
    approvalStatus: job.clientApproved === true ? "Approved" : "Not recorded",
    recommendation: compactText(job.recommendationOption ?? job.recommendedRepair, 80),
    notes: compactListText(job.technicianNotes ?? job.statusNote, 160),
    isPaid: job.clientApproved === true,
    status: prettyEnum(job.status),
    currency,
    termsText: branding.termsText ?? "",
    footerText: normalizedFooterText,
    signatureCompanyLabel: branding.signatureCompanyLabel ?? "Company",
    signatureClientLabel: branding.signatureClientLabel ?? "Client",
    lineItems,
    documentMode,
    subtotalValue: lineItems ? formatMoney(repairCost, currency) : undefined,
  });

  try {
    const pdf = await renderToBuffer(docElement as never);
    return {
      ok: true,
      buffer: Buffer.from(pdf),
      filename: `invoice-${job.jobNumber}.pdf`,
      invoiceNumber,
      clientPhone: job.client.phone,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PDF generation error";
    return { ok: false, error: `Invoice PDF generation failed: ${message}` };
  }
}
