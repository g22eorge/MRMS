import { OutboundMessageType } from "@prisma/client";

import { formatMoney } from "@/lib/currency";
import { getClientStatement } from "@/lib/commercial/statements";
import { enqueueEmailMessage, enqueueWhatsAppMessage } from "@/lib/notifications/whatsapp-outbox";
import { prisma } from "@/lib/prisma";

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

async function dispatchDocumentShare(params: {
  orgId: string;
  channel: DocumentShareChannel;
  jobId?: string | null;
  recipient: DocumentRecipient;
  whatsappBody: string;
  emailSubject: string;
  emailBody: string;
  /** Defaults to JOB_STATUS_UPDATE, which is what the job-linked shares use. */
  type?: OutboundMessageType;
}): Promise<boolean> {
  const messageType = params.type ?? OutboundMessageType.JOB_STATUS_UPDATE;
  if (params.channel === "whatsapp") {
    if (!params.recipient.phone) return false;
    await enqueueWhatsAppMessage({
      orgId: params.orgId,
      jobId: params.jobId ?? undefined,
      to: params.recipient.phone,
      type: messageType,
      body: params.whatsappBody,
    });
    return true;
  }

  if (!params.recipient.email) return false;
  await enqueueEmailMessage({
    orgId: params.orgId,
    jobId: params.jobId ?? undefined,
    to: params.recipient.email,
    subject: params.emailSubject,
    body: params.emailBody,
    type: messageType,
  });
  return true;
}

