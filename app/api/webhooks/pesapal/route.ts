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
import { getEffectivePlanPrice } from "@/lib/plan-prices";
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

function addOneMonth(from: Date) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
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

    // Prevent forged merchantReference activating other orgs. This one is not
    // a mishap — it is somebody trying to activate an organisation they did not
    // pay for, and it used to leave no trace whatsoever.
    if (tx.merchant_reference !== merchantReference) {
      return rejectAndAck({
        ack, reason: "merchant-reference-mismatch-possible-forgery", orgId, plan,
        orderTrackingId, txRef: merchantReference, amount: tx.amount, currency: tx.currency,
      });
    }

    // Ensure the paid amount matches the intended plan (Zoho-synced or fallback price).
    const expectedAmount = await getEffectivePlanPrice(plan);
    if (tx.currency !== CURRENCY || typeof expectedAmount !== "number" || tx.amount !== expectedAmount) {
      // The path the price-table defect took, every time, for every plan.
      const reason = typeof expectedAmount !== "number"
        ? `no-price-configured-for-${plan}`
        : tx.currency !== CURRENCY
          ? `currency-mismatch-${tx.currency}-expected-${CURRENCY}`
          : `amount-mismatch-paid-${tx.amount}-expected-${expectedAmount}`;
      return rejectAndAck({
        ack, reason, orgId, plan, orderTrackingId,
        txRef: merchantReference, amount: tx.amount, currency: tx.currency,
      });
    }

    if (tx.payment_status_description === "Completed") {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, planRenewsAt: true },
      });
      if (!org) {
        // Paid for an organisation that no longer exists — money in, nothing to
        // credit it to, and previously no record that it happened.
        return rejectAndAck({
          ack, reason: "organisation-not-found", orgId, plan, orderTrackingId,
          txRef: merchantReference, amount: tx.amount, currency: tx.currency,
        });
      }

      const baseDate = org.planRenewsAt && org.planRenewsAt > new Date() ? org.planRenewsAt : new Date();
      const renewsAt = addOneMonth(baseDate);

      await prisma.organization.update({
        where: { id: orgId },
        data: {
          plan: plan as OrgPlan,
          billingStatus: "ACTIVE",
          planRenewsAt: renewsAt,
          planCancelledAt: null,
          flwSubscriptionId: orderTrackingId,
        },
      });

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
