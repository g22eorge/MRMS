import { NextResponse } from "next/server";

import { assertPlatformAdmin } from "@/lib/platform-admin";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { getTransactionStatus, parseMerchantRef, CURRENCY } from "@/lib/pesapal";
import { PLAN_PRICES } from "@/lib/plan-prices";

export const dynamic = "force-dynamic";

/**
 * Check specific Pesapal transactions against what this database did about them.
 *
 * Answers, per transaction: did the money arrive, and did the organisation get
 * what it paid for? A "Completed" transaction whose organisation was never
 * activated is a customer charged for nothing.
 *
 * It takes tracking ids rather than finding them because Pesapal's v3 API has
 * no endpoint that lists transactions — only GetTransactionStatus, which
 * answers about one id you already hold. Nothing here can enumerate what
 * exists, so the ids come from the merchant dashboard by hand. That is a limit
 * of the API, not of this route.
 *
 * Read-only on both sides: GetTransactionStatus is a read at Pesapal, and every
 * query here is a findUnique. Nothing is activated, corrected or refunded — if
 * this finds money owed, acting on it is a decision for a person.
 */

const MAX_IDS = 50;

type Verdict =
  | "PAID AND ACTIVATED"
  | "PAID BUT NEVER ACTIVATED"
  | "PAID, ACTIVATED, WRONG AMOUNT"
  | "NOT COMPLETED"
  | "UNREADABLE REFERENCE"
  | "ORGANISATION GONE"
  | "LOOKUP FAILED";

async function verify(trackingId: string) {
  let tx;
  try {
    tx = await getTransactionStatus(trackingId);
  } catch (err) {
    return {
      trackingId,
      verdict: "LOOKUP FAILED" as Verdict,
      detail: err instanceof Error ? err.message.slice(0, 160) : "Pesapal did not answer",
    };
  }

  const completed = tx.payment_status_description === "Completed";
  const parsed = parseMerchantRef(tx.merchant_reference ?? "");

  if (!parsed) {
    return {
      trackingId,
      verdict: "UNREADABLE REFERENCE" as Verdict,
      status: tx.payment_status_description,
      amount: tx.amount,
      currency: tx.currency,
      merchantReference: tx.merchant_reference,
      detail: "The reference does not carry an orgId and plan, so this payment cannot be attributed from here.",
    };
  }

  const { orgId, plan } = parsed;
  const org = await prisma.organization
    .findUnique({
      where: { id: orgId },
      select: { id: true, name: true, plan: true, billingStatus: true, flwSubscriptionId: true, planRenewsAt: true },
    })
    .catch(() => null);

  const expected = PLAN_PRICES[plan] ?? null;
  const amountMatches = expected != null && tx.amount === expected && tx.currency === CURRENCY;
  // The tracking id is written to flwSubscriptionId only by a successful
  // callback, so its presence is what "we acted on this payment" looks like.
  const activatedByThis = org?.flwSubscriptionId === trackingId;

  let verdict: Verdict;
  if (!completed) verdict = "NOT COMPLETED";
  else if (!org) verdict = "ORGANISATION GONE";
  else if (!activatedByThis) verdict = "PAID BUT NEVER ACTIVATED";
  else if (!amountMatches) verdict = "PAID, ACTIVATED, WRONG AMOUNT";
  else verdict = "PAID AND ACTIVATED";

  return {
    trackingId,
    verdict,
    status: tx.payment_status_description,
    paid: tx.amount,
    currency: tx.currency,
    expectedForPlan: expected,
    amountMatches,
    paidAt: tx.created_date,
    confirmationCode: tx.confirmation_code,
    merchantReference: tx.merchant_reference,
    intendedPlan: plan,
    organisation: org ? { id: org.id, name: org.name, plan: org.plan, billingStatus: org.billingStatus } : null,
    detail:
      verdict === "PAID BUT NEVER ACTIVATED"
        ? "Money arrived and this organisation carries no record of it. Owed either the plan they paid for or a refund."
        : verdict === "PAID AND ACTIVATED"
          ? "Nothing owed — the payment reached the organisation."
          : verdict === "ORGANISATION GONE"
            ? "Paid for an organisation that no longer exists."
            : verdict === "PAID, ACTIVATED, WRONG AMOUNT"
              ? "Activated, but the amount does not match the plan's price. Worth reading closely."
              : "Not a completed payment; nothing owed.",
  };
}

