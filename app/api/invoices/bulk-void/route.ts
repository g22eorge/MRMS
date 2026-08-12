import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { can } from "@/lib/permissions";
import { orgDb } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/sanitize";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";

export async function POST(req: NextRequest) {
  const { user } = await getCurrentUserRole();
  // Match the single-invoice void gate (was the broader approveInvoices, letting
  // e.g. FRONT_DESK void in bulk what they can't void individually).
  if (!(can.voidInvoices(user) || ["ADMIN", "OPS"].includes(user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const ids = JSON.parse(form.get("ids") as string) as string[];
  const reason = sanitizeText(form.get("reason") as string) || "Bulk void";
  const orgId = user.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });
  const db = orgDb(orgId);

  // Void each invoice through the same logic as single-void (restore Part-line
  // stock, audit) instead of a blanket updateMany that silently leaked stock.
  // Pre-fetch org-scoped so the raw tx updates below are tenant-safe, and so we
  // only touch — and audit — invoices that were actually not already void.
  // Exclude invoices with money collected: same gate as single-void, since
  // voiding would orphan received cash + its ledger entries against a cancelled
  // document. Those must be refunded first. Report how many were skipped.
  const candidates = await db.invoice.findMany({
    where: { id: { in: ids }, orgId, status: { not: "VOID" } },
    select: { id: true, invoiceNumber: true, paidAmount: true },
  });
  const targets = candidates.filter((c) => (c.paidAmount ?? 0) <= 0.005);
  const skippedPaid = candidates.length - targets.length;

  for (const target of targets) {
    await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({ where: { id: target.id }, data: { status: "VOID" } });
      const partLines = await tx.invoiceLine.findMany({
        where: { invoiceId: target.id, orgId, sourceType: "Part", sourceId: { not: null } },
        select: { sourceId: true, quantity: true, description: true },
      });
      for (const line of partLines) {
        if (!line.sourceId) continue;
        const qty = Math.round(line.quantity);
        if (qty <= 0) continue;
        const part = await tx.part.findFirst({ where: { id: line.sourceId, orgId }, select: { id: true } });
        if (!part) continue;
        await tx.part.update({ where: { id: part.id }, data: { qtyOnHand: { increment: qty } } });
        await tx.partStockTransaction.create({
          data: { partId: part.id, type: "IN", quantity: qty, reason: `Invoice ${inv.invoiceNumber} voided: ${line.description}`.slice(0, 500), createdById: user.id },
        });
      }
    });
    await writeSystemAuditEvent({
      orgId: orgId,
      action: "INVOICE_VOIDED",
      entityType: "Invoice",
      entityId: target.id,
      actorUserId: user.id,
      summary: `${reason}`,
    });
  }

  revalidatePath("/documents/invoices");
  const dest = new URL("/documents/invoices", req.url);
  if (skippedPaid > 0) dest.searchParams.set("voidSkipped", String(skippedPaid));
  return NextResponse.redirect(dest);
}
