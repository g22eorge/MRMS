import { OutboundMessageType } from "@prisma/client";
import React, { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATDocDate } from "@/lib/date-eat";
import { renderCommunicationTemplate } from "@/lib/notifications/templates";
import { getClientStatement } from "@/lib/commercial/statements";
import { deliverOutboundMessage, enqueueEmailMessage, enqueueWhatsAppMessage } from "@/lib/notifications/whatsapp-outbox";
import { getWhatsAppConfigForOrg, sendWhatsAppDocument, uploadWhatsAppMedia } from "@/lib/notifications/whatsapp";
import { sendEmail } from "@/lib/notifications/email";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { creditNoteParent } from "@/lib/commercial/credit-note-parent";
import { getDocumentBrandingSettings } from "@/lib/document-branding";
import { resolveInvoiceLogo } from "@/lib/pdf/pdf-utils";
import { generateInvoiceBuffer } from "@/lib/pdf/generate-invoice";
import { generateQuotationBuffer } from "@/lib/pdf/generate-quotation";
import { generateStatementBuffer } from "@/lib/pdf/generate-statement";
import { ReceiptTemplateComponent, resolveTemplateKey } from "@/lib/pdf/templates";
import { EagleInfoDocument, type EagleInfoLineItem } from "@/lib/pdf/EagleInfoDocument";
import { DeliveryNoteDocument } from "@/lib/pdf/DeliveryNoteDocument";
import { clientContactName } from "@/lib/client-name";
import { pickDocumentTerms } from "@/lib/quote-terms";

export type DocumentShareChannel = "whatsapp" | "email";

export type DocumentRecipient = {
  fullName: string;
  phone: string | null;
  email: string | null;
};

/** Prefer job-linked client, then invoice client, then sale client, then credit-note sale client. */
export function resolveLinkedDocumentRecipient(sources: {
  jobClient?: DocumentRecipient | null;
  invoiceClient?: DocumentRecipient | null;
  saleClient?: DocumentRecipient | null;
  creditNoteSaleClient?: DocumentRecipient | null;
}): DocumentRecipient | null {
  return (
    sources.jobClient ??
    sources.invoiceClient ??
    sources.saleClient ??
    sources.creditNoteSaleClient ??
    null
  );
}

export function documentPdfUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Where to send a customer for a document.
 *
 * NOT an /api/... path: every document PDF route is behind requireOrgSession,
 * so a customer clicking one lands on a staff login screen. The portal is the
 * only place they can authenticate and read their own documents.
 */
function portalDocumentsUrl(): string {
  return documentPdfUrl("/portal/documents");
}

const WHATSAPP_PDF_DOCUMENT_KEY = "WHATSAPP_PDF_DOCUMENT";

const DEFAULT_BRANDING = {
  companyName: "",
  companyTagline: null as string | null,
  companyAddressLine1: "",
  companyAddressLine2: "",
  companyContacts: "",
  companyEmail: null as string | null,
  companyWebsite: null as string | null,
  companyTaxId: null as string | null,
  paymentInstructions: null as string | null,
  termsText: "",
  footerText: null as string | null,
} as const;

/**
 * Send a pre-rendered PDF buffer as a WhatsApp document or email attachment.
 * Creates an outbox row before provider delivery (per outbox convention), then
 * attempts immediate delivery. Falls back to direct send if the outbox table
 * is not yet deployed.
 */
async function sendDocumentAsPDF(params: {
  orgId: string;
  channel: DocumentShareChannel;
  recipient: DocumentRecipient;
  buffer: Buffer;
  filename: string;
  caption: string;
  jobId?: string | null;
}): Promise<boolean> {
  const isWhatsApp = params.channel === "whatsapp";
  const to = isWhatsApp ? params.recipient.phone : params.recipient.email;
  if (!to) return false;

  // Create outbox row before provider delivery
  let rowId: string | null = null;
  try {
    const row = await prisma.outboundMessage.create({
      data: {
        channel: isWhatsApp ? "WHATSAPP" : "EMAIL",
        status: "PENDING",
        type: OutboundMessageType.JOB_STATUS_UPDATE,
        to,
        subject: isWhatsApp ? null : params.caption,
        body: params.caption,
        templateKey: WHATSAPP_PDF_DOCUMENT_KEY,
        templateVars: null,
        provider: isWhatsApp ? "meta" : "resend",
        jobId: params.jobId ?? null,
        orgId: params.orgId,
        nextAttemptAt: new Date(),
      },
      select: { id: true },
    });
    rowId = row.id;
  } catch {
    // Outbox table may not exist; proceed with direct send
  }

  let success = false;
  let error = "";
  if (isWhatsApp) {
    const cfg = await getWhatsAppConfigForOrg(params.orgId);
    if (!cfg) {
      error = "WhatsApp not configured";
    } else {
      const upload = await uploadWhatsAppMedia(params.buffer, params.filename, "application/pdf", cfg);
      if (!upload.ok) {
        error = upload.error;
      } else {
        const send = await sendWhatsAppDocument(to, upload.mediaId, params.filename, params.caption, cfg);
        success = send.success;
        error = send.error ?? "";
      }
    }
  } else {
    const sent = await sendEmail({
      to,
      subject: params.caption,
      text: params.caption,
      attachments: [{ filename: params.filename, content: params.buffer }],
    });
    success = sent.success;
    error = sent.error ?? "";
  }

  if (rowId) {
    await prisma.outboundMessage.update({
      where: { id: rowId },
      data: {
        status: success ? "SENT" : "FAILED",
        lastError: error || null,
        sentAt: success ? new Date() : null,
        attemptCount: 1,
        lastAttemptAt: new Date(),
        lockedAt: null,
      },
    }).catch(() => null);
  }

  return success;
}

