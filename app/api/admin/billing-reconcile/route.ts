import { NextResponse } from "next/server";

import { assertPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { PLAN_PRICES } from "@/lib/plan-prices";

export const dynamic = "force-dynamic";

/**
 * Which customers paid and were never activated?
 *
 * The Pesapal webhook verified the amount paid against a price table that had
 * drifted off the plan ladder — STANDARD, GROWTH and PREMIUM were missing from
 * it entirely and ENTERPRISE carried 120,000 against a 200,000 charge. Every
 * purchasable plan failed the check, and the handler answers HTTP 200 either
 * way because Pesapal requires that acknowledgment, so the provider recorded
 * the notification as delivered and never retried.
 *
 * The important limitation, and the reason this route leads with it: the
 * webhook returns BEFORE recordBillingEvent runs, so a payment that failed
 * verification left no row in this database. Nothing here can name the
 * affected customers directly. What it can do is narrow the search — the
 * browser callback used the correct prices and did activate, so anyone who
 * returned to the site is fine. The exposure is organisations that look like
 * they tried to pay and are not on a paid plan, and that list checked against
 * completed transactions in Pesapal is what identifies a real loss.
 *
 * Read-only. Every call here is a count, a groupBy or a findMany; the route
 * exports only GET and writes nothing.
 *
 * Exists as a route rather than a script because the alternative is copying
 * database credentials out of Vercel by hand, which is both worse security and
 * — twice, in practice — the step that goes wrong.
 */
export async function GET() {
  const user = await assertPlatformAdmin();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // The plans a customer can actually buy. STARTER is free and has no price.
  const PURCHASABLE = Object.keys(PLAN_PRICES);

  // ── 1. The shape of the customer base ────────────────────────────────────
  const orgs = await prisma.organization.findMany({
    select: {
      id: true, name: true, plan: true, billingStatus: true,
      trialEndsAt: true, planRenewsAt: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  }).catch(() => []);

  const subscriptionStates = Object.entries(
    orgs.reduce<Record<string, number>>((acc, o) => {
      const key = `${o.billingStatus ?? "(null)"} / ${o.plan ?? "(null)"}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count);

  // ── 2. What payment events exist at all ──────────────────────────────────
  // On a healthy system there would be one per activation. None at all is
  // consistent with the defect rather than reassuring.
  type EventRow = {
    orgId: string; plan: string | null; status: string | null;
    amount: number | null; currency: string | null; eventType: string;
    occurredAt: Date;
  };
  let events: EventRow[] = [];
  let eventsReadable = true;
  try {
    events = await prisma.orgSubscriptionEvent.findMany({
      select: {
        orgId: true, plan: true, status: true, amount: true,
        currency: true, eventType: true, occurredAt: true,
      },
      orderBy: { occurredAt: "desc" },
      take: 500,
    });
  } catch {
    // The table is created lazily by recordBillingEvent; absent is a finding.
    eventsReadable = false;
  }

  const paymentEvents = Object.entries(
    events.reduce<Record<string, number>>((acc, e) => {
      const key = `${e.eventType} / ${e.status ?? "(null)"}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count);

  const orgById = new Map(orgs.map((o) => [o.id, o]));

  // ── 3. A recorded payment whose organisation is not on that plan ─────────
  const planMismatches = events
    .filter((e) => e.plan && orgById.get(e.orgId)?.plan !== e.plan)
    .map((e) => ({
      org: orgById.get(e.orgId)?.name ?? e.orgId,
      paidFor: e.plan,
      currentPlan: orgById.get(e.orgId)?.plan ?? null,
      billingStatus: orgById.get(e.orgId)?.billingStatus ?? null,
      amount: e.amount,
      occurredAt: e.occurredAt,
    }));

  // ── 4. A recorded amount that is not a price we charge ───────────────────
  const amountMismatches = events
    .filter((e) => e.plan && e.amount != null && PLAN_PRICES[e.plan] != null && e.amount !== PLAN_PRICES[e.plan])
    .map((e) => ({
      org: orgById.get(e.orgId)?.name ?? e.orgId,
      plan: e.plan,
      recorded: e.amount,
      charged: e.plan ? PLAN_PRICES[e.plan] : null,
      occurredAt: e.occurredAt,
    }));

  // ── 5. The list to take to Pesapal ───────────────────────────────────────
  // Anyone here with a completed Pesapal transaction paid and was not
  // activated. This database cannot make that distinction on its own.
  const toCheckAgainstPesapal = orgs
    .filter((o) => !o.plan || !PURCHASABLE.includes(o.plan) ||
      ["TRIALING", "PAST_DUE", "CANCELLED"].includes(o.billingStatus ?? ""))
    .map((o) => ({
      id: o.id,
      name: o.name,
      plan: o.plan ?? null,
      billingStatus: o.billingStatus ?? null,
      trialEndsAt: o.trialEndsAt,
      createdAt: o.createdAt,
    }));

  return NextResponse.json({
    readOnly: true,
    generatedAt: new Date().toISOString(),

    whatThisCanTellYou:
      "The webhook returned before recording anything, so a payment that failed verification " +
      "left no row here. This cannot name affected customers directly. Section 5 is the list to " +
      "check against completed transactions in the Pesapal dashboard — a match there is a " +
      "customer who paid and was never activated. The merchant reference carries the orgId and " +
      "the intended plan, so it identifies both sides.",

    pricesCharged: PLAN_PRICES,

    subscriptionStates,

    paymentEvents: eventsReadable ? paymentEvents : null,
    paymentEventsNote: !eventsReadable
      ? "OrgSubscriptionEvent could not be read — the table is created lazily and may not exist."
      : paymentEvents.length === 0
        ? "No payment events recorded at all. Consistent with the defect: no webhook activation has ever been written here."
        : null,

    planMismatches,
    amountMismatches,

    toCheckAgainstPesapal,
    counts: {
      organisations: orgs.length,
      events: events.length,
      planMismatches: planMismatches.length,
      amountMismatches: amountMismatches.length,
      toCheck: toCheckAgainstPesapal.length,
    },
  });
}
