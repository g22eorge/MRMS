/**
 * GET /api/webhooks/pesapal
 *
 * Pesapal IPN (Instant Payment Notification) handler.
 * Pesapal sends a GET request with OrderTrackingId, OrderMerchantReference,
 * and OrderNotificationType when a payment status changes.
 *
 * Must respond with the Pesapal acknowledgment JSON and HTTP 200.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransactionStatus, parseMerchantRef, CURRENCY } from "@/lib/pesapal";
import { verifyPaymentAgainstPlan, applyPaymentToOrg } from "@/lib/billing/apply-payment";
import { OrgPlan } from "@prisma/client";
import { recordBillingEvent } from "@/lib/billing-events";
import { sendPaymentConfirmation, sendPaymentFailedAlert } from "@/lib/email";

/**
 * Record why a notification was not acted on, then acknowledge it.
 *
 * Every rejection path here used to `return NextResponse.json(ack)` and write
 * nothing. Pesapal requires that acknowledgment, so it treated each one as
 * delivered and never retried — and with no row left behind, a payment that
 * failed verification was indistinguishable from one that never arrived. That
 * is the single reason the price-table defect went unnoticed for the life of
 * the deployment, and the reason it could not afterwards be established which
 * customers were affected.
 *
 * orgId may be unknown at the point of rejection: a merchant reference that
 * cannot be parsed does not name an organisation. The row is still worth
 * writing, so it goes in against the empty string with the reference in txRef —
 * an unattributed rejection is a far better artefact than silence.
 */
async function rejectAndAck(params: {
  ack: Record<string, string>;
  reason: string;
  orgId?: string | null;
  plan?: string | null;
  amount?: number | null;
  currency?: string | null;
  txRef?: string | null;
  orderTrackingId?: string | null;
}) {
  try {
    await recordBillingEvent({
      orgId: params.orgId ?? "",
      event: "charge.rejected",
      amount: params.amount ?? 0,
      currency: params.currency ?? CURRENCY,
      status: params.reason,
      txRef: params.txRef ?? null,
      plan: params.plan ?? null,
      idempotencyKey: params.orderTrackingId
        ? `pesapal:${params.orderTrackingId}:rejected:${params.reason}`
        : null,
    });
  } catch (err) {
    // Never let the bookkeeping stop the acknowledgment: an unacknowledged
    // notification is retried forever.
    console.error("[webhook/pesapal] could not record rejection", params.reason, err);
  }
  console.warn(`[webhook/pesapal] rejected: ${params.reason}`, {
    orderTrackingId: params.orderTrackingId, txRef: params.txRef,
  });
  return NextResponse.json(params.ack);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const orderTrackingId = searchParams.get("OrderTrackingId") ?? "";
  const merchantReference = searchParams.get("OrderMerchantReference") ?? "";
  const notificationType = searchParams.get("OrderNotificationType") ?? "";

  // Pesapal requires this exact acknowledgment format.
  const ack = {
    orderNotificationType: notificationType,
    orderTrackingId,
    orderMerchantReference: merchantReference,
    status: "200",
  };

  if (!orderTrackingId || !merchantReference) {
    return rejectAndAck({ ack, reason: "missing-identifiers", orderTrackingId, txRef: merchantReference });
  }

  try {
    const tx = await getTransactionStatus(orderTrackingId);
    const parsed = parseMerchantRef(merchantReference);

    if (!parsed) {
      return rejectAndAck({
        ack, reason: "merchant-reference-unparseable", orderTrackingId,
        txRef: merchantReference, amount: tx.amount, currency: tx.currency,
      });
    }
    const { orgId, plan } = parsed;

    // Forgery, price and currency checks are shared with the browser callback,
    // which fires for the same transaction and used to verify differently.
    const verified = await verifyPaymentAgainstPlan({ plan, merchantReference, tx });
    if (!verified.ok) {
      return rejectAndAck({
        ack, reason: verified.reason, orgId, plan, orderTrackingId,
        txRef: merchantReference, amount: tx.amount, currency: tx.currency,
      });
    }

    if (tx.payment_status_description === "Completed") {
      const application = await applyPaymentToOrg({ orgId, plan, orderTrackingId });
      if (!application.applied && !application.alreadyApplied) {
        return rejectAndAck({
          ack, reason: application.reason, orgId, plan, orderTrackingId,
          txRef: merchantReference, amount: tx.amount, currency: tx.currency,
        });
      }
      // alreadyApplied means the browser callback got here first with this same
      // transaction. Both paths run for every payment, so this is the normal
      // case rather than an error — acknowledge and add nothing.
      const org = { name: application.orgName };

      void recordBillingEvent({
        orgId,
        event: "charge.completed",
        amount: tx.amount,
        currency: tx.currency,
        status: "successful",
        confirmationCode: tx.confirmation_code,
        txRef: merchantReference,
        plan,
        idempotencyKey: `pesapal:${orderTrackingId}:completed`,
      });

      const admin = await prisma.user.findFirst({
        where: { orgId, role: "ADMIN" },
        select: { email: true, name: true },
      });
      if (admin) {
        void sendPaymentConfirmation(admin.email, admin.name, org.name, plan as OrgPlan, tx.amount);
      }
    } else if (tx.payment_status_description === "Failed" || tx.payment_status_description === "Reversed") {
      void recordBillingEvent({
        orgId,
        event: "charge.completed",
        amount: tx.amount,
        currency: tx.currency,
        status: tx.payment_status_description.toLowerCase(),
        txRef: merchantReference,
        plan,
        idempotencyKey: `pesapal:${orderTrackingId}:${tx.payment_status_description.toLowerCase()}`,
      });

      const [org, admin] = await Promise.all([
        prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
        prisma.user.findFirst({ where: { orgId, role: "ADMIN" }, select: { email: true, name: true } }),
      ]);
      if (org && admin) {
        void sendPaymentFailedAlert(admin.email, admin.name, org.name);
      }
    } else {
      // Pending, Invalid, or anything Pesapal adds later. Not an error, but it
      // used to fall off the end of the branch and leave the notification
      // looking like it had never arrived.
      await rejectAndAck({
        ack, reason: `status-not-actioned-${tx.payment_status_description ?? "unknown"}`,
        orgId, plan, orderTrackingId, txRef: merchantReference,
        amount: tx.amount, currency: tx.currency,
      });
    }
  } catch (err) {
    console.error("[webhook/pesapal]", err);
    // Reaching here means verification threw — a Pesapal timeout, a database
    // blip. The notification is acknowledged either way, so without a row the
    // payment simply disappears.
    return rejectAndAck({
      ack, reason: "exception-during-verification", orderTrackingId, txRef: merchantReference,
    });
  }

  return NextResponse.json(ack);
}