/** Resolve the staff name/role/userId for PDF branding and audit stamping. */
async function getStaffInfo(orgId: string): Promise<{ name: string; role: string; userId: string }> {
  try {
    const { user } = await requireOrgSession();
    return {
      name: user.name ?? user.email ?? "Staff",
      role: String(user.role),
      userId: user.id,
    };
  } catch {
    return { name: "Staff", role: "STAFF", userId: "" };
  }
}

async function renderInvoicePDF(
  invoice: { job: { id: string } | null },
  orgId: string,
  staff: { name: string; role: string; userId: string },
): Promise<Buffer | null> {
  if (!invoice.job?.id) return null;
  const result = await generateInvoiceBuffer(invoice.job.id, staff.name, staff.role, staff.userId, orgId);
  return result.ok ? result.buffer : null;
}

async function renderQuotationPDF(
  quotation: { job: { id: string } | null },
  orgId: string,
  staff: { name: string; role: string; userId: string },
): Promise<Buffer | null> {
  if (!quotation.job?.id) return null;
  const result = await generateQuotationBuffer(quotation.job.id, staff.name, staff.role, false, staff.userId, orgId);
  return result.ok ? result.buffer : null;
}

async function renderStatementPDF(
  orgId: string,
  clientId: string,
  baseCurrency: string,
): Promise<Buffer | null> {
  const result = await generateStatementBuffer(orgId, clientId, baseCurrency);
  return result.ok ? result.buffer : null;
}

async function renderReceiptPDF(
  orgId: string,
  payment: {
    id: string;
    amount: number;
    currency: string | null;
    method: string | null;
    reference: string | null;
    receivedAt: Date | null;
    createdBy: { name: string | null } | null;
    sale: {
      id: string;
      saleNumber: string;
      totalAmount: number;
      paidAmount: number | null;
      subtotal: number;
      discountAmount: number | null;
      vatAmount: number | null;
      taxApplicable: boolean | null;
      client: { fullName: string | null; organization: string | null; phone: string | null; address: string | null; accountNumber: string | null };
      items: { description: string; quantity: number; unitPrice: number; lineTotal: number }[];
    } | null;
    invoice: {
      id: string;
      invoiceNumber: string;
      totalAmount: number;
      paidAmount: number | null;
      lines: { description: string; quantity: number; unitPrice: number; lineTotal: number; taxAmount: number | null }[];
      job: { id: string; jobNumber: string; client: { fullName: string | null; organization: string | null; phone: string | null; address: string | null; accountNumber: string | null } } | null;
      client: { fullName: string | null; organization: string | null; phone: string | null; address: string | null; accountNumber: string | null };
    } | null;
  },
): Promise<Buffer | null> {
  try {
    const { PaymentReceiptDocument } = await import("@/lib/pdf/PaymentReceiptDocument");
    const { amountInWords } = await import("@/lib/amount-in-words");
    const [brandingRaw, logoUrl] = await Promise.all([
      getDocumentBrandingSettings(orgId).catch(() => null),
      resolveInvoiceLogo(orgId).catch(() => undefined),
    ]);
    const branding = { ...(brandingRaw ?? DEFAULT_BRANDING), companyLogoUrl: logoUrl ?? null };
    const receipt = await prisma.receipt.findFirst({
      where: { orgId, paymentId: payment.id },
      select: { receiptNumber: true },
    });
    const currency = normalizeCurrency(payment.currency ?? "", "");
    const forLabel = payment.invoice?.job?.jobNumber
      ? `Repair job ${payment.invoice.job.jobNumber} (${payment.invoice.invoiceNumber})`
      : payment.sale?.saleNumber
        ? `Sale ${payment.sale.saleNumber}`
        : payment.invoice?.invoiceNumber
          ? `Invoice ${payment.invoice.invoiceNumber}`
          : "Payment";
    const clientName = payment.invoice?.job?.client?.fullName
      ?? payment.invoice?.client?.fullName
      ?? payment.sale?.client?.fullName
      ?? null;
    const clientOrganization = payment.invoice?.job?.client?.organization
      ?? payment.invoice?.client?.organization
      ?? payment.sale?.client?.organization
      ?? null;
    const clientPhone = payment.invoice?.job?.client?.phone
      ?? payment.invoice?.client?.phone
      ?? payment.sale?.client?.phone
      ?? null;
    const clientAddress = payment.invoice?.job?.client?.address
      ?? payment.invoice?.client?.address
      ?? payment.sale?.client?.address
      ?? null;
    const clientAccountNumber = payment.invoice?.job?.client?.accountNumber
      ?? payment.invoice?.client?.accountNumber
      ?? payment.sale?.client?.accountNumber
      ?? null;
    const docTotal = payment.invoice?.totalAmount ?? payment.sale?.totalAmount ?? null;
    const docPaid = payment.invoice?.paidAmount ?? payment.sale?.paidAmount ?? null;
    const docBalance = docTotal != null && docPaid != null ? Math.max(0, docTotal - docPaid) : null;
    const sourceLines = payment.invoice?.lines?.length
      ? payment.invoice.lines
      : payment.sale?.items?.length
        ? payment.sale.items
        : [];
    const lineItems = sourceLines.map((l) => ({
      name: l.description,
      quantity: l.quantity,
      rate: formatMoney(l.unitPrice, currency),
      amount: formatMoney(l.lineTotal, currency),
    }));
    const money = (v: number | null | undefined) =>
      v != null && v !== 0 ? formatMoney(v, currency) : null;
    let subtotalLabel: string | null = null;
    let discountLabel: string | null = null;
    let vatLabel: string | null = null;
    if (payment.invoice) {
      const sub = payment.invoice.lines.reduce((s, l) => s + l.lineTotal, 0);
      const tax = payment.invoice.lines.reduce((s, l) => s + (l.taxAmount ?? 0), 0);
      subtotalLabel = formatMoney(sub, currency);
      vatLabel = money(tax);
    } else if (payment.sale) {
      subtotalLabel = formatMoney(payment.sale.subtotal, currency);
      discountLabel = money(payment.sale.discountAmount);
      vatLabel = payment.sale.taxApplicable ? money(payment.sale.vatAmount) : null;
    }
    const element = createElement(PaymentReceiptDocument as never, {
      branding: { ...branding, companyLogoUrl: logoUrl ?? null },
      receiptNumber: receipt?.receiptNumber ?? `RCPT-${payment.id.slice(0, 8).toUpperCase()}`,
      receivedAt: payment.receivedAt?.toLocaleString("en-GB") ?? "",
      method: payment.method ? payment.method.replaceAll("_", " ") : "Payment",
      reference: payment.reference ?? null,
      amountLabel: formatMoney(payment.amount, currency),
      paidLabel: docPaid != null ? formatMoney(docPaid, currency) : null,
      balanceLabel: docBalance != null ? formatMoney(docBalance, currency) : null,
      forLabel,
      receivedBy: payment.createdBy?.name ?? "Staff",
      clientName,
      clientOrganization,
      clientPhone,
      clientAddress,
      clientAccountNumber,
      lineItems,
      docTotalLabel: docTotal != null ? formatMoney(docTotal, currency) : null,
      subtotalLabel,
      discountLabel,
      vatLabel,
      amountWords: amountInWords(payment.amount, currency),
    });
    const pdf = await renderToBuffer(element as never);
    return Buffer.from(pdf);
  } catch {
    return null;
  }
}

