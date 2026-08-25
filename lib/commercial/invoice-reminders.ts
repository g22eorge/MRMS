import { OutboundMessageType } from "@prisma/client";

import { formatMoney } from "@/lib/currency";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import {
  documentPdfUrl,
  resolveLinkedDocumentRecipient,
} from "@/lib/notifications/share-document";
import { enqueueEmailMessage, enqueueWhatsAppMessage } from "@/lib/notifications/whatsapp-outbox";
import { prisma } from "@/lib/prisma";

export type OverdueAgingBucket = "1-30" | "31-60" | "61+" | "all";

export type ReminderDispatchResult =
  | { ok: true; channel: "whatsapp" | "email"; invoiceId: string; invoiceNumber: string }
  | { ok: false; invoiceId: string; invoiceNumber?: string; error: string };

export type BulkReminderSummary = {
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
};

const invoiceReminderSelect = {
  id: true,
  invoiceNumber: true,
  issuedAt: true,
  dueDate: true,
  currency: true,
  totalAmount: true,
  paidAmount: true,
  status: true,
  job: {
    select: {
      id: true,
      client: { select: { fullName: true, phone: true, email: true, organization: true } },
    },
  },
  client: { select: { fullName: true, phone: true, email: true, organization: true } },
} as const;

type InvoiceReminderRow = {
  id: string;
  invoiceNumber: string;
  issuedAt: Date;
  dueDate: Date | null;
  currency: string | null;
  totalAmount: number;
  paidAmount: number;
  status: string;
  job: {
    id: string;
    client: { fullName: string; phone: string | null; email: string | null };
  } | null;
  client: { fullName: string; phone: string | null; email: string | null } | null;
};

export function computeInvoiceDaysOverdue(args: {
  dueDate: Date | null;
  issuedAt: Date;
  now?: Date;
}): number {
  const now = args.now ?? new Date();
  const dueOrIssued = args.dueDate ?? args.issuedAt;
  return Math.floor((now.getTime() - dueOrIssued.getTime()) / 86400000);
}

export function matchesOverdueAgingBucket(daysOverdue: number, bucket: OverdueAgingBucket): boolean {
  if (daysOverdue <= 0) return false;
  if (bucket === "all") return true;
  if (bucket === "1-30") return daysOverdue >= 1 && daysOverdue <= 30;
  if (bucket === "31-60") return daysOverdue >= 31 && daysOverdue <= 60;
  return daysOverdue >= 61;
}

export function buildOverdueReminderMessages(args: {
  recipientName: string;
  invoiceNumber: string;
  balance: number;
  currency: string;
  daysOverdue: number;
  pdfUrl?: string | null;
}): { whatsappBody: string; emailSubject: string; emailBody: string } {
  const balanceLine = `Outstanding balance: ${formatMoney(args.balance, args.currency)}`;
  const overdueLine = `${args.daysOverdue} day${args.daysOverdue === 1 ? "" : "s"} overdue`;
  const pdfLine = args.pdfUrl ? `\nInvoice PDF: ${args.pdfUrl}` : "";

  return {
    whatsappBody:
      `Hi ${args.recipientName}, friendly reminder: invoice ${args.invoiceNumber} is ${overdueLine}.\n` +
      `${balanceLine}${pdfLine}\n\nPlease arrange payment at your earliest convenience. Thank you.`,
    emailSubject: `Payment reminder: Invoice ${args.invoiceNumber}`,
    emailBody:
      `Hi ${args.recipientName},\n\nThis is a friendly reminder that invoice ${args.invoiceNumber} is ${overdueLine}.\n\n` +
      `${balanceLine}${pdfLine}\n\nPlease arrange payment at your earliest convenience.\n\nThank you.`,
  };
}

function outstandingBalance(invoice: Pick<InvoiceReminderRow, "totalAmount" | "paidAmount">): number {
  return Math.max(0, invoice.totalAmount - invoice.paidAmount);
}

