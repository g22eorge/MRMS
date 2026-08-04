import { NextRequest, NextResponse } from "next/server";

import { can } from "@/lib/permissions";
import { generateInvoiceBuffer } from "@/lib/pdf/generate-invoice";
import { jobPdfErrorStatus, pdfAttachmentResponse, pdfGenerationErrorResponse } from "@/lib/pdf/pdf-response";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const { id } = await context.params;
  const { session, user, orgId, org: orgCtx } = await requireOrgSession();

  if (!(["ADMIN", "OPS"].includes(user.role) || can.approveInvoices(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isReadOnly = orgCtx.access.isSuspended || user.accessMode === "READ_ONLY";
  if (isReadOnly) {
    const existing = await prisma.job.findFirst({
      where: { id, orgId },
      select: { invoiceNumber: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!existing.invoiceNumber) {
      return NextResponse.json(
        { error: "Workspace is read-only. Generating new invoices is disabled until billing is restored." },
        { status: 402 },
      );
    }
  } else {
    try {
      assertOrgCanMutate({
        access: orgCtx.access,
        userRole: user.role,
        userAccessMode: user.accessMode,
        kind: "GENERAL",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workspace is read-only.";
      return NextResponse.json({ error: message }, { status: 403 });
    }
  }

  const result = await generateInvoiceBuffer(
    id,
    user.name,
    user.role,
    session.user.id,
    orgId,
    isReadOnly
      ? { skipPersist: true }
      : { persistInvoiceRecord: true },
  );

  if (!result.ok) {
    return pdfGenerationErrorResponse(result.error, jobPdfErrorStatus(result.error));
  }

  return pdfAttachmentResponse(result.buffer, result.filename, inline);
}