async function renderSaleReceiptPDF(
  orgId: string,
  sale: {
    id: string;
    saleNumber: string;
    name: string | null;
    status: string | null;
    currency: string | null;
    subtotal: number;
    discountAmount: number | null;
    vatAmount: number | null;
    totalAmount: number;
    paidAmount: number | null;
    createdAt: Date;
    branch: { name: string | null } | null;
    client: { fullName: string | null; phone: string | null; organization: string | null; address: string | null; accountNumber: string | null } | null;
    items: { description: string; quantity: number; unitPrice: number; lineTotal: number }[];
    payments: { id: string; amount: number; method: string | null; reference: string | null; receivedAt: Date | null }[];
  },
): Promise<Buffer | null> {
  try {
    const { ReceiptTemplateComponent, resolveTemplateKey } = await import("@/lib/pdf/templates");
    const [brandingRaw, logoUrl] = await Promise.all([
      getDocumentBrandingSettings(orgId).catch(() => null),
      resolveInvoiceLogo(orgId).catch(() => undefined),
    ]);
    const branding = { ...(brandingRaw ?? DEFAULT_BRANDING), companyLogoUrl: logoUrl ?? null };
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } }).catch(() => null);
    const templateKey = resolveTemplateKey({
      kind: "RECEIPT",
      requestedKey: (branding as unknown as { receiptTemplateKey?: string | null }).receiptTemplateKey,
      plan: org?.plan ?? "STARTER",
    });
    const ReceiptDoc = ReceiptTemplateComponent(templateKey);
    const element = createElement(ReceiptDoc as never, { sale, branding });
    const pdf = await renderToBuffer(element as never);
    return Buffer.from(pdf);
  } catch {
    return null;
  }
}

async function renderCreditNotePDF(
  orgId: string,
  creditNote: {
    id: string;
    creditNoteNumber: string;
    currency: string | null;
    totalAmount: number;
    issuedAt: Date | null;
    reason: string | null;
    itemsReceivedBackAt: Date | null;
    itemsReceivedBackNote: string | null;
    sale: {
      saleNumber: string | null;
      client: { fullName: string | null; phone: string | null; email: string | null; organization: string | null; address: string | null; accountNumber: string | null } | null;
    } | null;
    invoice: {
      invoiceNumber: string | null;
      client: { fullName: string | null; phone: string | null; email: string | null; organization: string | null; address: string | null; accountNumber: string | null } | null;
      job: { jobNumber: string | null; client: { fullName: string | null; phone: string | null; email: string | null; organization: string | null; address: string | null; accountNumber: string | null } | null } | null;
    } | null;
    items: { description: string; quantity: number; unitPrice: number; lineTotal: number }[];
    refunds: { amount: number }[];
  },
): Promise<Buffer | null> {
  try {
    const { EagleInfoDocument } = await import("@/lib/pdf/EagleInfoDocument");
    const [brandingRaw, logoUrl] = await Promise.all([
      getDocumentBrandingSettings(orgId).catch(() => null),
      resolveInvoiceLogo(orgId).catch(() => undefined),
    ]);
    const branding = { ...(brandingRaw ?? DEFAULT_BRANDING), companyLogoUrl: logoUrl ?? null };
    const address = [branding.companyAddressLine1, branding.companyAddressLine2].filter(Boolean).join("\n");
    const currency = creditNote.currency ?? "";
    const parent = creditNoteParent(creditNote as any);
    const refundedTotal = creditNote.refunds.reduce((sum, r) => sum + r.amount, 0);
    const outstandingCredit = Math.max(0, creditNote.totalAmount - refundedTotal);
    const lineItems: EagleInfoLineItem[] = creditNote.items.length > 0
      ? creditNote.items.map((item) => ({
          name: item.description,
          quantity: item.quantity,
          rate: formatMoney(item.unitPrice, currency),
          amount: formatMoney(item.lineTotal, currency),
        }))
      : [{
          name: creditNote.reason ?? "Credit adjustment",
          quantity: 1,
          rate: formatMoney(creditNote.totalAmount, currency),
          amount: formatMoney(creditNote.totalAmount, currency),
        }];
    const docElement = createElement(EagleInfoDocument as never, {
      companyName: branding.companyName,
      companyAddress: address,
      companyPhone: branding.companyContacts || null,
      companyEmail: branding.companyEmail || null,
      companyWebsite: branding.companyWebsite || null,
      companyLogoUrl: logoUrl || null,
      docTitle: "Credit Note",
      docNumber: creditNote.creditNoteNumber,
      docDate: creditNote.issuedAt ? formatEATDocDate(creditNote.issuedAt) : "",
      terms: "Sales return / adjustment",
      dueDate: null,
      clientName: parent.clientName,
      clientAttn: clientContactName(parent.client),
      clientEmail: parent.client?.email ?? null,
      clientPhone: parent.client?.phone ?? null,
      clientAddress: parent.client?.address ?? null,
      clientAccountNumber: parent.client?.accountNumber ?? null,
      clientLocation: null,
      lineItems,
      subTotal: formatMoney(creditNote.totalAmount, currency),
      headlineLabel: "Credit Issued",
      headlineAmount: formatMoney(creditNote.totalAmount, currency),
      totalLabel: "Credit Total",
      totalAmount: formatMoney(creditNote.totalAmount, currency),
      paymentMade: formatMoney(refundedTotal, currency),
      balanceDue: formatMoney(outstandingCredit, currency),
      notes: [
        parent.label || null,
        creditNote.reason ? `Reason: ${creditNote.reason}` : null,
        creditNote.itemsReceivedBackAt ? `Items received back: ${formatEATDocDate(creditNote.itemsReceivedBackAt)}` : "Items return pending",
        creditNote.itemsReceivedBackNote ? `Return note: ${creditNote.itemsReceivedBackNote}` : null,
      ].filter(Boolean).join("\n"),
      paymentTo: null,
      termsText: pickDocumentTerms(
        branding.termsText,
        creditNote.invoice?.job ? "REPAIR" : creditNote.sale || creditNote.invoice ? "SALE" : "MIXED",
      ),
    });
    const pdf = await renderToBuffer(docElement as never);
    return Buffer.from(pdf);
  } catch {
    return null;
  }
}

