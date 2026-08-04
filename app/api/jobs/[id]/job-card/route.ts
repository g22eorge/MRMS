import { NextRequest, NextResponse } from "next/server";

import { can } from "@/lib/permissions";
import { generateJobCardBuffer } from "@/lib/pdf/generate-job-card";
import { jobPdfErrorStatus, pdfAttachmentResponse, pdfGenerationErrorResponse } from "@/lib/pdf/pdf-response";
import { requireOrgSession } from "@/lib/org-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const { id } = await context.params;
  const { session, user, orgId, org: orgCtx } = await requireOrgSession();
  const permissionUser = { role: user.role, permissions: user.permissions };

  if (!can.generateJobCards(permissionUser)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const logAudit = !orgCtx.access.isSuspended && user.accessMode !== "READ_ONLY";
  const result = await generateJobCardBuffer(
    id,
    user.name,
    user.role,
    logAudit ? session.user.id : undefined,
    orgId,
    { logAudit },
  );

  if (!result.ok) {
    return pdfGenerationErrorResponse(result.error, jobPdfErrorStatus(result.error));
  }

  return pdfAttachmentResponse(result.buffer, result.filename, inline);
}
