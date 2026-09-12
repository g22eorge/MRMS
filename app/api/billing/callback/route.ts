/**
 * GET /api/billing/callback
 *
 * Pesapal redirects here after the user completes (or abandons) payment.
 * Query params: OrderTrackingId, OrderMerchantReference, OrderNotificationType
 *
 * The IPN handler (/api/webhooks/pesapal) is the reliable server-to-server
 * confirmation. This callback is just for the user-facing redirect.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransactionStatus, parseMerchantRef } from "@/lib/pesapal";
import { OrgPlan } from "@prisma/client";
import { sendPaymentConfirmation } from "@/lib/email";
import { recordBillingEvent } from "@/lib/billing-events";
import { verifyPaymentAgainstPlan, applyPaymentToOrg } from "@/lib/billing/apply-payment";

/**
 * Send the customer back, and leave a record of why.
 *
 * Every refusal here used to redirect to ?payment=failed and write nothing —
 * the same silent rejection that hid the price-table defect on the webhook for
 * the life of the deployment, still present on this path after that one was
 * fixed. The customer sees the same page either way; the difference is whether
 * anyone can afterwards say what happened.
 */
async function refuse(base: string, reason: string, ctx: {
  orgId?: string | null; plan?: string | null; amount?: number | null;
  currency?: string | null; txRef?: string | null; orderTrackingId: string;
}, outcome: "failed" | "cancelled" = "failed") {
  try {
    await recordBillingEvent({
      orgId: ctx.orgId ?? "",
      event: `charge.rejected.${reason}`,
      amount: ctx.amount ?? 0,
      currency: ctx.currency ?? "",
      status: "rejected",
      txRef: ctx.txRef,
      plan: ctx.plan,
      idempotencyKey: `pesapal-callback:${ctx.orderTrackingId}:${reason}`,
    });
  } catch (err) {
    // Never let bookkeeping strand the customer on a blank page.
    console.error("[billing/callback] could not record rejection", reason, err);
  }
  console.warn(`[billing/callback] rejected: ${reason}`, { orderTrackingId: ctx.orderTrackingId, txRef: ctx.txRef });
  return NextResponse.redirect(`${base}/settings/billing?payment=${outcome}`);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const orderTrackingId = searchParams.get("OrderTrackingId");
  const merchantReference = searchParams.get("OrderMerchantReference");
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!orderTrackingId || !merchantReference) {
    return NextResponse.redirect(`${base}/settings/billing?payment=cancelled`);
  }

  try {
    const tx = await getTransactionStatus(orderTrackingId);

    const ctx = {
      amount: tx.amount, currency: tx.currency,
      txRef: merchantReference, orderTrackingId,
    };

    if (tx.payment_status_description !== "Completed") {
      return refuse(base, `status-not-actioned-${tx.payment_status_description ?? "unknown"}`, ctx);
    }

    const parsed = parseMerchantRef(merchantReference);
    if (!parsed) return refuse(base, "merchant-reference-unparseable", ctx);
    const { orgId, plan } = parsed;

    // Shared with the webhook, which fires for this same transaction. These
    // two used to verify differently: the webhook honoured a platform price
    // override and this path did not, so a custom price made the customer's
    // own browser refuse a payment the server had already accepted.
    const verified = await verifyPaymentAgainstPlan({ plan, merchantReference, tx });
    if (!verified.ok) return refuse(base, verified.reason, { ...ctx, orgId, plan });

    const application = await applyPaymentToOrg({ orgId, plan, orderTrackingId });
    if (!application.applied && !application.alreadyApplied) {
      return refuse(base, application.reason, { ...ctx, orgId, plan });
    }

    // alreadyApplied means the webhook got here first with this same
    // transaction — the normal case, since both paths run for every payment.
    // The customer still gets the success page; nothing is granted twice.
    const updatedOrg = { name: application.orgName };
    if (!application.applied) {
      return NextResponse.redirect(`${base}/settings/billing?payment=success`);
    }

    const admin = await prisma.user.findFirst({
      where: { orgId, role: "ADMIN" },
      select: { email: true, name: true },
    });
    if (admin) {
      void sendPaymentConfirmation(admin.email, admin.name, updatedOrg.name, plan as OrgPlan, tx.amount);
    }

    // Deliberately the same idempotency key the webhook uses, so the ledger
    // gets exactly one entry per transaction whichever path arrives first —
    // and still gets one if the webhook never arrives at all.
    void recordBillingEvent({
      orgId, event: "charge.completed", amount: tx.amount, currency: tx.currency ?? "",
      status: "successful", confirmationCode: tx.confirmation_code,
      txRef: merchantReference, plan,
      idempotencyKey: `pesapal:${orderTrackingId}:completed`,
    });

    return NextResponse.redirect(`${base}/settings/billing?payment=success`);
  } catch (err) {
    console.error("[billing/callback]", err);
    // The last silent path on this route: a thrown verification left the
    // customer on ?payment=failed with nothing written down anywhere.
    return refuse(base, "exception-during-verification", {
      orderTrackingId: orderTrackingId ?? "", txRef: merchantReference,
    });
  }
}