async function renderRefundPDF(
  orgId: string,
  refund: {
    id: string;
    amount: number;
    currency: string | null;
    invoice: {
      invoiceNumber: string | null;
      job: { jobNumber: string | null } | null;
    } | null;
    sale: { saleNumber: string | null } | null;
    creditNote: { creditNoteNumber: string | null } | null;
  },
): Promise<Buffer | null> {
  try {
    const { EagleInfoDocument } = await import("@/lib/pdf/EagleInfoDocument");
    const [brandingRaw, logoUrl] = await Promise.all([
      getDocumentBrandingSettings(orgId).catch(() => null),
      resolveInvoiceLogo(orgId).catch(() => undefined),
    ]);
    const branding = { ...(brandingRaw ?? DEFAULT_BRANDING), companyLogoUrl: logoUrl ?? null };
    const address = [branding.companyAddressLine1, branding.companyAddressLine2].filter(Boolean).join("\n");
    const currency = refund.currency ?? "";
    const source =
      refund.invoice?.invoiceNumber ??
      refund.sale?.saleNumber ??
      refund.creditNote?.creditNoteNumber ??
      "refund";
    const docElement = createElement(EagleInfoDocument as never, {
      companyName: branding.companyName,
      companyAddress: address,
      companyPhone: branding.companyContacts || null,
      companyEmail: branding.companyEmail || null,
      companyWebsite: branding.companyWebsite || null,
      companyLogoUrl: logoUrl || null,
      docTitle: "Refund",
      docNumber: `REF-${refund.id.slice(0, 8).toUpperCase()}`,
      docDate: "",
      terms: "Refund document",
      dueDate: null,
      clientName: null,
      clientAttn: null,
      clientEmail: null,
      clientPhone: null,
      clientAddress: null,
      clientAccountNumber: null,
      clientLocation: null,
      lineItems: [{
        name: `Refund for ${source}`,
        quantity: 1,
        rate: formatMoney(refund.amount, currency),
        amount: formatMoney(refund.amount, currency),
      }],
      subTotal: formatMoney(refund.amount, currency),
      headlineLabel: "Refund Amount",
      headlineAmount: formatMoney(refund.amount, currency),
      totalLabel: "Total Refunded",
      totalAmount: formatMoney(refund.amount, currency),
      paymentMade: formatMoney(0, currency),
      balanceDue: formatMoney(0, currency),
      notes: [`Refund document for ${source}`],
      paymentTo: null,
      termsText: branding.termsText ?? "",
    });
    const pdf = await renderToBuffer(docElement as never);
    return Buffer.from(pdf);
  } catch {
    return null;
  }
}

async function renderDeliveryNotePDF(
  orgId: string,
  note: {
    id: string;
    deliveryNoteNumber: string;
    invoice: {
      invoiceNumber: string | null;
      job: { jobNumber: string | null } | null;
    } | null;
    sale: { saleNumber: string | null } | null;
  },
): Promise<Buffer | null> {
  try {
    const { DeliveryNoteDocument } = await import("@/lib/pdf/DeliveryNoteDocument");
    const [brandingRaw, logoUrl] = await Promise.all([
      getDocumentBrandingSettings(orgId).catch(() => null),
      resolveInvoiceLogo(orgId).catch(() => undefined),
    ]);
    const branding = { ...(brandingRaw ?? DEFAULT_BRANDING), companyLogoUrl: logoUrl ?? null };
    const address = [branding.companyAddressLine1, branding.companyAddressLine2].filter(Boolean).join("\n");
    const source = note.invoice?.invoiceNumber ?? note.sale?.saleNumber ?? note.deliveryNoteNumber;
    const element = createElement(DeliveryNoteDocument as never, {
      branding: { ...branding, companyLogoUrl: logoUrl ?? null },
      deliveryNoteNumber: note.deliveryNoteNumber,
      docDate: "",
      source,
    } as never);
    const pdf = await renderToBuffer(element as never);
    return Buffer.from(pdf);
  } catch {
    return null;
  }
}