const invoiceClientSelect = {
  fullName: true,
  phone: true,
  email: true,
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
      invoice: { select: linkedInvoiceSelect },
      sale: { select: linkedSaleSelect },
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
  const pdfUrl = documentPdfUrl(`/api/payments/${payment.id}/receipt`);
  const amountLine = `Amount: ${formatMoney(payment.amount, payment.currency)}`;

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    jobId: payment.invoice?.job?.id,
    recipient,
    whatsappBody: `Hi ${recipient.fullName}, your receipt for ${source} is ready.\n\n${amountLine}\nDownload PDF: ${pdfUrl}`,
    emailSubject: `Receipt for ${source}`,
    emailBody: `Hi ${recipient.fullName},\n\nYour receipt for ${source} is ready.\n\n${amountLine}\nDownload PDF: ${pdfUrl}`,
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
    select: { id: true, saleNumber: true, totalAmount: true, currency: true, client: { select: invoiceClientSelect } },
  });
  if (!sale) return false;

  const recipient = resolveLinkedDocumentRecipient({ saleClient: sale.client });
  if (!recipient) return false;

  const pdfUrl = documentPdfUrl(`/api/sales/${sale.id}/receipt`);
  const amountLine = `Total: ${formatMoney(sale.totalAmount, sale.currency ?? "UGX")}`;

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    recipient,
    whatsappBody: `Hi ${recipient.fullName}, your receipt for sale ${sale.saleNumber} is ready.\n\n${amountLine}\nDownload PDF: ${pdfUrl}`,
    emailSubject: `Receipt for sale ${sale.saleNumber}`,
    emailBody: `Hi ${recipient.fullName},\n\nYour receipt for sale ${sale.saleNumber} is ready.\n\n${amountLine}\nDownload PDF: ${pdfUrl}`,
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
      totalAmount: true,
      currency: true,
      sale: { select: linkedSaleSelect },
    },
  });
  if (!creditNote) return false;

  const recipient = resolveLinkedDocumentRecipient({ saleClient: creditNote.sale.client });
  if (!recipient) return false;

  const pdfUrl = documentPdfUrl(`/api/credit-notes/${creditNote.id}`);
  const amountLine = `Amount: ${formatMoney(creditNote.totalAmount, creditNote.currency)}`;
  const intro = `Your credit note ${creditNote.creditNoteNumber} for ${creditNote.sale.saleNumber} is ready.`;

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    recipient,
    whatsappBody: `Hi ${recipient.fullName}, ${intro}\n\n${amountLine}\nDownload PDF: ${pdfUrl}`,
    emailSubject: `Credit note ${creditNote.creditNoteNumber}`,
    emailBody: `Hi ${recipient.fullName},\n\n${intro}\n\n${amountLine}\nDownload PDF: ${pdfUrl}`,
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
    creditNoteSaleClient: refund.creditNote?.sale.client ?? null,
  });
  if (!recipient) return false;

  const source =
    refund.invoice?.invoiceNumber ??
    refund.sale?.saleNumber ??
    refund.creditNote?.creditNoteNumber ??
    "refund";
  const pdfUrl = documentPdfUrl(`/api/refunds/${refund.id}`);
  const amountLine = `Amount: ${formatMoney(refund.amount, refund.currency)}`;
  const intro = `Your refund document for ${source} is ready.`;

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    jobId: refund.invoice?.job?.id,
    recipient,
    whatsappBody: `Hi ${recipient.fullName}, ${intro}\n\n${amountLine}\nDownload PDF: ${pdfUrl}`,
    emailSubject: `Refund document for ${source}`,
    emailBody: `Hi ${recipient.fullName},\n\n${intro}\n\n${amountLine}\nDownload PDF: ${pdfUrl}`,
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
  const pdfUrl = documentPdfUrl(`/api/delivery-notes/${note.id}`);
  const intro = `Your delivery note ${note.deliveryNoteNumber} for ${source} is ready.`;

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    jobId: note.invoice?.job?.id,
    recipient,
    whatsappBody: `Hi ${recipient.fullName}, ${intro}\n\nDownload PDF: ${pdfUrl}`,
    emailSubject: `Delivery note ${note.deliveryNoteNumber}`,
    emailBody: `Hi ${recipient.fullName},\n\n${intro}\n\nDownload PDF: ${pdfUrl}`,
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

  const pdfUrl = documentPdfUrl(`/api/invoices/${invoice.id}/pdf`);
  const amountLine = `Amount: ${formatMoney(invoice.totalAmount, invoice.currency)}`;
  const intro = `Your invoice ${invoice.invoiceNumber} is ready.`;

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    jobId: invoice.job?.id,
    recipient,
    whatsappBody: `Hi ${recipient.fullName}, ${intro}\n\n${amountLine}\nDownload PDF: ${pdfUrl}`,
    emailSubject: `Invoice ${invoice.invoiceNumber}`,
    emailBody: `Hi ${recipient.fullName},\n\n${intro}\n\n${amountLine}\nDownload PDF: ${pdfUrl}`,
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

  // Quotation PDF is served by the [id] route's GET (there is no /pdf subroute).
  const pdfUrl = documentPdfUrl(`/api/quotations/${quotation.id}`);
  const amountLine = `Amount: ${formatMoney(quotation.totalAmount, quotation.currency)}`;
  const intro = `Your quotation ${quotation.quoteNumber} is ready.`;

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    jobId: quotation.job?.id,
    recipient,
    whatsappBody: `Hi ${recipient.fullName}, ${intro}\n\n${amountLine}\nDownload PDF: ${pdfUrl}`,
    emailSubject: `Quotation ${quotation.quoteNumber}`,
    emailBody: `Hi ${recipient.fullName},\n\n${intro}\n\n${amountLine}\nDownload PDF: ${pdfUrl}`,
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
  const portalUrl = documentPdfUrl("/portal/documents");
  const docCount = statement.lines.length;
  const intro = statement.totals.outstanding > 0
    ? `Your account balance is ${balance} across ${docCount} document${docCount === 1 ? "" : "s"}.`
    : `Your account is fully settled — balance ${balance}.`;

  return dispatchDocumentShare({
    orgId: params.orgId,
    channel: params.channel,
    recipient,
    whatsappBody: `Hi ${recipient.fullName}, here is your statement of account.\n\n${intro}\nView and download it here: ${portalUrl}`,
    type: OutboundMessageType.INVOICE_REMINDER,
    emailSubject: `Statement of account — balance ${balance}`,
    emailBody: `Hi ${recipient.fullName},\n\nHere is your statement of account.\n\n${intro}\n\nView and download it here: ${portalUrl}`,
  });
}