export async function dispatchOverdueInvoiceReminder(
  orgId: string,
  invoice: InvoiceReminderRow,
  actorUserId?: string,
): Promise<ReminderDispatchResult> {
  const balance = outstandingBalance(invoice);
  if (balance <= 0 || invoice.status === "VOID" || invoice.status === "PAID") {
    return {
      ok: false,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      error: "Invoice is not outstanding",
    };
  }

  const daysOverdue = computeInvoiceDaysOverdue({
    dueDate: invoice.dueDate,
    issuedAt: invoice.issuedAt,
  });
  if (daysOverdue <= 0) {
    return {
      ok: false,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      error: "Invoice is not overdue",
    };
  }

  const recipient = resolveLinkedDocumentRecipient({
    jobClient: invoice.job?.client ?? null,
    invoiceClient: invoice.client ?? null,
  });
  if (!recipient) {
    return {
      ok: false,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      error: "No client contact on invoice",
    };
  }

  const currency = invoice.currency ?? "UGX";
  const pdfUrl = invoice.job?.id ? documentPdfUrl(`/api/jobs/${invoice.job.id}/invoice`) : null;
  const copy = buildOverdueReminderMessages({
    recipientName: recipient.fullName,
    invoiceNumber: invoice.invoiceNumber,
    balance,
    currency,
    daysOverdue,
    pdfUrl,
  });

  let channel: "whatsapp" | "email" | null = null;
  if (recipient.phone) {
    await enqueueWhatsAppMessage({
      orgId,
      jobId: invoice.job?.id,
      to: recipient.phone,
      type: OutboundMessageType.JOB_STATUS_UPDATE,
      body: copy.whatsappBody,
    });
    channel = "whatsapp";
  } else if (recipient.email) {
    await enqueueEmailMessage({
      orgId,
      jobId: invoice.job?.id,
      to: recipient.email,
      subject: copy.emailSubject,
      body: copy.emailBody,
      type: OutboundMessageType.JOB_STATUS_UPDATE,
    });
    channel = "email";
  } else {
    return {
      ok: false,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      error: "No phone or email for client",
    };
  }

  await writeSystemAuditEvent({
    orgId,
    actorUserId: actorUserId ?? null,
    entityType: "Invoice",
    entityId: invoice.id,
    action: "OVERDUE_REMINDER_SENT",
    summary: `Overdue reminder sent for ${invoice.invoiceNumber} via ${channel}`,
    after: { channel, daysOverdue, balance },
  }).catch(() => null);

  return {
    ok: true,
    channel,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
  };
}

export async function sendOverdueInvoiceReminder(params: {
  orgId: string;
  invoiceId: string;
  actorUserId?: string;
}): Promise<ReminderDispatchResult> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.invoiceId, orgId: params.orgId },
    select: invoiceReminderSelect,
  });
  if (!invoice) {
    return { ok: false, invoiceId: params.invoiceId, error: "Invoice not found" };
  }
  return dispatchOverdueInvoiceReminder(params.orgId, invoice, params.actorUserId);
}

export async function sendOverdueInvoiceRemindersForBucket(params: {
  orgId: string;
  bucket: OverdueAgingBucket;
  actorUserId?: string;
}): Promise<BulkReminderSummary> {
  const invoices = await prisma.invoice.findMany({
    where: {
      orgId: params.orgId,
      status: { in: ["ISSUED", "DRAFT"] },
    },
    select: invoiceReminderSelect,
    orderBy: { issuedAt: "asc" },
    take: 200,
  });

  const summary: BulkReminderSummary = { sent: 0, skipped: 0, failed: 0, errors: [] };

  for (const invoice of invoices) {
    const balance = outstandingBalance(invoice);
    if (balance <= 0) {
      summary.skipped += 1;
      continue;
    }

    const daysOverdue = computeInvoiceDaysOverdue({
      dueDate: invoice.dueDate,
      issuedAt: invoice.issuedAt,
    });
    if (!matchesOverdueAgingBucket(daysOverdue, params.bucket)) {
      summary.skipped += 1;
      continue;
    }

    const result = await dispatchOverdueInvoiceReminder(params.orgId, invoice, params.actorUserId);
    if (result.ok) {
      summary.sent += 1;
    } else {
      summary.failed += 1;
      if (summary.errors.length < 5) {
        summary.errors.push(`${invoice.invoiceNumber}: ${result.error}`);
      }
    }
  }

  return summary;
}
