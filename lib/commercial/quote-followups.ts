import { OutboundMessageType } from "@prisma/client";

import { formatMoney } from "@/lib/currency";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import {
  documentPdfUrl,
  resolveLinkedDocumentRecipient,
  type DocumentRecipient,
} from "@/lib/notifications/share-document";
import { enqueueEmailMessage, enqueueWhatsAppMessage } from "@/lib/notifications/whatsapp-outbox";
import { prisma } from "@/lib/prisma";

export const DEFAULT_DRAFT_STALE_DAYS = 30;

export type QuoteFollowUpResult =
  | { ok: true; channel: "whatsapp" | "email"; quoteNumber: string; targetType: "job" | "quotation"; targetId: string }
  | { ok: false; quoteNumber?: string; targetType: "job" | "quotation"; targetId: string; error: string };

export type QuoteFollowUpBulkSummary = {
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
};

export type DraftExpirySummary = {
  expired: number;
  quoteNumbers: string[];
};

type QuotationDraftRow = {
  id: string;
  quoteNumber: string;
  status: string;
  createdAt: Date;
  validUntil: Date | null;
};

export function computeQuoteDaysPending(args: { anchor: Date; now?: Date }): number {
  const now = args.now ?? new Date();
  return Math.max(0, Math.floor((now.getTime() - args.anchor.getTime()) / 86400000));
}

export function shouldExpireQuotationDraft(
  quotation: Pick<QuotationDraftRow, "status" | "createdAt" | "validUntil">,
  options?: { staleDays?: number; now?: Date },
): boolean {
  if (quotation.status !== "DRAFT") return false;
  const now = options?.now ?? new Date();
  const staleDays = options?.staleDays ?? DEFAULT_DRAFT_STALE_DAYS;
  if (quotation.validUntil && quotation.validUntil.getTime() < now.getTime()) return true;
  const ageDays = computeQuoteDaysPending({ anchor: quotation.createdAt, now });
  return ageDays >= staleDays;
}

export function buildQuoteFollowUpMessages(args: {
  recipientName: string;
  quoteNumber: string;
  totalAmount?: number | null;
  currency: string;
  daysPending: number;
  pdfUrl: string;
}): { whatsappBody: string; emailSubject: string; emailBody: string } {
  const amountLine =
    typeof args.totalAmount === "number"
      ? `Amount: ${formatMoney(args.totalAmount, args.currency)}`
      : null;
  const pendingLine = `${args.daysPending} day${args.daysPending === 1 ? "" : "s"} since we shared your quote`;
  const detailLines = [amountLine, `Quote PDF: ${args.pdfUrl}`].filter(Boolean).join("\n");

  return {
    whatsappBody:
      `Hi ${args.recipientName}, following up on quotation ${args.quoteNumber} (${pendingLine}).\n` +
      `${detailLines}\n\nPlease let us know if you would like to proceed.`,
    emailSubject: `Follow-up: Quotation ${args.quoteNumber}`,
    emailBody:
      `Hi ${args.recipientName},\n\nWe are following up on quotation ${args.quoteNumber} (${pendingLine}).\n\n` +
      `${detailLines}\n\nPlease reply if you would like to proceed or have any questions.\n\nThank you.`,
  };
}

