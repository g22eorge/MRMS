import { OutboundMessageType } from "@prisma/client";

import { generateAssessmentBuffer } from "@/lib/pdf/generate-assessment";
import { generateInvoiceBuffer } from "@/lib/pdf/generate-invoice";
import { generateJobCardBuffer } from "@/lib/pdf/generate-job-card";
import { generateQuotationBuffer } from "@/lib/pdf/generate-quotation";
import {
  getWhatsAppConfigForOrg,
  sendWhatsAppDocument,
  uploadWhatsAppMedia,
} from "@/lib/notifications/whatsapp";
import { sendEmail } from "@/lib/notifications/email";
import { prisma } from "@/lib/prisma";
import { isMissingTableError } from "@/lib/db-errors";

export const WHATSAPP_PDF_DOCUMENT_KEY = "WHATSAPP_PDF_DOCUMENT";

export type WhatsAppDocumentKind = "quotation" | "invoice" | "job_card" | "assessment";

export type WhatsAppDocumentVars = {
  documentKind: WhatsAppDocumentKind;
  filename: string;
  caption: string;
  staffName: string;
  staffRole: string;
  staffUserId: string;
  stampQuotedAt?: boolean;
  auditAction?: string;
  auditDetail?: Record<string, string>;
};

export function parseWhatsAppDocumentVars(raw: string | null | undefined): WhatsAppDocumentVars | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WhatsAppDocumentVars>;
    if (
      !parsed.documentKind ||
      !parsed.filename ||
      !parsed.caption ||
      !parsed.staffName ||
      !parsed.staffRole ||
      !parsed.staffUserId
    ) {
      return null;
    }
    if (!["quotation", "invoice", "job_card", "assessment"].includes(parsed.documentKind)) return null;
    return parsed as WhatsAppDocumentVars;
  } catch {
    return null;
  }
}

export function isWhatsAppPdfDocumentRow(row: { channel: string; templateKey: string | null }) {
  return row.channel === "WHATSAPP" && row.templateKey === WHATSAPP_PDF_DOCUMENT_KEY;
}

export function isEmailPdfDocumentRow(row: { channel: string; templateKey: string | null }) {
  return row.channel === "EMAIL" && row.templateKey === WHATSAPP_PDF_DOCUMENT_KEY;
}

async function generateDocumentBuffer(
  jobId: string,
  orgId: string | null | undefined,
  vars: WhatsAppDocumentVars,
): Promise<{ ok: true; buffer: Buffer; filename: string } | { ok: false; error: string }> {
  const expectedOrgId = orgId ?? undefined;

  switch (vars.documentKind) {
    case "quotation": {
      const result = await generateQuotationBuffer(
        jobId,
        vars.staffName,
        vars.staffRole,
        Boolean(vars.stampQuotedAt),
        vars.staffUserId,
        expectedOrgId,
      );
      if (!result.ok) return result;
      return { ok: true, buffer: result.buffer, filename: result.filename };
    }
    case "invoice": {
      const result = await generateInvoiceBuffer(
        jobId,
        vars.staffName,
        vars.staffRole,
        vars.staffUserId,
        expectedOrgId,
      );
      if (!result.ok) return result;
      return { ok: true, buffer: result.buffer, filename: result.filename };
    }
    case "job_card": {
      const result = await generateJobCardBuffer(
        jobId,
        vars.staffName,
        vars.staffRole,
        vars.staffUserId,
        expectedOrgId,
      );
      if (!result.ok) return result;
      return { ok: true, buffer: result.buffer, filename: result.filename };
    }
    case "assessment": {
      // Client-facing send: only a published (client-visible) report may go out.
      const result = await generateAssessmentBuffer({
        orgId: expectedOrgId ?? "",
        jobId,
        requireClientVisible: true,
      });
      if (!result.ok) return result;
      return { ok: true, buffer: result.buffer, filename: result.filename };
    }
    default:
      return { ok: false, error: "Unknown document kind" };
  }
}

type DocumentDeliveryResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
};

export async function deliverWhatsAppPdfDocument(row: {
  id: string;
  orgId: string | null;
  jobId: string | null;
  to: string;
  templateVars: string | null;
}): Promise<DocumentDeliveryResult> {
  if (!row.jobId) {
    return { success: false, error: "Missing jobId for PDF document delivery" };
  }

  const vars = parseWhatsAppDocumentVars(row.templateVars);
  if (!vars) {
    return { success: false, error: "Invalid PDF document metadata" };
  }

  const generated = await generateDocumentBuffer(row.jobId, row.orgId, vars);
  if (!generated.ok) {
    return { success: false, error: generated.error };
  }

  const cfg = await getWhatsAppConfigForOrg(row.orgId ?? undefined);
  if (!cfg) {
    return { success: false, error: "WhatsApp not configured", errorCode: "NOT_CONFIGURED" };
  }

  const upload = await uploadWhatsAppMedia(
    generated.buffer,
    vars.filename || generated.filename,
    "application/pdf",
    cfg,
  );
  if (!upload.ok) {
    return { success: false, error: upload.error };
  }

  const send = await sendWhatsAppDocument(
    row.to,
    upload.mediaId,
    vars.filename || generated.filename,
    vars.caption,
    cfg,
  );
  if (!send.success) {
    return {
      success: false,
      error: send.error ?? "Document send failed",
      errorCode: send.errorCode,
    };
  }

  if (vars.auditAction && vars.staffUserId) {
    await prisma.auditLog
      .create({
        data: {
          jobId: row.jobId,
          userId: vars.staffUserId,
          action: vars.auditAction,
          detail: JSON.stringify({ ...vars.auditDetail, messageId: send.messageId }),
          orgId: row.orgId,
        },
      })
      .catch(() => null);
  }

  return { success: true, messageId: send.messageId };
}

