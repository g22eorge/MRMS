import { NextRequest } from "next/server";

import { getPortalSession } from "@/lib/portal-auth";
import { generateStatementBuffer } from "@/lib/pdf/generate-statement";
import { pdfAttachmentResponse, pdfGenerationErrorResponse } from "@/lib/pdf/pdf-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Statement of account for the signed-in portal customer.
 *
 * Isolation: the client and org come from the portal session only — never from
 * the query string — so a customer can only ever pull their own statement.
 * Read-only: nothing is persisted, so a customer downloading a statement
 * creates no document and no numbering.
 */
export async function GET(req: NextRequest) {
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const session = await getPortalSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const result = await generateStatementBuffer(session.org.id, session.client.id, session.org.baseCurrency);
  if (!result.ok) return pdfGenerationErrorResponse(result.error, 404);
  return pdfAttachmentResponse(result.buffer, result.filename, inline);
}