async function dispatchQuoteFollowUp(params: {
  orgId: string;
  actorUserId?: string;
  jobId?: string | null;
  quotationId?: string | null;
  quoteNumber: string;
  recipient: DocumentRecipient;
  totalAmount?: number | null;
  currency: string;
  daysPending: number;
  pdfPath: string;
  targetType: "job" | "quotation";
  targetId: string;
}): Promise<QuoteFollowUpResult> {
  const pdfUrl = documentPdfUrl(params.pdfPath);
  const copy = buildQuoteFollowUpMessages({
    recipientName: params.recipient.fullName,
    quoteNumber: params.quoteNumber,
    totalAmount: params.totalAmount,
    currency: params.currency,
    daysPending: params.daysPending,
    pdfUrl,
  });

  let channel: "whatsapp" | "email" | null = null;
  if (params.recipient.phone) {
    await enqueueWhatsAppMessage({
      orgId: params.orgId,
      jobId: params.jobId ?? undefined,
      to: params.recipient.phone,
      type: OutboundMessageType.JOB_STATUS_UPDATE,
      body: copy.whatsappBody,
    });
    channel = "whatsapp";
  } else if (params.recipient.email) {
    await enqueueEmailMessage({
      orgId: params.orgId,
      jobId: params.jobId ?? undefined,
      to: params.recipient.email,
      subject: copy.emailSubject,
      body: copy.emailBody,
      type: OutboundMessageType.JOB_STATUS_UPDATE,
    });
    channel = "email";
  } else {
    return {
      ok: false,
      targetType: params.targetType,
      targetId: params.targetId,
      quoteNumber: params.quoteNumber,
      error: "No phone or email for recipient",
    };
  }

  await writeSystemAuditEvent({
    orgId: params.orgId,
    actorUserId: params.actorUserId ?? null,
    entityType: "Quotation",
    entityId: params.quotationId ?? params.targetId,
    action: "QUOTE_FOLLOWUP_SENT",
    summary: `Quote follow-up sent for ${params.quoteNumber} via ${channel}`,
    after: { channel, daysPending: params.daysPending, targetType: params.targetType },
  }).catch(() => null);

  return {
    ok: true,
    channel,
    quoteNumber: params.quoteNumber,
    targetType: params.targetType,
    targetId: params.targetId,
  };
}

