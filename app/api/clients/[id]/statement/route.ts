import { NextRequest, NextResponse } from "next/server";

import { can } from "@/lib/permissions";
import { generateStatementBuffer } from "@/lib/pdf/generate-statement";
import { pdfAttachmentResponse, pdfGenerationErrorResponse } from "@/lib/pdf/pdf-response";
import { requireOrgSession } from "@/lib/org-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Statement of account for one client, for staff — the same document the
 * customer can pull from the portal, so both sides quote identical figures.
 *
 * Read-only by design: it renders from existing invoices and sales and persists
 * nothing, so no suspension guard is needed — a suspended workspace can still
 * chase what it is owed.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const { id } = await context.params;
  const { user, orgId, org } = await requireOrgSession();

  // Statements are financial data: same gate as the client page's statement panel.
  if (!can.viewFinancials(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // generateStatementBuffer scopes the client lookup by orgId, so a client id
  // from another tenant resolves to "not found" rather than leaking a statement.
  const result = await generateStatementBuffer(orgId, id, org.baseCurrency);
  if (!result.ok) return pdfGenerationErrorResponse(result.error, 404);
  return pdfAttachmentResponse(result.buffer, result.filename, inline);
}
