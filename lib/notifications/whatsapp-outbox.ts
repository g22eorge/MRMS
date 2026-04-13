import { Prisma, type OutboundMessageType } from "@prisma/client";
import React from "react";

import { prisma } from "@/lib/prisma";
import { sendEmail, emailIsConfigured } from "@/lib/notifications/email";
import { sendCustomWhatsAppMessage, whatsappHealthCheck, whatsappIsConfigured } from "@/lib/notifications/whatsapp";
import { RepairRequestAlertEmail } from "@/emails/RepairRequestAlertEmail";

const MAX_ATTEMPTS = 8;
const LOCK_TTL_MS = 2 * 60 * 1000;

type DeliveryResult =
  | { ok: true; sent: true }
  | { ok: true; skipped: true }
  | { ok: true; deferred: true }
  | { ok: false; error: string };

function computeNextAttempt(attemptCount: number) {
  // Exponential backoff: 30s, 1m, 2m, 4m, 8m, 16m, 32m, 60m (cap)
  const seconds = Math.min(30 * 2 ** Math.max(0, attemptCount - 1), 60 * 60);
  return new Date(Date.now() + seconds * 1000);
}

function supportsOutbox() {
  return Boolean(Prisma.dmmf.datamodel.models.find((m) => m.name === "OutboundMessage"));
}

export async function enqueueWhatsAppMessage(input: {
  to: string;
  body: string;
  type: OutboundMessageType;
  repairRequestId?: string;
  jobId?: string;
  provider?: string;
}) {
  if (!supportsOutbox()) {
    // Old Prisma client in this runtime: fall back to best-effort direct send.
    const direct = await sendCustomWhatsAppMessage(input.to, input.body);
    return {
      queued: false,
      sent: direct.success,
      messageId: direct.messageId,
      error: direct.error,
      errorCode: direct.errorCode,
    };
  }

  const row = await prisma.outboundMessage
    .create({
      data: {
        channel: "WHATSAPP",
        status: "PENDING",
        type: input.type,
        to: input.to,
        body: input.body,
        provider: input.provider,
        repairRequestId: input.repairRequestId,
        jobId: input.jobId,
        nextAttemptAt: new Date(),
      },
      select: { id: true },
    })
    .catch(async (error) => {
      // If the outbox table hasn't been deployed yet, fall back to best-effort send.
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("no such table") || message.toLowerCase().includes("outboundmessage")) {
        const direct = await sendCustomWhatsAppMessage(input.to, input.body);
        return { id: "", direct } as const;
      }
      throw error;
    });

  if (!row.id) {
    const direct = (row as { direct?: { success: boolean; messageId?: string; error?: string; errorCode?: string } }).direct;
    return {
      queued: false,
      sent: Boolean(direct?.success),
      messageId: direct?.messageId,
      error: direct?.error,
      errorCode: direct?.errorCode,
    };
  }

  return { queued: true, outboxId: row.id };
}

export async function enqueueEmailMessage(input: {
  to: string | string[];
  subject: string;
  body: string;
  type: OutboundMessageType;
  repairRequestId?: string;
  jobId?: string;
}) {
  if (!supportsOutbox()) {
    const direct = await sendEmail({ to: input.to, subject: input.subject, text: input.body });
    return {
      queued: false,
      sent: direct.success,
      messageId: direct.success ? direct.messageId : undefined,
      error: direct.success ? undefined : direct.error,
    };
  }

  const toValue = Array.isArray(input.to) ? input.to.join(",") : input.to;
  const row = await prisma.outboundMessage.create({
    data: {
      channel: "EMAIL",
      status: "PENDING",
      type: input.type,
      to: toValue,
      body: `${input.subject}\n\n${input.body}`,
      nextAttemptAt: new Date(),
      repairRequestId: input.repairRequestId,
      jobId: input.jobId,
      provider: "resend",
    },
    select: { id: true },
  });

  return { queued: true, outboxId: row.id };
}

