import { NextRequest, NextResponse } from "next/server";

import { assertCronAuthorized } from "@/lib/cron-auth";
import { runPayablesForOrg } from "@/lib/commercial/payables-digest";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Daily payables run, 06:00 UTC (09:00 Kampala — first thing, before money
 * moves). For every org: raise due recurring expenses as UNPAID rows, then
 * nudge finance staff once if anything is overdue or due within 7 days.
 *
 * Re-runs are safe: issuing is idempotent per (template, period) and the
 * digest is one unread note per user per day. One org's bad data never stops
 * the rest.
 */
export async function POST(request: NextRequest) {
  const authError = assertCronAuthorized(request);
  if (authError) return authError;

  try {
    const orgs = await prisma.organization.findMany({ select: { id: true } });
    const summary = { issued: 0, skipped: 0, digestTo: 0, organisations: orgs.length };
    for (const { id } of orgs) {
      try {
        const outcome = await runPayablesForOrg(id);
        summary.issued += outcome.issued;
        summary.skipped += outcome.skipped;
        summary.digestTo += outcome.digestTo;
      } catch (err) {
        console.error(`[cron/payables] org ${id} failed:`, err);
      }
    }
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[cron/payables] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Vercel Cron issues a GET; sharing the handler keeps the job from 405-ing.
export const GET = POST;