/**
 * Email counterpart to {@link deliverWhatsAppPdfDocument}: regenerates the same
 * branded PDF and sends it as an attachment (Resend). The client gets the actual
 * document, so it works even though the staff PDF routes are not client-reachable.
 */
export async function deliverEmailPdfDocument(row: {
  id: string;
  orgId: string | null;
  jobId: string | null;
  to: string;
  subject: string | null;
  body: string | null;
  templateVars: string | null;
}): Promise<DocumentDeliveryResult> {
  if (!row.jobId) {
    return { success: false, error: "Missing jobId for PDF document delivery" };
  }
  const vars = parseWhatsAppDocumentVars(row.templateVars);
  if (!vars) {
    return { success: false, error: "Invalid PDF document metadata" };
  }

  const generated = await generateDocumentBuffer(row.jobId, row.orgId, vars);
  if (!generated.ok) {
    return { success: false, error: generated.error };
  }

  const sent = await sendEmail({
    to: row.to,
    subject: row.subject || vars.caption,
    text: row.body || vars.caption,
    attachments: [{ filename: vars.filename || generated.filename, content: generated.buffer }],
  });
  if (!sent.success) {
    return { success: false, error: sent.error ?? "Email send failed", errorCode: "EMAIL_ERROR" };
  }

  if (vars.auditAction && vars.staffUserId) {
    await prisma.auditLog
      .create({
        data: {
          jobId: row.jobId,
          userId: vars.staffUserId,
          action: vars.auditAction,
          detail: JSON.stringify({ ...vars.auditDetail, messageId: sent.messageId, channel: "email" }),
          orgId: row.orgId,
        },
      })
      .catch(() => null);
  }

  return { success: true, messageId: sent.messageId };
}

export async function enqueueWhatsAppDocument(input: {
  orgId: string;
  to: string;
  body: string;
  jobId: string;
  type?: OutboundMessageType;
  document: WhatsAppDocumentVars;
}) {
  const templateVars = JSON.stringify(input.document);

  const row = await prisma.outboundMessage
    .create({
      data: {
        channel: "WHATSAPP",
        status: "PENDING",
        type: input.type ?? "STAFF_REPLY",
        to: input.to,
        subject: null,
        body: input.body,
        templateKey: WHATSAPP_PDF_DOCUMENT_KEY,
        templateVars,
        provider: "meta",
        jobId: input.jobId,
        orgId: input.orgId,
        nextAttemptAt: new Date(),
      },
      select: { id: true },
    })
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (isMissingTableError(error) || message.toLowerCase().includes("outboundmessage")) {
        const direct = await deliverWhatsAppPdfDocument({
          id: "",
          orgId: input.orgId,
          jobId: input.jobId,
          to: input.to,
          templateVars,
        });
        return { id: "", direct } as const;
      }
      throw error;
    });

  if (!row?.id) {
    const direct = (row as { direct?: DocumentDeliveryResult } | null)?.direct;
    return {
      queued: false,
      sent: Boolean(direct?.success),
      messageId: direct?.messageId,
      error: direct?.error,
    };
  }

  return { queued: true, outboxId: row.id };
}

export async function enqueueEmailDocument(input: {
  orgId: string;
  to: string;
  subject: string;
  body: string;
  jobId: string;
  type?: OutboundMessageType;
  document: WhatsAppDocumentVars;
}) {
  const templateVars = JSON.stringify(input.document);

  const row = await prisma.outboundMessage
    .create({
      data: {
        channel: "EMAIL",
        status: "PENDING",
        type: input.type ?? "STAFF_REPLY",
        to: input.to,
        subject: input.subject,
        body: input.body,
        templateKey: WHATSAPP_PDF_DOCUMENT_KEY,
        templateVars,
        provider: "resend",
        jobId: input.jobId,
        orgId: input.orgId,
        nextAttemptAt: new Date(),
      },
      select: { id: true },
    })
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (isMissingTableError(error) || message.toLowerCase().includes("outboundmessage")) {
        const direct = await deliverEmailPdfDocument({
          id: "",
          orgId: input.orgId,
          jobId: input.jobId,
          to: input.to,
          subject: input.subject,
          body: input.body,
          templateVars,
        });
        return { id: "", direct } as const;
      }
      throw error;
    });

  if (!row?.id) {
    const direct = (row as { direct?: DocumentDeliveryResult } | null)?.direct;
    return {
      queued: false,
      sent: Boolean(direct?.success),
      messageId: direct?.messageId,
      error: direct?.error,
    };
  }

  return { queued: true, outboxId: row.id };
}
