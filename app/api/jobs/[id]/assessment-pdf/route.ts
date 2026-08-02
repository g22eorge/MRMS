import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { generateAssessmentBuffer } from "@/lib/pdf/generate-assessment";
import { pdfAttachmentResponse, pdfGenerationErrorResponse } from "@/lib/pdf/pdf-response";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { user, orgId } = await requireOrgSession();

  // The assessment PDF carries client pricing — never for external technicians,
  // and internal technicians only for jobs assigned to them.
  if (user.role === "TECHNICIAN_EXTERNAL") return new Response("Forbidden", { status: 403 });
  if (user.role === "TECHNICIAN_INTERNAL") {
    const owns = await prisma.job.findFirst({ where: { id, orgId, assignedToId: user.id }, select: { id: true } });
    if (!owns) return new Response("Forbidden", { status: 403 });
  }

  const result = await generateAssessmentBuffer({ orgId, jobId: id });
  if (!result.ok) return pdfGenerationErrorResponse(result.error, 404);
  return pdfAttachmentResponse(result.buffer, result.filename);
}
