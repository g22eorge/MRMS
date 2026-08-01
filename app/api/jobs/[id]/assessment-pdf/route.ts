import { NextRequest } from "next/server";

import { getOrgSessionOptional } from "@/lib/org-context";
import { generateAssessmentBuffer } from "@/lib/pdf/generate-assessment";
import { pdfAttachmentResponse, pdfGenerationErrorResponse } from "@/lib/pdf/pdf-response";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getOrgSessionOptional();
  if (!session?.orgId) return new Response("Unauthorized", { status: 401 });

  const result = await generateAssessmentBuffer({ orgId: session.orgId, jobId: id });
  if (!result.ok) return pdfGenerationErrorResponse(result.error, 404);
  return pdfAttachmentResponse(result.buffer, result.filename);
}
