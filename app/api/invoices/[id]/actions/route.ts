import { NextRequest, NextResponse } from "next/server";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendInvoiceViaWhatsAppAction } from "@/app/(app)/jobs/[id]/actions";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { nextDocumentNumber } from "@/lib/commercial/document-workflow";
import { syncInvoicePaymentState } from "@/lib/commercial/payment-sync";
import type { DeliveryMethod } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, orgId } = await requireOrgSession();
  const db = prisma as any;
  const { id } = await ctx.params;

  const invoice = await prisma.invoice.findFirst({ where: { id, orgId }, select: { id: true, orgId: true, invoiceNumber: true, status: true, jobId: true, totalAmount: true, clientId: true } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await _req.json().catch(() => ({}));
  const action = String(body.action ?? "").trim();

  if (action === "update") {
    if (!(can.approveInvoices(user) || ["ADMIN", "OPS"].includes(user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const data: Record<string, unknown> = {};
    if (body.subject !== undefined) data.subject = body.subject ? String(body.subject).trim() : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(String(body.dueDate)) : null;
    // Do NOT accept an arbitrary `status` here — VOID/PAID have dedicated flows
    // (stock restoration, ledger posting, payment-sync). Whitelist invoiceType.
    if (body.invoiceType && ["REPAIR", "SERVICE", "MERCHANDISE", "CONTRACT", "OTHER"].includes(String(body.invoiceType))) {
      data.invoiceType = String(body.invoiceType);
    }

    const updated = await prisma.invoice.update({ where: { id: invoice.id }, data });
    await writeSystemAuditEvent({ orgId: invoice.orgId, actorUserId: user.id, entityType: "Invoice", entityId: invoice.id, action: "INVOICE_UPDATED", summary: `${updated.invoiceNumber} updated` });
    revalidatePath("/documents/invoices");
    revalidatePath(`/documents/invoices/${invoice.id}`);
    return NextResponse.json(updated);
  }

  if (action === "deliveryNote") {
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS"].includes(user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const deliveredByName = String(body.deliveredByName ?? "").trim();
    const receivedByName = String(body.receivedByName ?? "").trim();
    const note = String(body.note ?? "").trim();
    const methodRaw = String(body.deliveryMethod ?? "PICKUP").trim();
    const deliveryMethod = (["PICKUP", "DELIVERY", "COURIER"].includes(methodRaw) ? methodRaw : "PICKUP") as DeliveryMethod;
    if (!deliveredByName || !receivedByName) return NextResponse.json({ error: "missing-fields" }, { status: 400 });

    const inv = await prisma.invoice.findFirst({ where: { id: invoice.id, orgId }, select: { paidAmount: true, totalAmount: true, jobId: true, subject: true } });
    if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (inv.paidAmount < inv.totalAmount) return NextResponse.json({ error: "invoice-not-fully-paid" }, { status: 400 });

    // Dedup: one delivery note per invoice (there is no @unique on invoiceId).
    const existingDn = await prisma.deliveryNote.findFirst({ where: { orgId, invoiceId: invoice.id }, select: { deliveryNoteNumber: true } });
    if (existingDn) {
      return NextResponse.json({ ok: true, deliveryNoteNumber: existingDn.deliveryNoteNumber, duplicate: true });
    }

    const desc = inv.jobId
      ? `Repair handover for job`
      : (inv.subject ?? invoice.invoiceNumber);

    // Allocate the number and create the note in one transaction (was split
    // across two calls, so the number could collide or the create fail alone).
    const deliveryNoteNumber = await prisma.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, "DN", "deliveryNote", orgId);
      await tx.deliveryNote.create({
        data: {
          orgId,
          invoiceId: invoice.id,
          deliveryNoteNumber: number,
          deliveryMethod,
          deliveredByName,
          receivedByName,
          note: note || null,
          items: { create: [{ description: desc, quantity: 1 }] },
        },
      });
      return number;
    });

    await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "DeliveryNote", entityId: invoice.id, action: "DELIVERY_NOTE_CREATED", summary: `DN ${deliveryNoteNumber} for ${invoice.id}` });
    revalidatePath("/documents/invoices");
    revalidatePath(`/documents/invoices/${invoice.id}`);
    return NextResponse.json({ ok: true, deliveryNoteNumber });
  }

  if (action === "whatsapp") {
    if (!invoice.jobId) return NextResponse.json({ error: "Standalone invoices must be sent from the job page." }, { status: 400 });
    await sendInvoiceViaWhatsAppAction(invoice.jobId);
    revalidatePath("/documents/invoices");
    revalidatePath(`/documents/invoices/${invoice.id}`);
    return NextResponse.json({ ok: true });
  }

  if (action === "void") {
    if (!(can.voidInvoices(user) || ["ADMIN", "OPS"].includes(user.role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const alreadyVoid = invoice.status === "VOID";
    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({ where: { id: invoice.id }, data: { status: "VOID" } });
      // Restore stock for product lines decremented at issue (sourceType "Part").
      // Repair invoices (QuotationItem lines) were consumed at job completion, not
      // here, so they aren't restored. Guarded on status so voiding is idempotent.
      if (!alreadyVoid) {
        const partLines = await tx.invoiceLine.findMany({
          where: { invoiceId: invoice.id, orgId, sourceType: "Part", sourceId: { not: null } },
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
      }
      return inv;
    });
    await writeSystemAuditEvent({ orgId: invoice.orgId, actorUserId: user.id, entityType: "Invoice", entityId: invoice.id, action: "INVOICE_VOIDED", summary: `${updated.invoiceNumber} voided` });
    revalidatePath("/documents/invoices");
    revalidatePath(`/documents/invoices/${invoice.id}`);
    return NextResponse.json({ updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
