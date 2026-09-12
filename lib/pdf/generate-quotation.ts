import { createElement } from "react";
import { amountInWords } from "@/lib/amount-in-words";
import { renderToBuffer } from "@react-pdf/renderer";

import { getClientBill } from "@/lib/billing";
import { formatEATDocDate } from "@/lib/date-eat";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { getDocumentBrandingSettings } from "@/lib/document-branding";
import { canGenerateQuotationForStatus, deriveDocNumberFromJob } from "@/lib/documents";
import { compactText, compactListText, prettyEnum, resolvePdfLogo } from "@/lib/pdf/pdf-utils";
import { QuotationTemplateComponent, resolveTemplateKey } from "@/lib/pdf/templates";
import { nextDocumentNumber } from "@/lib/commercial/document-workflow";
import { prisma } from "@/lib/prisma";

import { quotationTerms } from "@/lib/quote-terms";
import { defaultQuotationPromo } from "@/lib/pdf/QuotationPromoStrip";
export type GenerateQuotationResult =
  | { ok: true; buffer: Buffer; filename: string; quotationNumber: string; clientPhone: string }
  | { ok: false; error: string };

export async function generateQuotationBuffer(
  jobId: string,
  staffName: string,
  staffRole: string,
  stampQuotedAt = false,
  staffUserId?: string,
  expectedOrgId?: string,
): Promise<GenerateQuotationResult> {
  const job = await prisma.job.findUnique({
    where: expectedOrgId ? { id: jobId, orgId: expectedOrgId } : { id: jobId },
    select: {
      id: true, jobNumber: true, status: true, repairPath: true,
      orgId: true,
      deviceType: true, brand: true, model: true, serialOrImei: true,
      accessories: true, physicalNotes: true, issueDescription: true,
      diagnosisNotes: true, externalDiagnosis: true, recommendedRepair: true,
      recommendationOption: true, clientConversationNote: true, partsNeeded: true,
      clientBill: true, vatApplicable: true, clientApproved: true,
      quotedAt: true, quotationNumber: true, repairTimeline: true, workDone: true,
      client: { select: { id: true, fullName: true, phone: true, email: true, organization: true } },
    },
  });

  if (!job) return { ok: false, error: "Job not found" };
  if (!canGenerateQuotationForStatus(job.status)) {
    return { ok: false, error: "Quotation can only be generated after diagnosis starts" };
  }

  const orgId = job.orgId ?? undefined;
  const org = orgId ? await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true, baseCurrency: true } }).catch(() => null) : null;
  const currency = normalizeCurrency(org?.baseCurrency, "UGX");
  const branding = await getDocumentBrandingSettings(orgId);
  const templateKey = resolveTemplateKey({
    kind: "QUOTATION",
    requestedKey: (branding as unknown as { quotationTemplateKey?: string | null }).quotationTemplateKey,
    plan: org?.plan ?? "STARTER",
  });
  const QuoteDoc = QuotationTemplateComponent(templateKey);
  const bill = getClientBill(job) ?? 0;
  const vatApplicable = job.vatApplicable ?? true;
  const vatRate = Math.max(0, branding.vatRatePercent) / 100;
  const repairCost = vatApplicable && bill > 0 ? bill / (1 + vatRate) : bill;
  const vatAmount = vatApplicable ? Math.max(bill - repairCost, 0) : 0;
  const issuedAtDate = job.quotedAt ?? new Date();
  const dueDate = new Date(issuedAtDate);
  dueDate.setDate(dueDate.getDate() + branding.quoteValidityDays);
  const logoUrl = await resolvePdfLogo();
  // A quotation number, once printed, must never change — the customer is
  // holding that PDF. So it is allocated once, stored on the job, and reused by
  // every later render. Deriving it from the job number, which is what this did,
  // meant it inherited whatever shape job numbering happened to have that month.
  const storedQuotationNumber = job.quotationNumber?.trim() || null;
  // Read-only and portal renders never write, so they have nothing to allocate
  // from; the derived number stands in until a real send stores a real one.
  let quotationNumber = storedQuotationNumber ?? deriveDocNumberFromJob(job.jobNumber, "QT");

  if (!storedQuotationNumber && stampQuotedAt && orgId) {
    try {
      quotationNumber = await prisma.$transaction(async (tx) => {
        // Re-read inside the transaction: two sends racing on the same job must
        // not each allocate, or the customer gets two numbers for one quote.
        const fresh = await tx.job.findUnique({
          where: { id: job.id },
          select: { quotationNumber: true },
        });
        const already = fresh?.quotationNumber?.trim();
        if (already) return already;

        const allocated = await nextDocumentNumber(tx, "QT", "quotation", orgId);
        await tx.job.update({
          where: { id: job.id },
          data: { quotationNumber: allocated },
        });
        return allocated;
      });
    } catch {
      // Allocation failed; the derived number still prints a usable document.
    }
  }

  if (stampQuotedAt && !job.quotedAt) {
    await prisma.job.update({ where: { id: job.id }, data: { quotedAt: issuedAtDate } });
    if (staffUserId) {
      await prisma.auditLog.create({
        data: {
          jobId: job.id, userId: staffUserId,
          action: "QUOTATION_GENERATED",
          detail: JSON.stringify({ quotationNumber }),
          orgId: job.orgId,
        },
      });
    }
  }

  const docElement = createElement(QuoteDoc as never, {
    companyName: branding.companyName,
    companyTagline: branding.companyTagline ?? "",
    companyAddressLine1: branding.companyAddressLine1,
    companyAddressLine2: branding.companyAddressLine2,
    companyContacts: branding.companyContacts,
    companyEmail: branding.companyEmail ?? "",
    companyWebsite: branding.companyWebsite ?? "",
    companyTaxId: branding.companyTaxId || null,
    companyLogoUrl: logoUrl,
    paymentInstructions: (branding as unknown as { paymentInstructions?: string | null }).paymentInstructions ?? "",
    quotationNumber,
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
    accessories: compactText(job.accessories, 45),
    physicalCondition: compactText(job.physicalNotes, 45),
    customerIssue: compactText(job.issueDescription, 85),
    diagnosisSummary: compactListText(job.diagnosisNotes ?? job.externalDiagnosis, 180),
    scopeOfWork: compactListText(
      [job.recommendedRepair, job.partsNeeded, job.workDone].filter(Boolean).join("\n") ||
        "To be confirmed after client approval",
      260,
    ),
    repairCost: formatMoney(repairCost, currency),
    vatApplicable,
    vatLabel: `${branding.vatLabel} (${branding.vatRatePercent}%)`,
    vatAmount: formatMoney(vatAmount, currency),
    totalAmountPayable: formatMoney(bill, currency),
    amountWords: amountInWords(bill, currency),
    estimatedDuration: compactText(job.repairTimeline, 35),
    approvalStatus:
      job.clientApproved === true ? "Approved"
      : job.clientApproved === false ? "Declined"
      : "Awaiting Approval",
    recommendation: job.recommendationOption
      ? compactListText(prettyEnum(job.recommendationOption), 120)
      : "",
    notes: compactListText(job.clientConversationNote, 180),
    status: prettyEnum(job.status),
    currency,
    termsText: quotationTerms(branding.termsText, "REPAIR"),
    promo: defaultQuotationPromo(branding.companyName),
    footerText: branding.footerText,
    signatureCompanyLabel: branding.signatureCompanyLabel,
    signatureClientLabel: branding.signatureClientLabel,
  });

  const pdf = await renderToBuffer(docElement as never);
  return {
    ok: true,
    buffer: Buffer.from(pdf),
    filename: `quotation-${job.jobNumber}.pdf`,
    quotationNumber,
    clientPhone: job.client.phone,
  };
}