export async function deliverOutboundMessage(id: string) {
  if (!supportsOutbox()) return { ok: false, error: "Outbox not supported in this runtime" };

  const row = await prisma.outboundMessage.findUnique({ where: { id } });
  if (!row) return { ok: false, error: "Not found" } satisfies DeliveryResult;
  if (row.status === "SENT" || row.status === "DEAD") return { ok: true, skipped: true } satisfies DeliveryResult;
  if (row.nextAttemptAt && row.nextAttemptAt > new Date()) return { ok: true, deferred: true } satisfies DeliveryResult;

  // Config check first (avoid spinning retries when not configured)
  if (row.channel === "WHATSAPP" && !whatsappIsConfigured()) {
    await prisma.outboundMessage.update({
      where: { id },
      data: {
        status: "FAILED",
        lastErrorCode: "NOT_CONFIGURED",
        lastError: "WhatsApp not configured",
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        nextAttemptAt: computeNextAttempt(1),
        lockedAt: null,
      },
    });
    return { ok: false, error: "WhatsApp not configured" } satisfies DeliveryResult;
  }

  if (row.channel === "EMAIL" && !emailIsConfigured()) {
    await prisma.outboundMessage.update({
      where: { id },
      data: {
        status: "FAILED",
        lastErrorCode: "NOT_CONFIGURED",
        lastError: "Email not configured",
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        nextAttemptAt: computeNextAttempt(1),
        lockedAt: null,
      },
    });
    return { ok: false, error: "Email not configured" } satisfies DeliveryResult;
  }

  // Acquire lock (best-effort)
  const lockCutoff = new Date(Date.now() - LOCK_TTL_MS);
  const locked = await prisma.outboundMessage.updateMany({
    where: {
      id,
      status: { in: ["PENDING", "FAILED"] },
      OR: [{ lockedAt: null }, { lockedAt: { lt: lockCutoff } }],
    },
    data: { lockedAt: new Date() },
  });

  if (locked.count !== 1) return { ok: true, skipped: true } satisfies DeliveryResult;

  // If we've already seen "Account not registered" for this recipient, don't keep calling Meta.
  if (row.channel === "WHATSAPP" && row.lastErrorCode === "API_ERROR_133010") {
    await prisma.outboundMessage.update({
      where: { id },
      data: {
        status: "DEAD",
        lastAttemptAt: new Date(),
        lockedAt: null,
      },
    });
    return { ok: true, skipped: true } satisfies DeliveryResult;
  }

  const attempt = row.attemptCount + 1;

  const result =
    row.channel === "WHATSAPP" ? await sendCustomWhatsAppMessage(row.to, row.body) : await deliverEmail(row);

  if (result.success) {
    await prisma.outboundMessage.update({
      where: { id },
      data: {
        status: "SENT",
        providerMessageId: result.messageId,
        sentAt: new Date(),
        attemptCount: attempt,
        lastAttemptAt: new Date(),
        lastErrorCode: null,
        lastError: null,
        lockedAt: null,
      },
    });
    return { ok: true, sent: true } satisfies DeliveryResult;
  }

  const metaCode = (result as { errorCode?: string }).errorCode;

  // WhatsApp Cloud API error 133010 is the recipient number not being a WhatsApp account.
  // Retrying won't help; treat as terminal so the outbox doesn't spin forever.
  const isTerminalRecipientError = row.channel === "WHATSAPP" && metaCode === "133010";

  const nextStatus = isTerminalRecipientError ? "DEAD" : attempt >= MAX_ATTEMPTS ? "DEAD" : "FAILED";
  await prisma.outboundMessage.update({
    where: { id },
    data: {
      status: nextStatus,
      attemptCount: attempt,
      lastAttemptAt: new Date(),
      nextAttemptAt: computeNextAttempt(attempt),
      lastErrorCode:
        row.channel === "WHATSAPP"
          ? result.error?.startsWith("WhatsApp API error")
            ? `API_ERROR_${metaCode ?? "UNKNOWN"}`
            : "SEND_ERROR"
          : "EMAIL_ERROR",
      lastError: result.error?.slice(0, 500) ?? "Unknown error",
      lockedAt: null,
    },
  });
  return { ok: false, error: result.error ?? "Send failed" } satisfies DeliveryResult;
}

