import { NextRequest, NextResponse } from "next/server";

import { runDataHeal } from "@/lib/data-heal";
import { prisma } from "@/lib/prisma";
import { assertCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Sweeps every row; the default function timeout is not enough.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authError = assertCronAuthorized(request);
  if (authError) return authError;

  try {
    const dryRun = request.nextUrl.searchParams.get("dry") === "1";
    const result = await runDataHeal(prisma, { dryRun });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/data-heal] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Vercel Cron invokes the scheduled path with a GET, so a POST-only route is
// answered with 405 and the job silently never runs. Both verbs share one
// handler; authorisation is header-based (Authorization: Bearer CRON_SECRET),
// so it is identical either way.
export const GET = POST;
