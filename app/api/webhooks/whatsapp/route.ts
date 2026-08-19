import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { normalizeUgPhone } from "@/lib/phone";
import { findOrgIdByWhatsAppPhoneNumberId } from "@/lib/org-whatsapp-config";

export const dynamic = "force-dynamic";

function verifySignature({ rawBody, signature, appSecret }: { rawBody: string; signature: string | null; appSecret: string }) {
  if (!signature) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  // Webhook verification handshake
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    return NextResponse.json({ ok: false, error: "Missing WHATSAPP_WEBHOOK_VERIFY_TOKEN" }, { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken && typeof challenge === "string") {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ ok: false }, { status: 403 });
}

type MetaMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string };
  video?: { id?: string; caption?: string };
  audio?: { id?: string };
  document?: { id?: string; caption?: string };
  sticker?: { id?: string };
};

type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: Array<{
          id?: string;
          status?: string;
          timestamp?: string;
          recipient_id?: string;
          errors?: Array<{ code?: number | string; title?: string; message?: string; error_data?: unknown }>;
        }>;
        messages?: MetaMessage[];
        metadata?: { display_phone_number?: string; phone_number_id?: string };
      };
    }>;
  }>;
};

async function handleInboundMessage(msg: MetaMessage, orgId: string | null): Promise<void> {
  const wamid = typeof msg.id === "string" ? msg.id : null;
  const rawFrom = typeof msg.from === "string" ? msg.from : null;
  const ts = typeof msg.timestamp === "string" ? Number(msg.timestamp) : null;

  if (!wamid || !rawFrom || !ts) return;

  const from = normalizeUgPhone(rawFrom, { format: "whatsapp" }) ?? rawFrom.replace(/\D+/g, "");
  const timestamp = new Date(ts * 1000);

  // Determine content
  const type = typeof msg.type === "string" ? msg.type : "unknown";
  let body: string | null = null;
  let mediaType: string | null = null;
  let mediaId: string | null = null;
  let mediaCaption: string | null = null;

  if (type === "text") {
    body = msg.text?.body ?? null;
  } else if (["image", "video", "audio", "document", "sticker"].includes(type)) {
    mediaType = type;
    const media = (msg as Record<string, unknown>)[type] as Record<string, string> | undefined;
    mediaId = media?.id ?? null;
    mediaCaption = media?.caption ?? null;
  }

  // Look up client by phone (normalized digits or with leading +), WITHIN the
  // org that owns the business number this message arrived on. This used to be
  // a global findFirst on phone alone, so a number that exists as a client in
  // more than one tenant — a shared company line, a customer of two shops on
  // the same instance — could file an inbound message against the wrong org's
  // client and job, and show it to that org's staff. With no orderBy, which
  // tenant won was arbitrary.
  const client = orgId
    ? await prisma.client.findFirst({
        where: {
          orgId,
          OR: [
            { phone: from },
            { phone: `+${from}` },
            { phone: rawFrom },
          ],
        },
        select: { id: true },
      })
    : null;

  // Find the most recent non-terminal job for this client
  let jobId: string | null = null;
  if (client && orgId) {
    const activeJob = await prisma.job.findFirst({
      where: {
        orgId,
        clientId: client.id,
        status: { notIn: ["COMPLETED", "CLOSED", "DELIVERED"] },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    // Fall back to the very latest job if all are terminal
    const latestJob = activeJob ?? await prisma.job.findFirst({
      where: { orgId, clientId: client.id },
      orderBy: { receivedAt: "desc" },
      select: { id: true },
    });
    jobId = latestJob?.id ?? null;
  }

  await prisma.inboundMessage.upsert({
    where: { wamid },
    create: {
      wamid,
      from,
      body,
      mediaType,
      mediaId,
      mediaCaption,
      timestamp,
      orgId,
      clientId: client?.id ?? null,
      jobId,
      isRead: false,
    },
    update: {},
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const appSecret = process.env.WHATSAPP_WEBHOOK_APP_SECRET;
  // Fail closed in production: an unsigned/unverifiable webhook must be rejected,
  // never accepted. Without the secret an attacker could forge delivery statuses
  // and inject inbound "client" messages. (Dev/test may run without it.)
  if (!appSecret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, error: "Webhook not configured" }, { status: 500 });
    }
  } else {
    const signature = request.headers.get("x-hub-signature-256");
    const ok = verifySignature({ rawBody, signature, appSecret });
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: MetaWebhookPayload | null = null;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const statusUpdates: Array<{
    id: string;
    status: string;
    at: Date | null;
    errorCode: string | null;
    error: string | null;
  }> = [];

  const inboundMessages: Array<{ msg: MetaMessage; phoneNumberId: string | null }> = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        const id = typeof s.id === "string" ? s.id : null;
        const status = typeof s.status === "string" ? s.status : null;
        const ts = typeof s.timestamp === "string" ? Number(s.timestamp) : null;
        if (!id || !status) continue;

        const firstError = Array.isArray(s.errors) && s.errors.length > 0 ? s.errors[0] : null;
        const errorCode = firstError?.code !== undefined ? String(firstError.code) : null;
        const error = firstError ? JSON.stringify(firstError).slice(0, 2000) : null;
        statusUpdates.push({ id, status, at: ts ? new Date(ts * 1000) : null, errorCode, error });
      }

      const phoneNumberId = change.value?.metadata?.phone_number_id ?? null;
      for (const msg of change.value?.messages ?? []) {
        inboundMessages.push({ msg, phoneNumberId });
      }
    }
  }

  // Process delivery status updates
  const deliveryResults = await Promise.all(
    statusUpdates.map(async (s) => {
      const res = await prisma.outboundMessage.updateMany({
        where: { providerMessageId: s.id },
        data: {
          providerDeliveryStatus: s.status,
          providerDeliveryAt: s.at ?? undefined,
          providerDeliveryErrorCode: s.errorCode ?? undefined,
          providerDeliveryError: s.error ?? undefined,
        },
      });
      return res.count;
    }),
  );

  // Process inbound messages (best-effort — don't fail the webhook on errors)
  let inboundStored = 0;
  const orgIdByPhoneNumberId = new Map<string, string | null>();
  for (const { msg, phoneNumberId } of inboundMessages) {
    try {
      let orgId: string | null = null;
      if (phoneNumberId) {
        if (!orgIdByPhoneNumberId.has(phoneNumberId)) {
          orgIdByPhoneNumberId.set(phoneNumberId, await findOrgIdByWhatsAppPhoneNumberId(phoneNumberId));
        }
        orgId = orgIdByPhoneNumberId.get(phoneNumberId) ?? null;
      }
      await handleInboundMessage(msg, orgId);
      inboundStored++;
    } catch (err) {
      console.error("[WhatsApp webhook] Failed to store inbound message:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    deliveryUpdated: deliveryResults.reduce((a, b) => a + b, 0),
    inboundStored,
  });
}
