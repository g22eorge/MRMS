import { NextResponse } from "next/server";

import { assertPlatformAdmin } from "@/lib/platform-admin";
import { getDeploymentContext } from "@/lib/deployment-context";
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

  // This code ships to both deployments, and the answer only means something on
  // one of them. care is Eagle Info's own repair business — single tenant, no
  // subscriptions, nothing to reconcile — so its single organisation would
  // otherwise appear in the "check against Pesapal" list and read as a customer
  // who might have paid. Say which deployment answered, and on care say plainly
  // that the question does not apply here.
  const deployment = await getDeploymentContext();
  const appliesHere = deployment.mode === "COMMERCIAL_MULTI_TENANT";

  // The plans a customer can actually buy. STARTER is free and has no price.
  const PURCHASABLE = Object.keys(PLAN_PRICES);

  // ── 1. The shape of the customer base ────────────────────────────────────
  const orgs = await prisma.organization.findMany({
    select: {
      id: true, name: true, plan: true, billingStatus: true,
      trialEndsAt: true, planRenewsAt: true, createdAt: true,
      // The two fields that say HOW an organisation became active. A successful
      // callback writes planRenewsAt and stores the Pesapal orderTrackingId in
      // flwSubscriptionId; setPlanAction and setBillingStatusAction, the manual
      // routes, write neither. So the activation path is readable from here
      // after all — and where a tracking id exists, it is the exact reference
      // to look up rather than a name to search for.
      flwSubscriptionId: true,
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
  // BillingEvent, not OrgSubscriptionEvent. This route first queried the
  // latter and reported "no payment events at all" — from a table payments
  // never write to. recordBillingEvent inserts into "BillingEvent", a raw
  // table created lazily and absent from schema.prisma, which is why the
  // mistake typechecked and read as a finding. On a healthy system there is
  // one row per activation; none is meaningful only when read here.
  type EventRow = {
    orgId: string; plan: string | null; status: string | null;
    amount: number | null; currency: string | null; eventType: string;
    occurredAt: Date;
  };
  let events: EventRow[] = [];
  let eventsReadable = true;
  try {
    const rows = await prisma.$queryRaw<Array<{
      orgId: string; plan: string | null; status: string | null;
      amount: number | null; currency: string | null; event: string; createdAt: Date;
    }>>`
      SELECT orgId, plan, status, amount, currency, event, createdAt
      FROM "BillingEvent" ORDER BY createdAt DESC LIMIT 500
    `;
    events = rows.map((r) => ({
      orgId: r.orgId, plan: r.plan, status: r.status, amount: r.amount,
      currency: r.currency, eventType: r.event, occurredAt: r.createdAt,
    }));
  } catch {
    // Lazily created, so absent means nothing has ever been recorded.
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

  // ── 4b. How each active organisation became active ───────────────────────
  const activeOrgs = orgs
    .filter((o) => o.billingStatus === "ACTIVE")
    .map((o) => {
      const paidThroughCallback = Boolean(o.flwSubscriptionId);
      return {
        name: o.name,
        plan: o.plan,
        // Present only when a payment actually completed through the callback.
        pesapalOrderTrackingId: o.flwSubscriptionId ?? null,
        planRenewsAt: o.planRenewsAt,
        activatedBy: paidThroughCallback ? "payment (callback)" : "by hand — no payment recorded",
        // A renewal date without a tracking id means someone set the plan and
        // the date came from an earlier cycle; worth looking at either way.
        note: paidThroughCallback
          ? "Look this tracking id up in Pesapal to confirm the amount matches the plan."
          : "No Pesapal reference on this organisation. It was activated by a platform admin, or by a payment that never reached the callback.",
      };
    });

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

    deployment: deployment.mode === "CARE_SINGLE_TENANT" ? "care (single tenant)" : "commercial (multi tenant)",
    appliesHere,
    ...(appliesHere ? {} : {
      note:
        "This is the single-tenant care deployment, which takes no subscriptions — there is " +
        "nothing here to reconcile. Run this on app.eagleinfosolutions.com, where the " +
        "commercial product bills customers. The figures below describe this deployment's own " +
        "organisation and are not evidence of a missed payment.",
    }),

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
      ? "The BillingEvent table does not exist yet — it is created on the first recorded event, so nothing has ever been written."
      : paymentEvents.length === 0
        ? "No payment events recorded at all. Read from BillingEvent, which is where payments are written."
        : null,

    planMismatches,
    amountMismatches,

    // Notifications Pesapal delivered that were not acted on, and why. Before
    // these were recorded, every one of them was indistinguishable from a
    // payment that never arrived.
    rejections: events
      .filter((e) => e.eventType === "charge.rejected")
      .map((e) => ({
        org: orgById.get(e.orgId)?.name ?? e.orgId ?? "(unattributed)",
        reason: e.status,
        plan: e.plan,
        amount: e.amount,
        at: e.occurredAt,
      })),

    // Answers "who actually paid?" for the organisations that are live, which
    // the earlier version of this route could not and said so.
    activeOrgs,

    toCheckAgainstPesapal,
    counts: {
      organisations: orgs.length,
      active: orgs.filter((o) => o.billingStatus === "ACTIVE").length,
      activeWithPesapalReference: orgs.filter((o) => o.billingStatus === "ACTIVE" && o.flwSubscriptionId).length,
      events: events.length,
      planMismatches: planMismatches.length,
      amountMismatches: amountMismatches.length,
      toCheck: toCheckAgainstPesapal.length,
    },
  });
}
