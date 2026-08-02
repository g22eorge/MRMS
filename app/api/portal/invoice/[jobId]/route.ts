import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/portal-auth";
import { generateInvoiceBuffer } from "@/lib/pdf/generate-invoice";
import { pdfAttachmentResponse, pdfGenerationErrorResponse } from "@/lib/pdf/pdf-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const session = await getPortalSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  // Isolation: the repair must belong to this customer + shop, and have an invoice.
  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId: session.org.id, clientId: session.client.id },
    select: { id: true, invoice: { select: { id: true } } },
  });
  if (!job) return new Response("Not found", { status: 404 });
  if (!job.invoice) return pdfGenerationErrorResponse("No invoice has been issued for this repair yet.", 404);

  // Read-only: never persist an invoice record from the portal.
  const result = await generateInvoiceBuffer(jobId, session.org.name, "Portal", undefined, session.org.id);
  if (!result.ok) return pdfGenerationErrorResponse(result.error, 404);
  return pdfAttachmentResponse(result.buffer, result.filename);
}
