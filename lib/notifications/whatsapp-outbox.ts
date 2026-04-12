import { Prisma, type OutboundMessageType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sendCustomWhatsAppMessage, whatsappHealthCheck, whatsappIsConfigured } from "@/lib/notifications/whatsapp";

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
    return { queued: false, sent: direct.success, messageId: direct.messageId, error: direct.error };
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
    const direct = (row as { direct?: { success: boolean; messageId?: string; error?: string } }).direct;
    return { queued: false, sent: Boolean(direct?.success), messageId: direct?.messageId, error: direct?.error };
  }

  // Try to send immediately (still durable if this fails).
  void deliverOutboundMessage(row.id);

  return { queued: true, outboxId: row.id };
}

export async function deliverOutboundMessage(id: string) {
  if (!supportsOutbox()) return { ok: false, error: "Outbox not supported in this runtime" };

  // Config check first (avoid spinning retries when not configured)
  if (!whatsappIsConfigured()) {
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

  const row = await prisma.outboundMessage.findUnique({ where: { id } });
  if (!row) return { ok: false, error: "Not found" } satisfies DeliveryResult;
  if (row.status === "SENT" || row.status === "DEAD") return { ok: true, skipped: true } satisfies DeliveryResult;
  if (row.nextAttemptAt && row.nextAttemptAt > new Date()) return { ok: true, deferred: true } satisfies DeliveryResult;

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

  const attempt = row.attemptCount + 1;
  const result = await sendCustomWhatsAppMessage(row.to, row.body);

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

  const nextStatus = attempt >= MAX_ATTEMPTS ? "DEAD" : "FAILED";
  await prisma.outboundMessage.update({
    where: { id },
    data: {
      status: nextStatus,
      attemptCount: attempt,
      lastAttemptAt: new Date(),
      nextAttemptAt: computeNextAttempt(attempt),
      lastErrorCode: result.error?.startsWith("WhatsApp API error") ? "API_ERROR" : "SEND_ERROR",
      lastError: result.error?.slice(0, 500) ?? "Unknown error",
      lockedAt: null,
    },
  });
  return { ok: false, error: result.error ?? "Send failed" } satisfies DeliveryResult;
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