async function dispatchDocumentShare(params: {
  orgId: string;
  channel: DocumentShareChannel;
  jobId?: string | null;
  clientId?: string | null;
  reminderStage?: string | null;
  recipient: DocumentRecipient;
  whatsappBody: string;
  emailSubject: string;
  emailBody: string;
  /** Defaults to JOB_STATUS_UPDATE, which is what the job-linked shares use. */
  type?: OutboundMessageType;
  /** Set when the message must survive a closed WhatsApp session window. */
  metaTemplateName?: string | null;
  metaTemplateLanguage?: string | null;
  metaTemplateVars?: string | null;
}): Promise<boolean> {
  const messageType = params.type ?? OutboundMessageType.JOB_STATUS_UPDATE;

  // Enqueue then deliver. Enqueueing alone only writes a PENDING row, and the
  // retry sweep is a daily job — so every Send button in the documents area was
  // reporting success while the message waited until the next morning. The
  // notification triggers have always done both; this path had only ever done
  // the first half.
  const attempt = async (queued: unknown) => {
    if (queued && typeof queued === "object" && "outboxId" in queued) {
      const id = (queued as { outboxId?: string }).outboxId;
      // A provider failure is not a failure of the share: the row carries the
      // error and the sweep will retry it.
      if (id) await deliverOutboundMessage(id).catch(() => null);
    }
  };

  if (params.channel === "whatsapp") {
    if (!params.recipient.phone) return false;
    const queued = await enqueueWhatsAppMessage({
      orgId: params.orgId,
      jobId: params.jobId ?? undefined,
      clientId: params.clientId ?? undefined,
      reminderStage: params.reminderStage ?? undefined,
      to: params.recipient.phone,
      type: messageType,
      body: params.whatsappBody,
      metaTemplateName: params.metaTemplateName ?? null,
      metaTemplateLanguage: params.metaTemplateLanguage ?? null,
      metaTemplateVars: params.metaTemplateVars ?? null,
    });
    await attempt(queued);
    return true;
  }

  if (!params.recipient.email) return false;
  const queued = await enqueueEmailMessage({
    orgId: params.orgId,
    jobId: params.jobId ?? undefined,
    clientId: params.clientId ?? undefined,
    reminderStage: params.reminderStage ?? undefined,
    to: params.recipient.email,
    subject: params.emailSubject,
    body: params.emailBody,
    type: messageType,
  });
  await attempt(queued);
  return true;
}

const invoiceClientSelect = {
  fullName: true,
  phone: true,
  email: true,
  organization: true,
} as const;

const linkedInvoiceSelect = {
  invoiceNumber: true,
  job: {
    select: {
      id: true,
      jobNumber: true,
      client: { select: invoiceClientSelect },
    },
  },
  client: { select: invoiceClientSelect },
} as const;

const linkedSaleSelect = {
  saleNumber: true,
  client: { select: invoiceClientSelect },
} as const;

export async function shareReceiptDocument(params: {
  orgId: string;
  paymentId: string;
  channel: DocumentShareChannel;
}): Promise<boolean> {
  const payment = await prisma.payment.findFirst({
    where: { id: params.paymentId, orgId: params.orgId },
    select: {
      id: true,
      amount: true,
      currency: true,
      method: true,
      reference: true,
      receivedAt: true,
      createdBy: { select: { name: true } },
      sale: {
        select: {
          id: true, saleNumber: true, totalAmount: true, paidAmount: true,
          subtotal: true, discountAmount: true, vatAmount: true, taxApplicable: true,
          client: { select: { fullName: true, phone: true, email: true, organization: true, address: true, accountNumber: true } },
          items: {
            select: { description: true, quantity: true, unitPrice: true, lineTotal: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      invoice: {
        select: {
          id: true, invoiceNumber: true, totalAmount: true, paidAmount: true,
          lines: {
            select: { description: true, quantity: true, unitPrice: true, lineTotal: true, taxAmount: true },
            orderBy: { createdAt: "asc" },
          },
          job: { select: { id: true, jobNumber: true, client: { select: { fullName: true, phone: true, email: true, organization: true, address: true, accountNumber: true } } } },
          client: { select: { fullName: true, phone: true, email: true, organization: true, address: true, accountNumber: true } },
        },
      },
    },
  });
  if (!payment) return false;

  const recipient = resolveLinkedDocumentRecipient({
    jobClient: payment.invoice?.job?.client ?? null,
    invoiceClient: payment.invoice?.client ?? null,
    saleClient: payment.sale?.client ?? null,
  });
  if (!recipient) return false;

  const source = payment.invoice?.invoiceNumber ?? payment.sale?.saleNumber ?? "payment";
  const pdfUrl = portalDocumentsUrl();
  const amountLine = `Amount: ${formatMoney(payment.amount, payment.currency)}`;

  // Try to send the actual PDF; fall back to link-only share.
  const buffer = await renderReceiptPDF(params.orgId, payment as never);
  if (buffer) {
    const sent = await sendDocumentAsPDF({
      orgId: params.orgId,
      channel: params.channel,
      recipient,
      buffer,
      filename: `receipt-${payment.id.slice(0, 8)}.pdf`,
      caption: `Hi ${recipient.fullName}, your receipt for ${source} is ready.\n\n${amountLine}\nView it here: ${pdfUrl}`,
      jobId: payment.invoice?.job?.id,
    });
    if (sent) return true;
  }

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    jobId: payment.invoice?.job?.id,
    recipient,
    whatsappBody: `Hi ${recipient.fullName}, your receipt for ${source} is ready.\n\n${amountLine}\nView it here: ${pdfUrl}`,
    emailSubject: `Receipt for ${source}`,
    emailBody: `Hi ${recipient.fullName},\n\nYour receipt for ${source} is ready.\n\n${amountLine}\nView it here: ${pdfUrl}`,
  });
}

/** Share a POS sale receipt (the whole-sale receipt, not a single payment). */
export async function shareSaleReceiptDocument(params: {
  orgId: string;
  saleId: string;
  channel: DocumentShareChannel;
}): Promise<boolean> {
  const sale = await prisma.sale.findFirst({
    where: { id: params.saleId, orgId: params.orgId },
    select: {
      id: true, saleNumber: true, name: true, status: true, currency: true,
      subtotal: true, discountAmount: true, vatAmount: true, totalAmount: true,
      paidAmount: true, createdAt: true,
      branch: { select: { name: true } },
      client: { select: { fullName: true, phone: true, email: true, organization: true, address: true, accountNumber: true } },
      items: { select: { description: true, quantity: true, unitPrice: true, lineTotal: true }, orderBy: { createdAt: "asc" } },
      payments: { select: { id: true, amount: true, method: true, reference: true, receivedAt: true }, orderBy: { receivedAt: "asc" } },
    },
  });
  if (!sale) return false;

  const recipient = resolveLinkedDocumentRecipient({ saleClient: sale.client });
  if (!recipient) return false;

  const amountLine = `Total: ${formatMoney(sale.totalAmount, sale.currency ?? "UGX")}`;

  // Try to send the actual PDF; fall back to link-only share.
  const buffer = await renderSaleReceiptPDF(params.orgId, sale as never);
  if (buffer) {
    const sent = await sendDocumentAsPDF({
      orgId: params.orgId,
      channel: params.channel,
      recipient,
      buffer,
      filename: `receipt-${sale.saleNumber}.pdf`,
      caption: `Hi ${recipient.fullName}, your receipt for sale ${sale.saleNumber} is ready.\n\n${amountLine}`,
    });
    if (sent) return true;
  }

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    recipient,
    whatsappBody: `Hi ${recipient.fullName}, your receipt for sale ${sale.saleNumber} is ready.\n\n${amountLine}`,
    emailSubject: `Receipt for sale ${sale.saleNumber}`,
    emailBody: `Hi ${recipient.fullName},\n\nYour receipt for sale ${sale.saleNumber} is ready.\n\n${amountLine}`,
  });
}

