import { NextRequest, NextResponse } from "next/server";

import { getAuditRetentionDays, pruneSystemAuditEvents } from "@/lib/commercial/audit-retention";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { pruneErrorEvents } from "@/lib/error-events";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authError = assertCronAuthorized(request);
  if (authError) return authError;

  try {
    const days = await getAuditRetentionDays();
    const result = await pruneSystemAuditEvents(days);
    // The error log is diagnostic, not a record: a month is plenty.
    const errorsPruned = await pruneErrorEvents(30);
    await writeSystemAuditEvent({
      entityType: "SystemAuditEvent",
      entityId: "retention-cron",
      action: "CRON_AUDIT_EVENTS_PRUNED",
      summary: "Scheduled audit retention prune completed",
      after: { deleted: result.deleted, cutoff: result.cutoff.toISOString(), days: result.days },
    });

    return NextResponse.json({ ok: true, ...result, errorsPruned, cutoff: result.cutoff.toISOString() });
  } catch (err) {
    console.error("[cron/audit-prune] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Vercel Cron invokes the scheduled path with a GET, so a POST-only route is
// answered with 405 and the job silently never runs. Both verbs share one
// handler; authorisation is header-based (Authorization: Bearer CRON_SECRET),
// so it is identical either way.
export const GET = POST;
