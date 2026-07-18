import { DOCUMENTS_ROUTES } from "@/lib/documents/routes";
import { prisma } from "@/lib/prisma";

import {
  JOB_DOCUMENT_KIND_LABELS,
  sortJobDocumentTimeline,
  type JobDocumentKind,
  type JobDocumentTimelineEntry,
} from "./job-document-timeline-shared";

// Re-export the client-safe pieces so existing server-side importers keep working.
export { JOB_DOCUMENT_KIND_LABELS, sortJobDocumentTimeline };
export type { JobDocumentKind, JobDocumentTimelineEntry };

export async function loadJobDocumentTimeline(params: {
  orgId: string;
  jobId: string;
  jobNumber: string;
  receivedAt: Date;
  includeJobCard?: boolean;
}): Promise<JobDocumentTimelineEntry[]> {
  const entries: JobDocumentTimelineEntry[] = [];

  if (params.includeJobCard !== false) {
    entries.push({
      id: `job-card-${params.jobId}`,
      kind: "job_card",
      label: params.jobNumber,
      occurredAt: params.receivedAt,
      pdfHref: `/api/jobs/${params.jobId}/job-card`,
      listHref: `${DOCUMENTS_ROUTES.jobCards}?q=${encodeURIComponent(params.jobNumber)}`,
    });
  }

  const [quotations, invoice] = await Promise.all([
    prisma.quotation.findMany({
      where: { orgId: params.orgId, jobId: params.jobId },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        sentAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invoice.findFirst({
      where: { orgId: params.orgId, jobId: params.jobId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        currency: true,
        issuedAt: true,
        deliveryNotes: {
          select: { id: true, deliveryNoteNumber: true, deliveredAt: true },
          orderBy: { deliveredAt: "asc" },
        },
        refunds: {
          select: { id: true, amount: true, currency: true, refundedAt: true },
          orderBy: { refundedAt: "asc" },
        },
        payments: {
          select: { id: true, amount: true, receivedAt: true },
          orderBy: { receivedAt: "asc" },
        },
      },
    }),
  ]);

  for (const quotation of quotations) {
    entries.push({
      id: quotation.id,
      kind: "quotation",
      label: quotation.quoteNumber,
      status: quotation.status,
      amount: quotation.totalAmount,
      currency: quotation.currency,
      occurredAt: quotation.sentAt ?? quotation.createdAt,
      pdfHref: `/api/jobs/${params.jobId}/quotation`,
      listHref: `${DOCUMENTS_ROUTES.quotations}?q=${encodeURIComponent(quotation.quoteNumber)}`,
    });
  }

  if (invoice) {
    entries.push({
      id: invoice.id,
      kind: "invoice",
      label: invoice.invoiceNumber,
      status: invoice.status,
      amount: invoice.totalAmount,
      currency: invoice.currency,
      occurredAt: invoice.issuedAt,
      pdfHref: `/api/jobs/${params.jobId}/invoice`,
      listHref: `${DOCUMENTS_ROUTES.invoices}?q=${encodeURIComponent(invoice.invoiceNumber)}`,
    });

    const paymentIds = invoice.payments.map((payment) => payment.id);
    const receipts =
      paymentIds.length > 0
        ? await prisma.receipt.findMany({
            where: { orgId: params.orgId, paymentId: { in: paymentIds }, voidedAt: null },
            select: {
              id: true,
              receiptNumber: true,
              amount: true,
              currency: true,
              issuedAt: true,
              paymentId: true,
            },
            orderBy: { issuedAt: "asc" },
          })
        : [];

    for (const receipt of receipts) {
      if (!receipt.paymentId) continue;
      entries.push({
        id: receipt.id,
        kind: "receipt",
        label: receipt.receiptNumber,
        amount: receipt.amount,
        currency: receipt.currency,
        occurredAt: receipt.issuedAt,
        pdfHref: `/api/payments/${receipt.paymentId}/receipt`,
        listHref: `${DOCUMENTS_ROUTES.receipts}?q=${encodeURIComponent(receipt.receiptNumber)}`,
      });
    }

    for (const note of invoice.deliveryNotes) {
      entries.push({
        id: note.id,
        kind: "delivery_note",
        label: note.deliveryNoteNumber,
        occurredAt: note.deliveredAt,
        pdfHref: `/api/delivery-notes/${note.id}`,
        listHref: `${DOCUMENTS_ROUTES.deliveryNotes}?q=${encodeURIComponent(note.deliveryNoteNumber)}`,
      });
    }

    for (const refund of invoice.refunds) {
      entries.push({
        id: refund.id,
        kind: "refund",
        label: `Refund · ${invoice.invoiceNumber}`,
        amount: refund.amount,
        currency: refund.currency,
        occurredAt: refund.refundedAt,
        pdfHref: `/api/refunds/${refund.id}`,
        listHref: `${DOCUMENTS_ROUTES.refunds}?q=${encodeURIComponent(invoice.invoiceNumber)}`,
      });
    }
  }

  return sortJobDocumentTimeline(entries);
}