export async function shareCreditNoteDocument(params: {
  orgId: string;
  creditNoteId: string;
  channel: DocumentShareChannel;
}): Promise<boolean> {
  const creditNote = await prisma.creditNote.findFirst({
    where: { id: params.creditNoteId, orgId: params.orgId },
    select: {
      id: true,
      creditNoteNumber: true,
      currency: true,
      totalAmount: true,
      issuedAt: true,
      reason: true,
      itemsReceivedBackAt: true,
      itemsReceivedBackNote: true,
      sale: { select: linkedSaleSelect },
      invoice: { select: linkedInvoiceSelect },
      items: {
        select: { description: true, quantity: true, unitPrice: true, lineTotal: true },
        orderBy: { createdAt: "asc" },
      },
      refunds: { select: { amount: true } },
    },
  });
  if (!creditNote) return false;

  // Either parent can carry the customer, and a repair invoice usually carries
  // it on the job rather than on itself.
  const parent = creditNoteParent(creditNote);
  const recipient = resolveLinkedDocumentRecipient({
    saleClient: creditNote.sale?.client ?? null,
    invoiceClient: creditNote.invoice?.client ?? null,
    jobClient: creditNote.invoice?.job?.client ?? null,
  });
  if (!recipient) return false;

  const amountLine = `Amount: ${formatMoney(creditNote.totalAmount, creditNote.currency)}`;
  const intro = parent.reference
    ? `Your credit note ${creditNote.creditNoteNumber} for ${parent.reference} is ready.`
    : `Your credit note ${creditNote.creditNoteNumber} is ready.`;

  // Try to send the actual PDF; fall back to link-only share.
  const buffer = await renderCreditNotePDF(params.orgId, creditNote as never);
  if (buffer) {
    const sent = await sendDocumentAsPDF({
      orgId: params.orgId,
      channel: params.channel,
      recipient,
      buffer,
      filename: `credit-note-${creditNote.creditNoteNumber}.pdf`,
      caption: `Hi ${recipient.fullName}, ${intro}\n\n${amountLine}`,
      jobId: creditNote.invoice?.job?.id,
    });
    if (sent) return true;
  }

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    recipient,
    whatsappBody: `Hi ${recipient.fullName}, ${intro}\n\n${amountLine}`,
    emailSubject: `Credit note ${creditNote.creditNoteNumber}`,
    emailBody: `Hi ${recipient.fullName},\n\n${intro}\n\n${amountLine}`,
  });
}

