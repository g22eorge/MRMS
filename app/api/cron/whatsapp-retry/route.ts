import { NextRequest, NextResponse } from "next/server";

import { getOutboxRetryLimit, retryDueOutboundMessages } from "@/lib/notifications/whatsapp-outbox";
import { assertCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authError = assertCronAuthorized(request);
  if (authError) return authError;

  try {
    const result = await retryDueOutboundMessages(getOutboxRetryLimit(25));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/whatsapp-retry] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Vercel Cron invokes the scheduled path with a GET, so a POST-only route is
// answered with 405 and the job silently never runs. Both verbs share one
// handler; authorisation is header-based (Authorization: Bearer CRON_SECRET),
// so it is identical either way.
export const GET = POST;
