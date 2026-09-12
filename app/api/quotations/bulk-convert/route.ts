import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { ensureInvoiceFromQuotation } from "@/lib/commercial/document-workflow";
import { normalizeCurrency } from "@/lib/currency";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

/**
 * Bulk convert selected quotations to invoices.
 *
 * The third of the three routes the quotations bulk bar has always called and
 * none of which existed. It reuses ensureInvoiceFromQuotation, which is what
 * the single "Convert to invoice" button on a quotation calls, so a quotation
 * converted from the list and one converted from its own page produce the same
 * invoice — including the guard that returns the existing invoice rather than
 * raising a second one.
 */
export async function POST(req: NextRequest) {
  const { user } = await getCurrentUserRole();
  if (!can.createInvoices(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId = user.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  let ids: string[] = [];
  try {
    const parsed = JSON.parse(String((await req.formData()).get("ids") ?? "[]"));
    if (Array.isArray(parsed)) ids = parsed.map(String).filter(Boolean);
  } catch {
    return NextResponse.json({ error: "Malformed selection" }, { status: 400 });
  }
  if (ids.length === 0) return NextResponse.json({ error: "Nothing selected" }, { status: 400 });

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { baseCurrency: true } });
  const currency = normalizeCurrency(org?.baseCurrency, "UGX");

  let converted = 0;
  const failed: string[] = [];
  for (const quotationId of ids) {
    try {
      const invoice = await prisma.$transaction((tx) =>
        ensureInvoiceFromQuotation(tx, { orgId, quotationId, currency }),
      );
      if (invoice) converted += 1;
      else failed.push(quotationId);
    } catch {
      // A quotation that cannot convert — already invoiced, no lines, wrong
      // status — must not stop the others in the selection.
      failed.push(quotationId);
    }
  }

  revalidatePath("/documents/quotations");
  revalidatePath("/documents/invoices");
  return NextResponse.json({ ok: failed.length === 0, converted, failed: failed.length, total: ids.length });
}