export async function shareRefundDocument(params: {
  orgId: string;
  refundId: string;
  channel: DocumentShareChannel;
}): Promise<boolean> {
  const refund = await prisma.refund.findFirst({
    where: { id: params.refundId, orgId: params.orgId },
    select: {
      id: true,
      amount: true,
      currency: true,
      invoice: { select: linkedInvoiceSelect },
      sale: { select: linkedSaleSelect },
      creditNote: {
        select: {
          creditNoteNumber: true,
          sale: { select: { client: { select: invoiceClientSelect } } },
        },
      },
    },
  });
  if (!refund) return false;

  const recipient = resolveLinkedDocumentRecipient({
    jobClient: refund.invoice?.job?.client ?? null,
    invoiceClient: refund.invoice?.client ?? null,
    saleClient: refund.sale?.client ?? null,
    creditNoteSaleClient: refund.creditNote?.sale?.client ?? null,
  });
  if (!recipient) return false;

  const source =
    refund.invoice?.invoiceNumber ??
    refund.sale?.saleNumber ??
    refund.creditNote?.creditNoteNumber ??
    "refund";
  const amountLine = `Amount: ${formatMoney(refund.amount, refund.currency)}`;
  const intro = `Your refund document for ${source} is ready.`;

  // Try to send the actual PDF; fall back to link-only share.
  const buffer = await renderRefundPDF(params.orgId, {
    id: refund.id,
    amount: refund.amount,
    currency: refund.currency ?? null,
    invoice: refund.invoice ? {
      invoiceNumber: refund.invoice.invoiceNumber ?? null,
      job: refund.invoice.job ? { jobNumber: refund.invoice.job.jobNumber ?? null } : null,
    } : null,
    sale: refund.sale ? { saleNumber: refund.sale.saleNumber ?? null } : null,
    creditNote: refund.creditNote ? { creditNoteNumber: refund.creditNote.creditNoteNumber ?? null } : null,
  });
  if (buffer) {
    const sent = await sendDocumentAsPDF({
      orgId: params.orgId,
      channel: params.channel,
      recipient,
      buffer,
      filename: `refund-${refund.id.slice(0, 8)}.pdf`,
      caption: `Hi ${recipient.fullName}, ${intro}\n\n${amountLine}`,
      jobId: refund.invoice?.job?.id,
    });
    if (sent) return true;
  }

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    jobId: refund.invoice?.job?.id,
    recipient,
    whatsappBody: `Hi ${recipient.fullName}, ${intro}\n\n${amountLine}`,
    emailSubject: `Refund document for ${source}`,
    emailBody: `Hi ${recipient.fullName},\n\n${intro}\n\n${amountLine}`,
  });
}

export async function shareDeliveryNoteDocument(params: {
  orgId: string;
  deliveryNoteId: string;
  channel: DocumentShareChannel;
}): Promise<boolean> {
  const note = await prisma.deliveryNote.findFirst({
    where: { id: params.deliveryNoteId, orgId: params.orgId },
    select: {
      id: true,
      deliveryNoteNumber: true,
      invoice: { select: linkedInvoiceSelect },
      sale: { select: linkedSaleSelect },
    },
  });
  if (!note) return false;

  const recipient = resolveLinkedDocumentRecipient({
    jobClient: note.invoice?.job?.client ?? null,
    invoiceClient: note.invoice?.client ?? null,
    saleClient: note.sale?.client ?? null,
  });
  if (!recipient) return false;

  const source = note.invoice?.invoiceNumber ?? note.sale?.saleNumber ?? note.deliveryNoteNumber;
  const intro = `Your delivery note ${note.deliveryNoteNumber} for ${source} is ready.`;

  // Try to send the actual PDF; fall back to link-only share.
  const buffer = await renderDeliveryNotePDF(params.orgId, {
    id: note.id,
    deliveryNoteNumber: note.deliveryNoteNumber,
    invoice: note.invoice ? {
      invoiceNumber: note.invoice.invoiceNumber ?? null,
      job: note.invoice.job ? { jobNumber: note.invoice.job.jobNumber ?? null } : null,
    } : null,
    sale: note.sale ? { saleNumber: note.sale.saleNumber ?? null } : null,
  });
  if (buffer) {
    const sent = await sendDocumentAsPDF({
      orgId: params.orgId,
      channel: params.channel,
      recipient,
      buffer,
      filename: `delivery-note-${note.deliveryNoteNumber}.pdf`,
      caption: `Hi ${recipient.fullName}, ${intro}`,
      jobId: note.invoice?.job?.id,
    });
    if (sent) return true;
  }

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    jobId: note.invoice?.job?.id,
    recipient,
    whatsappBody: `Hi ${recipient.fullName}, ${intro}`,
    emailSubject: `Delivery note ${note.deliveryNoteNumber}`,
    emailBody: `Hi ${recipient.fullName},\n\n${intro}`,
  });
}

export async function shareInvoiceDocument(params: {
  orgId: string;
  invoiceId: string;
  channel: DocumentShareChannel;
}): Promise<boolean> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.invoiceId, orgId: params.orgId },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      currency: true,
      client: { select: invoiceClientSelect },
      job: { select: { id: true, client: { select: invoiceClientSelect } } },
    },
  });
  if (!invoice) return false;

  // Job-linked or standalone: prefer the job's client, else the invoice's own.
  const recipient = resolveLinkedDocumentRecipient({
    jobClient: invoice.job?.client ?? null,
    invoiceClient: invoice.client ?? null,
  });
  if (!recipient) return false;

  const pdfUrl = portalDocumentsUrl();
  const amountLine = `Amount: ${formatMoney(invoice.totalAmount, invoice.currency)}`;
  const intro = `Your invoice ${invoice.invoiceNumber} is ready.`;

  // Try to send the actual PDF; fall back to link-only share.
  const staff = await getStaffInfo(params.orgId);
  const buffer = await renderInvoicePDF(invoice as never, params.orgId, staff);
  if (buffer) {
    const sent = await sendDocumentAsPDF({
      orgId: params.orgId,
      channel: params.channel,
      recipient,
      buffer,
      filename: `invoice-${invoice.invoiceNumber}.pdf`,
      caption: `Hi ${recipient.fullName}, ${intro}\n\n${amountLine}\nView it here: ${pdfUrl}`,
      jobId: invoice.job?.id,
    });
    if (sent) return true;
  }

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    jobId: invoice.job?.id,
    recipient,
    whatsappBody: `Hi ${recipient.fullName}, ${intro}\n\n${amountLine}\nView it here: ${pdfUrl}`,
    emailSubject: `Invoice ${invoice.invoiceNumber}`,
    emailBody: `Hi ${recipient.fullName},\n\n${intro}\n\n${amountLine}\nView it here: ${pdfUrl}`,
  });
}

