import { NextRequest, NextResponse } from "next/server";

import { assertCronAuthorized } from "@/lib/cron-auth";
import { runSubscriptionLifecycle } from "@/lib/billing/subscription-lifecycle";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authError = assertCronAuthorized(request);
  if (authError) return authError;

  try {
    const result = await runSubscriptionLifecycle();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/subscription-lifecycle] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
