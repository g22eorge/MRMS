import { NextRequest, NextResponse } from "next/server";
import { sanitizeText, sanitizeOptionalText } from "@/lib/sanitize";
import { createRepairRequest } from "@/lib/repairs/request";
import { prisma } from "@/lib/prisma";
import { deliverOutboundMessage, enqueueWhatsAppMessage } from "@/lib/notifications/whatsapp-outbox";

const ALLOWED_ORIGINS = [
  process.env.ALLOWED_ORIGIN_1 || "https://www.eagleinfosolutions.com",
  process.env.ALLOWED_ORIGIN_2 || "https://eagleinfosolutions.com",
].filter(Boolean);

function getCorsHeaders(origin: string | null) {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : "https://www.eagleinfosolutions.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

function normalizeUgandaPhone(input: string): string {
  const trimmed = input.replace(/\s+/g, "").replace(/-/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("256")) return `+${trimmed}`;
  if (trimmed.startsWith("0")) return `+256${trimmed.slice(1)}`;
  return trimmed;
}

const ALLOWED_DEVICE_TYPES = [
  "PHONE_ANDROID",
  "PHONE_IPHONE",
  "TABLET",
  "WINDOWS_PC",
  "MAC",
  "OTHER",
];

const ALLOWED_HANDOVER_METHODS = [
  "SELF_DROPOFF",
  "SEND_WITH_DELIVERY_PERSON",
  "REQUEST_PICKUP",
];

function validatePayload(body: Record<string, unknown>): string[] {
  const errors: string[] = [];

  // Support both website format and MRMS format
  const phone = body.phone || body.customer_phone;
  const deviceType = body.device_type;
  const brand = body.brand || body.device_brand;
  const problemDescription = body.problem_description || body.issue_description;
  const handoverMethod = body.handover_method || "SELF_DROPOFF"; // website doesn't send this

  if (!body.customer_name?.toString().trim() && !body.customer_name?.toString().trim()) errors.push("Customer name is required");
  if (!phone?.toString().trim()) errors.push("Phone is required");
  if (!deviceType?.toString().trim()) errors.push("Device type is required");
  if (!brand?.toString().trim()) errors.push("Device brand is required");
  if (!problemDescription?.toString().trim()) errors.push("Issue description is required");

  const hm = handoverMethod?.toString().toLowerCase();

  if (hm === "self_dropoff") {
    if (!body.preferred_dropoff_date?.toString().trim() && !body.preferred_date?.toString().trim()) {
      errors.push("Preferred date is required for self drop-off");
    }
  }

  if (hm === "send_with_delivery_person") {
    if (!body.delivery_person_name?.toString().trim()) {
      errors.push("Delivery person name is required");
    }
    if (!body.delivery_person_phone?.toString().trim()) {
      errors.push("Delivery person phone is required");
    }
  }

  if (hm === "request_pickup") {
    if (!body.pickup_address?.toString().trim()) {
      errors.push("Pickup address is required");
    }
    if (!body.preferred_pickup_date?.toString().trim()) {
      errors.push("Preferred pickup date is required");
    }
  }

  return errors;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const body = await request.json();

    // ── Honeypot check ──────────────────────────────────────────────────────
    // Bots fill hidden fields; real users never see or touch this field.
    if (typeof body._hp === "string" && body._hp.trim().length > 0) {
      // Silently accept so bots don't know they've been blocked.
      return NextResponse.json(
        { success: true, request_number: `REQ-${Date.now()}`, message: "Your repair request has been submitted successfully. We'll contact you shortly." },
        { headers: corsHeaders }
      );
    }

    const errors = validatePayload(body);

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, errors },
        { status: 400, headers: corsHeaders }
      );
    }

    // ── Rate limiting ────────────────────────────────────────────────────────
    const ip = getClientIp(request);
    const rawPhone = (body.phone || body.customer_phone || "") as string;
    const normalizedPhoneForCheck = normalizeUgandaPhone(rawPhone);

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Max 3 submissions per phone per 24 h
    const phoneCount = await prisma.repairRequest.count({
      where: { phone: normalizedPhoneForCheck, createdAt: { gte: oneDayAgo } },
    });
    if (phoneCount >= 3) {
      return NextResponse.json(
        { success: false, error: "Too many requests from this number. Please wait 24 hours before submitting again, or call us directly on +256 772 006 344." },
        { status: 429, headers: corsHeaders }
      );
    }

    // Max 10 submissions per IP per hour
    if (ip !== "unknown") {
      const ipCount = await prisma.repairRequest.count({
        where: { submissionIp: ip, createdAt: { gte: oneHourAgo } },
      });
      if (ipCount >= 10) {
        return NextResponse.json(
          { success: false, error: "Too many requests from your network. Please try again later." },
          { status: 429, headers: corsHeaders }
        );
      }
    }

    const deviceType = (body.device_type as string).toUpperCase();
    if (!ALLOWED_DEVICE_TYPES.includes(deviceType)) {
      return NextResponse.json(
        { success: false, errors: ["Invalid device_type"] },
        { status: 400, headers: corsHeaders }
      );
    }

    // Support both website format and MRMS format
    const handoverMethod = (body.handover_method as string || "SELF_DROPOFF").toUpperCase();
    if (!ALLOWED_HANDOVER_METHODS.includes(handoverMethod)) {
      return NextResponse.json(
        { success: false, errors: ["Invalid handover_method"] },
        { status: 400, headers: corsHeaders }
      );
    }

    // Map fields from both formats
    const phone = body.phone || body.customer_phone;
    const email = body.email || body.customer_email;
    const normalizedPhone = normalizeUgandaPhone(phone as string);

    // Save to database
    const result = await createRepairRequest({
      customerName: sanitizeText((body.customer_name as string) || ""),
      phone: normalizedPhone,
      email: email ? (sanitizeOptionalText(email as string) ?? undefined) : undefined,
      deviceType: deviceType,
      brand: sanitizeText((body.brand as string) || (body.device_brand as string) || ""),
      model: (body.model || body.device_model) ? sanitizeOptionalText((body.model as string) || (body.device_model as string)) ?? undefined : undefined,
      problemDescription: sanitizeText((body.problem_description as string) || (body.issue_description as string) || ""),
      handoverMethod: handoverMethod as "SELF_DROPOFF" | "SEND_WITH_DELIVERY_PERSON" | "REQUEST_PICKUP",
      preferredDropoffDate: (body.preferred_dropoff_date || body.preferred_date) ? sanitizeOptionalText((body.preferred_dropoff_date as string) || (body.preferred_date as string)) ?? undefined : undefined,
      preferredDropoffTime: body.preferred_dropoff_time ? sanitizeOptionalText(body.preferred_dropoff_time as string) ?? undefined : undefined,
      dropoffNotes: body.dropoff_notes ? sanitizeOptionalText(body.dropoff_notes as string) ?? undefined : undefined,
      deliveryPersonName: body.delivery_person_name ? sanitizeOptionalText(body.delivery_person_name as string) ?? undefined : undefined,
      deliveryPersonPhone: body.delivery_person_phone ? normalizeUgandaPhone(body.delivery_person_phone as string) : undefined,
      deliveryCompany: body.delivery_company ? sanitizeOptionalText(body.delivery_company as string) ?? undefined : undefined,
      dispatchDate: body.dispatch_date ? sanitizeOptionalText(body.dispatch_date as string) ?? undefined : undefined,
      expectedArrivalTime: body.expected_arrival_time ? sanitizeOptionalText(body.expected_arrival_time as string) ?? undefined : undefined,
      deliveryTrackingReference: body.delivery_tracking_reference ? sanitizeOptionalText(body.delivery_tracking_reference as string) ?? undefined : undefined,
      deliveryFeeResponsibility: body.delivery_fee_responsibility ? sanitizeOptionalText(body.delivery_fee_responsibility as string) ?? undefined : undefined,
      deliveryNotes: body.delivery_notes ? sanitizeOptionalText(body.delivery_notes as string) ?? undefined : undefined,
      pickupAddress: body.pickup_address ? sanitizeOptionalText(body.pickup_address as string) ?? undefined : undefined,
      pickupLandmark: body.pickup_landmark ? sanitizeOptionalText(body.pickup_landmark as string) ?? undefined : undefined,
      preferredPickupDate: body.preferred_pickup_date ? sanitizeOptionalText(body.preferred_pickup_date as string) ?? undefined : undefined,
      preferredPickupTime: body.preferred_pickup_time ? sanitizeOptionalText(body.preferred_pickup_time as string) ?? undefined : undefined,
      alternateContactPerson: body.alternate_contact_person ? sanitizeOptionalText(body.alternate_contact_person as string) ?? undefined : undefined,
      alternateContactPhone: body.alternate_contact_phone ? normalizeUgandaPhone(body.alternate_contact_phone as string) : undefined,
      pickupNotes: body.pickup_notes ? sanitizeOptionalText(body.pickup_notes as string) ?? undefined : undefined,
      submissionIp: ip,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to create request" },
        { status: 500, headers: corsHeaders }
      );
    }

    console.log("[RepairRequest] Created:", result.requestNumber);

    // Queue WhatsApp confirmation (durable + retryable)
    const phoneValue = String(body.phone || body.customer_phone || "");
    const customerName = String(body.customer_name ?? "Customer") as string;
    let confirmation: "queued" | "sent" | "skipped" = "skipped";
    let outboxId: string | undefined;

    if (result.requestId && phoneValue && customerName) {
      const message = `Hello ${customerName},\n\nThank you for submitting your repair request (${result.requestNumber}).\n\nWe have received your device and will contact you shortly to confirm the diagnosis and timeline.\n\nBest regards,\nEagle Info Solutions`;
      const enqueueResult = await enqueueWhatsAppMessage({
        to: phoneValue,
        body: message,
        type: "REPAIR_REQUEST_CONFIRMATION",
        repairRequestId: result.requestId,
        provider: "meta",
      }).catch((err) => {
        console.error("[RepairRequest] WhatsApp enqueue failed:", err);
        return null;
      });

      if (enqueueResult && "outboxId" in enqueueResult && enqueueResult.outboxId) {
        confirmation = "queued";
        outboxId = enqueueResult.outboxId;
      } else if (enqueueResult && "sent" in enqueueResult && enqueueResult.sent) {
        confirmation = "sent";
      }

      // In serverless runtimes, fire-and-forget work may be cut short.
      // Best-effort attempt to deliver immediately (timeout capped).
      if (enqueueResult && "outboxId" in enqueueResult && enqueueResult.outboxId) {
        const attempt = await Promise.race([
          deliverOutboundMessage(enqueueResult.outboxId),
          new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: "timeout" }), 2500)),
        ]);
        if (attempt && typeof attempt === "object" && "ok" in attempt && (attempt as { ok: boolean }).ok) {
          console.log("[RepairRequest] WhatsApp delivered inline", enqueueResult.outboxId);
        }
      }
    }

    return NextResponse.json({
      success: true,
      request_number: result.requestNumber,
      message: "Your repair request has been submitted successfully. We'll contact you shortly.",
      confirmation,
      ...(outboxId ? { outbox_id: outboxId } : {}),
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("[RepairRequestAPI] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
