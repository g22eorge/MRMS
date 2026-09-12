import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";

/**
 * Resolves a sale id to its human sale number for the page header.
 *
 * Mirrors /api/meta/job and /api/meta/client. Org-scoped, so a sale belonging
 * to another tenant answers 404 exactly as a non-existent one does — the header
 * then shows no reference rather than echoing the id back from the URL.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { orgId } = await requireOrgSession();

  const sale = await prisma.sale.findFirst({
    where: { id, orgId },
    select: { saleNumber: true },
  });

  if (!sale) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ saleNumber: sale.saleNumber });
}