function idsFrom(raw: string | null): string[] {
  return (raw ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);
}

export async function GET(req: Request) {
  const admin = await assertPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ids = idsFrom(new URL(req.url).searchParams.get("ids"));
  if (!ids.length) {
    // A form rather than an error: the ids are pasted from the dashboard, and
    // a URL is a poor place to type fifty of them.
    return new NextResponse(
      `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verify payments</title>
<style>
 body{font:15px/1.6 system-ui,sans-serif;max-width:44rem;margin:3rem auto;padding:0 1.2rem;background:#0f0f0f;color:#e8e8e8}
 h1{font-size:1.3rem;margin:0 0 .4rem} p{color:#a5a5a5;margin:.4rem 0 1rem}
 textarea{width:100%;min-height:10rem;background:#161616;color:#e8e8e8;border:1px solid #333;border-radius:8px;padding:.7rem;font:13px ui-monospace,monospace}
 button{margin-top:.8rem;background:#C9A227;color:#1a1500;border:0;border-radius:8px;padding:.6rem 1.1rem;font-weight:700;cursor:pointer}
 code{background:#1c1c1c;padding:1px 5px;border-radius:4px}
</style></head><body>
<h1>Verify Pesapal payments</h1>
<p>Paste order tracking ids from the Pesapal dashboard — one per line, up to ${MAX_IDS}.
Each is checked against Pesapal and against this database, and reported as paid-and-activated,
paid-but-never-activated, or not completed. Nothing is changed either side.</p>
<form method="POST"><textarea name="ids" placeholder="e.g.&#10;b7f3c2a1-...&#10;9d41e0aa-..."></textarea>
<button type="submit">Check them</button></form>
</body></html>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  const rl = await rateLimit.platformAdmin(admin.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many admin operations. Wait a moment and retry." },
      { status: 429, headers: rateLimitHeaders(rl.retryAfterMs) },
    );
  }

  return NextResponse.json(await report(ids));
}

export async function POST(req: Request) {
  const admin = await assertPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Each id is an outbound call to Pesapal, so the bucket applies here too.
  const rl = await rateLimit.platformAdmin(admin.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many admin operations. Wait a moment and retry." },
      { status: 429, headers: rateLimitHeaders(rl.retryAfterMs) },
    );
  }

  const form = await req.formData().catch(() => null);
  const ids = idsFrom(form ? String(form.get("ids") ?? "") : null);
  if (!ids.length) return NextResponse.json({ error: "No tracking ids given." }, { status: 400 });

  return NextResponse.json(await report(ids));
}

async function report(ids: string[]) {
  // Sequential rather than parallel: this is a courtesy to Pesapal's API, and
  // fifty lookups is not worth a burst that might get the account throttled.
  const results = [];
  for (const id of ids) results.push(await verify(id));

  const owed = results.filter((r) => r.verdict === "PAID BUT NEVER ACTIVATED");
  const totalOwed = owed.reduce((sum, r) => sum + (("paid" in r && r.paid) || 0), 0);

  return {
    readOnly: true,
    checked: results.length,
    summary: {
      paidAndActivated: results.filter((r) => r.verdict === "PAID AND ACTIVATED").length,
      paidButNeverActivated: owed.length,
      notCompleted: results.filter((r) => r.verdict === "NOT COMPLETED").length,
      problems: results.filter((r) =>
        ["UNREADABLE REFERENCE", "ORGANISATION GONE", "PAID, ACTIVATED, WRONG AMOUNT", "LOOKUP FAILED"].includes(r.verdict),
      ).length,
    },
    // The number that matters: money taken with nothing delivered for it.
    amountOwed: owed.length ? { total: totalOwed, currency: CURRENCY, organisations: owed.map((r) => ("organisation" in r && r.organisation?.name) || r.trackingId) } : null,
    results,
  };
}