async function deliverEmail(row: { id: string; to: string; body: string; type: OutboundMessageType; repairRequestId: string | null }) {
  const to = row.to.split(",").map((t) => t.trim()).filter(Boolean);

  // Use a dedicated alerts sender domain (Resend verifies sender domains).
  // Prefer explicit env override; otherwise default to alerts.eagleinfosolutions.com.
  const from =
    process.env.RESEND_ALERTS_FROM ||
    "Eagle Info Alerts <alerts@alerts.eagleinfosolutions.com>";

  // Prefer a structured template when we have the DB id.
  if (row.type === "REPAIR_REQUEST_EMAIL_ALERT" && row.repairRequestId) {
    const request = await prisma.repairRequest.findUnique({
      where: { id: row.repairRequestId },
      select: {
        requestNumber: true,
        createdAt: true,
        customerName: true,
        phone: true,
        email: true,
        deviceType: true,
        brand: true,
        model: true,
        problemDescription: true,
        handoverMethod: true,
      },
    });

    if (request) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || process.env.APP_URL?.replace(/\/$/, "");
      const intakeUrl = appUrl ? `${appUrl}/intake/${row.repairRequestId}` : null;

      const subject = `New Repair Request ${request.requestNumber}`;
      const text = [
        `New repair request: ${request.requestNumber}`,
        `Created: ${request.createdAt.toISOString()}`,
        `Name: ${request.customerName}`,
        `Phone: ${request.phone}`,
        `Email: ${request.email ?? ""}`,
        `Device: ${request.deviceType}`,
        `Brand/Model: ${request.brand} ${request.model ?? ""}`,
        `Handover: ${request.handoverMethod}`,
        "",
        "Problem:",
        request.problemDescription,
        ...(intakeUrl ? ["", `Intake: ${intakeUrl}`] : []),
      ].join("\n");

      const react = React.createElement(RepairRequestAlertEmail, {
        requestNumber: request.requestNumber,
        createdAtISO: request.createdAt.toISOString(),
        customerName: request.customerName,
        phone: request.phone,
        email: request.email,
        deviceType: request.deviceType,
        brand: request.brand,
        model: request.model,
        problemDescription: request.problemDescription,
        handoverMethod: request.handoverMethod,
        intakeUrl,
      });

      return sendEmail({ to, subject, text, react, from });
    }
  }

  // Fallback: old format stored as "Subject\n\nBody".
  const subject = row.body.split("\n")[0] ?? "MRMS Notification";
  return sendEmail({ to, subject, text: row.body, from });
}

export async function retryDueWhatsApp(limit = 25) {
  if (!supportsOutbox()) {
    return { ok: false, error: "Outbox not supported in this runtime" };
  }

  const lockCutoff = new Date(Date.now() - LOCK_TTL_MS);
  const due = await prisma.outboundMessage.findMany({
    where: {
      channel: "WHATSAPP",
      status: { in: ["PENDING", "FAILED"] },
      nextAttemptAt: { lte: new Date() },
      OR: [{ lockedAt: null }, { lockedAt: { lt: lockCutoff } }],
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  for (const item of due) {
    const res = (await deliverOutboundMessage(item.id)) as DeliveryResult;
    if (res.ok && "sent" in res && res.sent) sent += 1;
    if (!res.ok) failed += 1;
  }

  const health = await whatsappHealthCheck().catch((e) => ({ ok: false, error: String(e) }));
  return { ok: true, processed: due.length, sent, failed, health };
}

export async function retryDueOutboundMessages(limit = 25) {
  if (!supportsOutbox()) {
    return { ok: false, error: "Outbox not supported in this runtime" };
  }

  const lockCutoff = new Date(Date.now() - LOCK_TTL_MS);
  const due = await prisma.outboundMessage.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      nextAttemptAt: { lte: new Date() },
      OR: [{ lockedAt: null }, { lockedAt: { lt: lockCutoff } }],
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  for (const item of due) {
    const res = (await deliverOutboundMessage(item.id)) as DeliveryResult;
    if (res.ok && "sent" in res && res.sent) sent += 1;
    if (!res.ok) failed += 1;
  }

  return { ok: true, processed: due.length, sent, failed };
}
