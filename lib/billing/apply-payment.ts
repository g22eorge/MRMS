import { prisma } from "@/lib/prisma";
import { OrgPlan } from "@prisma/client";
import { CURRENCY } from "@/lib/pesapal";
import { getEffectivePlanPrice } from "@/lib/plan-prices";

/**
 * Verifying a completed Pesapal payment, and applying it to an organisation.
 *
 * Two paths reach this system and BOTH fire for the same transaction: Pesapal
 * redirects the customer's browser to /api/billing/callback and separately
 * sends a server-to-server notification to /api/webhooks/pesapal. Each had its
 * own copy of this logic, and the copies had already drifted three ways:
 *
 *   - Neither checked whether a transaction had already been applied, while
 *     both extend planRenewsAt from its current value. One payment therefore
 *     granted two months. Not an edge case — it is what happens on every
 *     successful payment, because both paths always run.
 *   - The callback verified against the raw price table while the webhook used
 *     the platform-settings override, so a custom price would make the callback
 *     reject payments the webhook accepted.
 *   - The callback recorded nothing when it refused, which is the same silent
 *     rejection that hid the original price-table defect for the life of the
 *     deployment.
 *
 * Split in two because the webhook verifies before it branches on payment
 * status, and only applies on "Completed". Reasons are returned rather than
 * logged, so each caller records them in its own way and the webhook's existing
 * strings stay byte-identical.
 */

function addOneMonth(from: Date) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

export type Verification =
  | { ok: true; expected: number }
  | { ok: false; reason: string };

/** Does this transaction pay what the plan costs, for the org it names? */
export async function verifyPaymentAgainstPlan(params: {
  plan: string;
  merchantReference: string;
  tx: { amount: number; currency?: string | null; merchant_reference?: string | null };
}): Promise<Verification> {
  const { plan, merchantReference, tx } = params;

  // Not a mishap — somebody trying to activate an organisation they did not
  // pay for. It used to leave no trace whatsoever.
  if (tx.merchant_reference !== merchantReference) {
    return { ok: false, reason: "merchant-reference-mismatch-possible-forgery" };
  }

  // The override first, so a platform-set price is authoritative on both paths.
  const expected = await getEffectivePlanPrice(plan);
  if (typeof expected !== "number") return { ok: false, reason: `no-price-configured-for-${plan}` };
  if (tx.currency !== CURRENCY) {
    return { ok: false, reason: `currency-mismatch-${tx.currency}-expected-${CURRENCY}` };
  }
  if (tx.amount !== expected) {
    // The path the price-table defect took, every time, for every plan.
    return { ok: false, reason: `amount-mismatch-paid-${tx.amount}-expected-${expected}` };
  }
  return { ok: true, expected };
}

export type Application =
  | { applied: true; orgName: string; renewsAt: Date }
  /** Already applied by the other path. Not an error — the correct outcome. */
  | { applied: false; alreadyApplied: true; orgName: string }
  | { applied: false; alreadyApplied?: false; reason: string };

/** Extend the subscription, exactly once per transaction. */
export async function applyPaymentToOrg(params: {
  orgId: string;
  plan: string;
  orderTrackingId: string;
}): Promise<Application> {
  const { orgId, plan, orderTrackingId } = params;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, planRenewsAt: true, flwSubscriptionId: true },
  });
  // Paid for an organisation that no longer exists — money in, nothing to
  // credit it to, and previously no record that it happened.
  if (!org) return { applied: false, reason: "organisation-not-found" };

  if (org.flwSubscriptionId === orderTrackingId) {
    return { applied: false, alreadyApplied: true, orgName: org.name };
  }

  const baseDate = org.planRenewsAt && org.planRenewsAt > new Date() ? org.planRenewsAt : new Date();
  const renewsAt = addOneMonth(baseDate);

  // The guard is in the WHERE clause rather than only in the read above,
  // because the callback and the webhook genuinely race: both can read a null
  // flwSubscriptionId before either writes. Evaluated inside the UPDATE, the
  // loser of that race matches no rows and applies nothing.
  const { count } = await prisma.organization.updateMany({
    where: {
      id: orgId,
      OR: [{ flwSubscriptionId: null }, { flwSubscriptionId: { not: orderTrackingId } }],
    },
    data: {
      plan: plan as OrgPlan,
      billingStatus: "ACTIVE",
      planRenewsAt: renewsAt,
      planCancelledAt: null,
      flwSubscriptionId: orderTrackingId,
    },
  });

  if (count === 0) return { applied: false, alreadyApplied: true, orgName: org.name };
  return { applied: true, orgName: org.name, renewsAt };
}
