import { findRecentDuplicate } from "@/lib/dedup";
import { nextDocumentNumber } from "@/lib/commercial/document-workflow";
import { prisma } from "@/lib/prisma";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";

/**
 * Raises a delivery note against an invoice.
 *
 * Four places created delivery notes independently — the documents page, this
 * invoice route, the job actions, and the demo seed — and they disagreed about
 * when one was allowed. Two demanded the invoice be settled in full, the job
 * path asked for nothing, and the difference was invisible until someone tried
 * to deliver goods sold on credit and was told the document could not be
 * issued. One function, one rule.
 *
 * The rule: a delivery note records that goods changed hands. Payment is a
 * separate question with its own document. Selling on 30-day terms means
 * delivering before payment by definition, so settlement is not a precondition
 * — only a voided invoice has nothing to deliver against.
 */

export type DeliveryNoteResult =
  | { ok: true; deliveryNoteId: string; deliveryNoteNumber: string; duplicate: boolean }
  | { ok: false; error: string };

export async function createDeliveryNoteFromInvoice(params: {
  orgId: string;
  invoiceId: string;
  actorUserId: string;
  deliveredByName: string;
  receivedByName: string;
  deliveryMethod?: string | null;
  note?: string | null;
}): Promise<DeliveryNoteResult> {
  const { orgId, invoiceId, actorUserId } = params;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, orgId, status: { not: "VOID" } },
    select: {
      id: true,
      invoiceNumber: true,
      subject: true,
      lines: { select: { description: true, quantity: true } },
      job: { select: { jobNumber: true, brand: true, model: true } },
    },
  });
  if (!invoice) return { ok: false, error: "Invoice not found, or it has been voided." };

  // An invoice already has a note, or one landed seconds ago from a double
  // submit. Either way the caller wants the number, not a second document.
  const existing = await prisma.deliveryNote.findFirst({
    where: { orgId, invoiceId: invoice.id },
    select: { id: true, deliveryNoteNumber: true },
  });
  if (existing) {
    return { ok: true, deliveryNoteId: existing.id, deliveryNoteNumber: existing.deliveryNoteNumber, duplicate: true };
  }
  const recent = await findRecentDuplicate(prisma.deliveryNote, { orgId, invoiceId: invoice.id });
  if (recent) {
    return { ok: true, deliveryNoteId: recent.id, deliveryNoteNumber: recent.deliveryNoteNumber ?? "", duplicate: true };
  }

  const fallbackDescription = invoice.job
    ? `Repair handover for ${invoice.job.jobNumber} (${invoice.job.brand} ${invoice.job.model})`
    : invoice.subject ?? invoice.invoiceNumber;
  const items = invoice.lines.length > 0
    ? invoice.lines.map((line) => ({
        description: line.description,
        quantity: Math.max(1, Math.round(Number(line.quantity) || 1)),
      }))
    : [{ description: fallbackDescription, quantity: 1 }];

  const noteRecord = await prisma.$transaction(async (tx) => {
    const deliveryNoteNumber = await nextDocumentNumber(tx, "DN", "deliveryNote", orgId);
    return tx.deliveryNote.create({
      data: {
        orgId,
        invoiceId: invoice.id,
        deliveryNoteNumber,
        deliveryMethod: (params.deliveryMethod ?? null) as never,
        deliveredByName: params.deliveredByName,
        receivedByName: params.receivedByName,
        note: params.note?.trim() || null,
        createdById: actorUserId,
        items: { create: items },
      },
      select: { id: true, deliveryNoteNumber: true },
    });
  });

  await writeSystemAuditEvent({
    orgId,
    actorUserId,
    entityType: "DeliveryNote",
    entityId: noteRecord.id,
    action: "DELIVERY_NOTE_CREATED",
    summary: `${noteRecord.deliveryNoteNumber} generated from ${invoice.invoiceNumber}`,
  });

  return {
    ok: true,
    deliveryNoteId: noteRecord.id,
    deliveryNoteNumber: noteRecord.deliveryNoteNumber,
    duplicate: false,
  };
}
