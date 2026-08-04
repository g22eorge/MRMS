import { NextRequest, NextResponse } from "next/server";

import { can } from "@/lib/permissions";
import { generateQuotationBuffer } from "@/lib/pdf/generate-quotation";
import { jobPdfErrorStatus, pdfAttachmentResponse, pdfGenerationErrorResponse } from "@/lib/pdf/pdf-response";
import { prisma } from "@/lib/prisma";
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

  if (
    !(
      ["ADMIN", "OPS", "TECHNICIAN_INTERNAL"].includes(user.role) ||
      can.viewFinancials(permissionUser) ||
      can.approveInvoices(permissionUser)
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isReadOnly = orgCtx.access.isSuspended || user.accessMode === "READ_ONLY";
  if (isReadOnly) {
    const existing = await prisma.job.findFirst({
      where: { id, orgId },
      select: { quotedAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!existing.quotedAt) {
      return NextResponse.json(
        { error: "Workspace is read-only. Generating new quotations is disabled until billing is restored." },
        { status: 402 },
      );
    }
  }

  const result = await generateQuotationBuffer(
    id,
    user.name,
    user.role,
    !isReadOnly,
    session.user.id,
    orgId,
  );

  if (!result.ok) {
    return pdfGenerationErrorResponse(result.error, jobPdfErrorStatus(result.error));
  }

  return pdfAttachmentResponse(result.buffer, result.filename, inline);
}