export async function shareQuotationDocument(params: {
  orgId: string;
  quotationId: string;
  channel: DocumentShareChannel;
}): Promise<boolean> {
  const quotation = await prisma.quotation.findFirst({
    where: { id: params.quotationId, orgId: params.orgId },
    select: {
      id: true,
      quoteNumber: true,
      totalAmount: true,
      currency: true,
      client: { select: invoiceClientSelect },
      job: { select: { id: true, client: { select: invoiceClientSelect } } },
    },
  });
  if (!quotation) return false;

  const recipient = resolveLinkedDocumentRecipient({
    jobClient: quotation.job?.client ?? null,
    invoiceClient: quotation.client ?? null,
  });
  if (!recipient) return false;

  const pdfUrl = portalDocumentsUrl();
  const amountLine = `Amount: ${formatMoney(quotation.totalAmount, quotation.currency)}`;
  const intro = `Your quotation ${quotation.quoteNumber} is ready.`;

  // Try to send the actual PDF; fall back to link-only share.
  const staff = await getStaffInfo(params.orgId);
  const buffer = await renderQuotationPDF(quotation as never, params.orgId, staff);
  if (buffer) {
    const sent = await sendDocumentAsPDF({
      orgId: params.orgId,
      channel: params.channel,
      recipient,
      buffer,
      filename: `quotation-${quotation.quoteNumber}.pdf`,
      caption: `Hi ${recipient.fullName}, ${intro}\n\n${amountLine}\nView it here: ${pdfUrl}`,
      jobId: quotation.job?.id,
    });
    if (sent) return true;
  }

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    jobId: quotation.job?.id,
    recipient,
    whatsappBody: `Hi ${recipient.fullName}, ${intro}\n\n${amountLine}\nView it here: ${pdfUrl}`,
    emailSubject: `Quotation ${quotation.quoteNumber}`,
    emailBody: `Hi ${recipient.fullName},\n\n${intro}\n\n${amountLine}\nView it here: ${pdfUrl}`,
  });
}

/**
 * Statement of account for a client.
 *
 * Unlike the document shares above this is client-scoped, not job-scoped, and it
 * links to the customer portal rather than a /api/... PDF path: those routes
 * require a STAFF session, so a customer clicking one only reaches a login
 * screen. The portal link lands them where they can authenticate and download
 * the same statement.
 */
export async function shareStatementDocument(params: {
  orgId: string;
  clientId: string;
  channel: DocumentShareChannel;
  baseCurrency: string;
  /** Stamped on the outbox row so a scheduled statement can be deduped. */
  reminderStage?: string;
}): Promise<boolean> {
  const client = await prisma.client.findFirst({
    where: { id: params.clientId, orgId: params.orgId },
    select: { fullName: true, phone: true, email: true },
  });
  if (!client) return false;

  const recipient: DocumentRecipient = { fullName: client.fullName, phone: client.phone, email: client.email };
  if (params.channel === "whatsapp" ? !recipient.phone : !recipient.email) return false;

  const statement = await getClientStatement(params.orgId, params.clientId, params.baseCurrency);
  const balance = formatMoney(statement.totals.outstanding, statement.currency);
  const org = await prisma.organization.findUnique({ where: { id: params.orgId }, select: { name: true } });
  const oldest = statement.lines.at(0)?.date ?? null;

  // Rendered through the approved template for the same reason the per-invoice
  // reminders are: a statement is business-initiated, so outside the 24-hour
  // window free-form text is accepted by Meta and delivered to nobody. Falls
  // back to the hand-written body when no template is active.
  const rendered = await renderCommunicationTemplate({
    orgId: params.orgId,
    key: "PAYMENT_REMINDER_STATEMENT",
    channel: params.channel === "whatsapp" ? "WHATSAPP" : "EMAIL",
    variables: {
      customerName: client.fullName,
      companyName: org?.name ?? "",
      documentCount: String(statement.lines.length),
      amount: balance,
      oldestDate: oldest ? formatEATDocDate(oldest) : "—",
    },
    fallback: { body: "" },
  });
  const portalUrl = documentPdfUrl("/portal/documents");
  const docCount = statement.lines.length;
  const intro = statement.totals.outstanding > 0
    ? `Your account balance is ${balance} across ${docCount} document${docCount === 1 ? "" : "s"}.`
    : `Your account is fully settled — balance ${balance}.`;

  // Try to send the actual statement PDF; fall back to link-only share.
  const buffer = await renderStatementPDF(params.orgId, params.clientId, params.baseCurrency);
  if (buffer) {
    const sent = await sendDocumentAsPDF({
      orgId: params.orgId,
      channel: params.channel,
      recipient,
      buffer,
      filename: `statement-${client.fullName.replace(/\s+/g, "-")}-${balance}.pdf`,
      caption: `Hi ${recipient.fullName}, here is your statement of account.\n\n${intro}\nView and download it here: ${portalUrl}`,
    });
    if (sent) return true;
  }

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    recipient,
    clientId: params.clientId,
    reminderStage: params.reminderStage,
    metaTemplateName: rendered.metaTemplateName,
    metaTemplateLanguage: rendered.metaLanguageCode,
    metaTemplateVars: rendered.metaParamValues.length > 0 ? JSON.stringify(rendered.metaParamValues) : null,
    whatsappBody: rendered.body || `Hi ${recipient.fullName}, here is your statement of account.\n\n${intro}\nView and download it here: ${portalUrl}`,
    type: OutboundMessageType.INVOICE_REMINDER,
    emailSubject: `Statement of account — balance ${balance}`,
    emailBody: `Hi ${recipient.fullName},\n\nHere is your statement of account.\n\n${intro}\n\nView and download it here: ${portalUrl}`,
  });
}
