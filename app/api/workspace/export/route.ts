import { NextResponse } from "next/server";

import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { eatDateKey } from "@/lib/date-eat";
import { requireOrgSession } from "@/lib/org-context";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { exportWorkspace } from "@/lib/workspace/export";

export const dynamic = "force-dynamic";

/** A business downloads its own data. Administrators only, and only their own organisation. */
export async function GET() {
  const { user, orgId, org } = await requireOrgSession();
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Only an administrator can export." }, { status: 403 });

  // A full read of every table: a handful a day is plenty.
  const rl = await checkRateLimit(`workspace-export:${orgId}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many exports. Try again later." }, { status: 429, headers: rateLimitHeaders(rl.retryAfterMs) });
  }

  const data = await exportWorkspace(orgId);
  await writeSystemAuditEvent({
    orgId,
    actorUserId: user.id,
    entityType: "Organization",
    entityId: orgId,
    action: "WORKSPACE_EXPORTED",
    summary: `Workspace data exported (${Object.keys(data.tables).length} tables)`,
  });

  const slug = (org.name ?? "workspace").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}-export-${eatDateKey()}.json"`,
      "cache-control": "no-store",
    },
  });
}
