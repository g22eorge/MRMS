import { NextRequest, NextResponse } from "next/server";

import { assertCronAuthorized } from "@/lib/cron-auth";
import { runPaymentReminders } from "@/lib/notifications/payment-reminders";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Walks every organisation that has switched payment reminders on.
 *
 * Scheduled daily at 08:00 UTC, which is 11:00 in Kampala — inside the default
 * quiet hours, and late enough that a customer paying first thing is not chased
 * for money they have already sent.
 *
 * Every guard lives inside runPaymentReminders rather than in the schedule, so
 * running this more often would be harmless: a given (invoice, stage) pair is
 * only ever messaged once, and nothing sends outside the org's quiet hours.
 * That matters because a cron that silently stops is a feature that silently
 * stops, and a manual re-run must be safe.
 */
export async function POST(request: NextRequest) {
  const authError = assertCronAuthorized(request);
  if (authError) return authError;

  try {
    const orgs = await prisma.paymentReminderSettings.findMany({
      where: { enabled: true },
      select: { orgId: true },
    });

    const summary: Record<string, number> = { sent: 0, "dry-run": 0, skipped: 0, "manual-review": 0, statement: 0 };
    const detail: Array<{ orgId: string; outcomes: number }> = [];

    for (const { orgId } of orgs) {
      // One org's bad data must not stop the rest from being chased.
      try {
        const outcomes = await runPaymentReminders({ orgId });
        for (const o of outcomes) summary[o.action] = (summary[o.action] ?? 0) + 1;
        detail.push({ orgId, outcomes: outcomes.length });
      } catch (err) {
        console.error(`[cron/payment-reminders] org ${orgId} failed:`, err);
      }
    }

    return NextResponse.json({ organisations: orgs.length, summary, detail });
  } catch (err) {
    console.error("[cron/payment-reminders] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Vercel Cron issues a GET; sharing the handler keeps the job from 405-ing.
export const GET = POST;