export async function sendQuoteFollowUpForJob(params: {
  orgId: string;
  jobId: string;
  actorUserId?: string;
}): Promise<QuoteFollowUpResult> {
  const job = await prisma.job.findFirst({
    where: { id: params.jobId, orgId: params.orgId },
    select: {
      id: true,
      jobNumber: true,
      status: true,
      clientApproved: true,
      clientBill: true,
      quotedAt: true,
      updatedAt: true,
      client: { select: { fullName: true, phone: true, email: true } },
      quotations: {
        where: { status: { in: ["DRAFT", "SENT"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, quoteNumber: true, status: true, totalAmount: true, currency: true, sentAt: true, createdAt: true },
      },
    },
  });

  if (!job) {
    return { ok: false, targetType: "job", targetId: params.jobId, error: "Job not found" };
  }

  const awaitingDecision =
    job.status === "AWAITING_APPROVAL" && job.clientApproved === null;
  const persistedQuote = job.quotations[0];
  const sentQuote = persistedQuote?.status === "SENT";

  if (!awaitingDecision && !sentQuote) {
    return {
      ok: false,
      targetType: "job",
      targetId: job.id,
      error: "Job is not awaiting a quote decision",
    };
  }

  const recipient = job.client;
  if (!recipient) {
    return { ok: false, targetType: "job", targetId: job.id, error: "No client on job" };
  }

  const quoteNumber = persistedQuote?.quoteNumber ?? `Quote-${job.jobNumber}`;
  const anchor = persistedQuote?.sentAt ?? job.quotedAt ?? job.updatedAt;
  const daysPending = computeQuoteDaysPending({ anchor });

  return dispatchQuoteFollowUp({
    orgId: params.orgId,
    actorUserId: params.actorUserId,
    jobId: job.id,
    quotationId: persistedQuote?.id ?? null,
    quoteNumber,
    recipient,
    totalAmount: persistedQuote?.totalAmount ?? job.clientBill,
    currency: persistedQuote?.currency ?? "UGX",
    daysPending,
    pdfPath: `/api/jobs/${job.id}/quotation`,
    targetType: "job",
    targetId: job.id,
  });
}

export async function sendQuoteFollowUpForQuotation(params: {
  orgId: string;
  quotationId: string;
  actorUserId?: string;
}): Promise<QuoteFollowUpResult> {
  const quotation = await prisma.quotation.findFirst({
    where: { id: params.quotationId, orgId: params.orgId, status: "SENT" },
    select: {
      id: true,
      quoteNumber: true,
      totalAmount: true,
      currency: true,
      sentAt: true,
      createdAt: true,
      jobId: true,
      client: { select: { fullName: true, phone: true, email: true } },
      lead: { select: { fullName: true, phone: true, email: true } },
    },
  });

  if (!quotation) {
    return {
      ok: false,
      targetType: "quotation",
      targetId: params.quotationId,
      error: "Sent quotation not found",
    };
  }

  const recipient = resolveLinkedDocumentRecipient({
    invoiceClient: quotation.client,
    jobClient: quotation.lead
      ? {
          fullName: quotation.lead.fullName,
          phone: quotation.lead.phone,
          email: quotation.lead.email,
        }
      : null,
  });

  if (!recipient) {
    return {
      ok: false,
      targetType: "quotation",
      targetId: quotation.id,
      quoteNumber: quotation.quoteNumber,
      error: "No client or lead contact on quotation",
    };
  }

  const anchor = quotation.sentAt ?? quotation.createdAt;
  const pdfPath = quotation.jobId
    ? `/api/jobs/${quotation.jobId}/quotation`
    : `/api/quotations/${quotation.id}`;

  return dispatchQuoteFollowUp({
    orgId: params.orgId,
    actorUserId: params.actorUserId,
    jobId: quotation.jobId,
    quotationId: quotation.id,
    quoteNumber: quotation.quoteNumber,
    recipient,
    totalAmount: quotation.totalAmount,
    currency: quotation.currency,
    daysPending: computeQuoteDaysPending({ anchor }),
    pdfPath,
    targetType: "quotation",
    targetId: quotation.id,
  });
}

export async function sendQuoteFollowUpsBulk(params: {
  orgId: string;
  actorUserId?: string;
}): Promise<QuoteFollowUpBulkSummary> {
  const summary: QuoteFollowUpBulkSummary = { sent: 0, skipped: 0, failed: 0, errors: [] };

  const [jobs, quotations] = await Promise.all([
    prisma.job.findMany({
      where: {
        orgId: params.orgId,
        status: "AWAITING_APPROVAL",
        clientApproved: null,
      },
      select: { id: true },
      take: 50,
    }),
    prisma.quotation.findMany({
      where: { orgId: params.orgId, status: "SENT" },
      select: { id: true },
      take: 50,
    }),
  ]);

  for (const job of jobs) {
    const result = await sendQuoteFollowUpForJob({
      orgId: params.orgId,
      jobId: job.id,
      actorUserId: params.actorUserId,
    });
    if (result.ok) summary.sent += 1;
    else if (result.error.includes("not awaiting")) summary.skipped += 1;
    else {
      summary.failed += 1;
      summary.errors.push(result.error);
    }
  }

  for (const quotation of quotations) {
    const result = await sendQuoteFollowUpForQuotation({
      orgId: params.orgId,
      quotationId: quotation.id,
      actorUserId: params.actorUserId,
    });
    if (result.ok) summary.sent += 1;
    else {
      summary.failed += 1;
      summary.errors.push(result.error);
    }
  }

  return summary;
}

export async function expireStaleQuotationDrafts(params: {
  orgId: string;
  actorUserId?: string;
  staleDays?: number;
  now?: Date;
}): Promise<DraftExpirySummary> {
  const now = params.now ?? new Date();
  const staleDays = params.staleDays ?? DEFAULT_DRAFT_STALE_DAYS;

  const drafts = await prisma.quotation.findMany({
    where: { orgId: params.orgId, status: "DRAFT" },
    select: { id: true, quoteNumber: true, status: true, createdAt: true, validUntil: true },
    take: 200,
  });

  const toExpire = drafts.filter((row) => shouldExpireQuotationDraft(row, { staleDays, now }));
  if (toExpire.length === 0) {
    return { expired: 0, quoteNumbers: [] };
  }

  await prisma.quotation.updateMany({
    where: { orgId: params.orgId, id: { in: toExpire.map((row) => row.id) } },
    data: { status: "EXPIRED" },
  });

  for (const row of toExpire) {
    await writeSystemAuditEvent({
      orgId: params.orgId,
      actorUserId: params.actorUserId ?? null,
      entityType: "Quotation",
      entityId: row.id,
      action: "QUOTATION_DRAFT_EXPIRED",
      summary: `Draft quotation ${row.quoteNumber} expired by policy`,
      after: { staleDays, validUntil: row.validUntil?.toISOString() ?? null },
    }).catch(() => null);
  }

  return {
    expired: toExpire.length,
    quoteNumbers: toExpire.map((row) => row.quoteNumber),
  };
}
