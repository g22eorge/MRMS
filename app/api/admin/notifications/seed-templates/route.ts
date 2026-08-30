import { NextResponse } from "next/server";

import { assertPlatformAdmin } from "@/lib/platform-admin";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await assertPlatformAdmin();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }


  return NextResponse.json(
    {
      ok: true,
      message: "Default communication templates are no longer seeded. Orgs create their own templates in /communications/templates.",
    },
    { status: 200 },
  );
}

export async function POST() {
  const user = await assertPlatformAdmin();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Bounds what a hijacked admin session can do in a burst, and stops a
  // repeated click re-running this while the first run is still working.
  const rl = await rateLimit.platformAdmin(user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many admin operations. Wait a moment and retry." },
      { status: 429, headers: rateLimitHeaders(rl.retryAfterMs) },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      reason: "Disabled",
      message: "Default communication templates are no longer seeded. Create org templates in /communications/templates.",
    },
    { status: 410 },
  );
}
