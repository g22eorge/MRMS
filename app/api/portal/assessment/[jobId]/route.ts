import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/portal-auth";
import { generateAssessmentBuffer } from "@/lib/pdf/generate-assessment";
import { pdfAttachmentResponse, pdfGenerationErrorResponse } from "@/lib/pdf/pdf-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const { jobId } = await ctx.params;
  const session = await getPortalSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  // Isolation: the repair must belong to this customer + shop.
  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId: session.org.id, clientId: session.client.id },
    select: { id: true },
  });
  if (!job) return new Response("Not found", { status: 404 });

  const result = await generateAssessmentBuffer({ orgId: session.org.id, jobId, requireClientVisible: true });
  if (!result.ok) return pdfGenerationErrorResponse(result.error, 404);
  return pdfAttachmentResponse(result.buffer, result.filename, inline);
}
