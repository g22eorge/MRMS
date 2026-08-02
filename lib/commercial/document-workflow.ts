import type { Prisma } from "@prisma/client";

import { postSalePayment } from "@/lib/accounting/post";
import { orgTagFor, composeOrgNumber, maxNumberSequence } from "@/lib/commercial/org-number";

type Tx = Prisma.TransactionClient;
type CountModel = "quotation" | "invoice" | "deliveryNote" | "receipt" | "creditNote";

/** Highest existing sequence for `inner` (e.g. "INV-2026-") within one org,
 * tolerating both tagged (EGL-INV-2026-0007) and legacy untagged numbers so the
 * sequence continues smoothly through the org-tag transition. */
async function currentMaxDocumentSequence(tx: Tx, countModel: CountModel, inner: string, orgId: string) {
  const numbers: string[] = countModel === "quotation"
    ? (await tx.quotation.findMany({ where: { orgId, quoteNumber: { contains: inner } }, select: { quoteNumber: true } })).map((r) => r.quoteNumber)
    : countModel === "invoice"
      ? (await tx.invoice.findMany({ where: { orgId, invoiceNumber: { contains: inner } }, select: { invoiceNumber: true } })).map((r) => r.invoiceNumber)
      : countModel === "deliveryNote"
        ? (await tx.deliveryNote.findMany({ where: { orgId, deliveryNoteNumber: { contains: inner } }, select: { deliveryNoteNumber: true } })).map((r) => r.deliveryNoteNumber)
        : countModel === "creditNote"
          ? (await tx.creditNote.findMany({ where: { orgId, creditNoteNumber: { contains: inner } }, select: { creditNoteNumber: true } })).map((r) => r.creditNoteNumber)
          : (await tx.receipt.findMany({ where: { orgId, receiptNumber: { contains: inner } }, select: { receiptNumber: true } })).map((r) => r.receiptNumber);
  return maxNumberSequence(inner, numbers.filter(Boolean));
}

/**
 * Allocate the next org-scoped, org-tagged document number (INV/QT/RCT/CN/DN),
 * e.g. "EGL-INV-2026-0044" — consistent with the rest of the system's numbering.
 *
 * Uses an atomic per-(orgId,type,year) counter (DocumentSequence) so concurrent
 * creation can't compute the same number. The org tag (uppercased slug) keeps
 * the full number globally unique, so the existing @unique columns keep working.
 * The counter seeds from the org's current max (tagged or legacy) so sequences
 * continue rather than restarting.
 */
export async function nextDocumentNumber(tx: Tx, prefix: string, countModel: CountModel, orgId: string) {
  const year = new Date().getFullYear();
  const inner = `${prefix}-${year}-`;
  const tag = await orgTagFor(orgId);

  const existing = await tx.documentSequence.findUnique({ where: { orgId_type_year: { orgId, type: prefix, year } } });
  if (!existing) {
    const seed = await currentMaxDocumentSequence(tx, countModel, inner, orgId);
    try {
      await tx.documentSequence.create({ data: { orgId, type: prefix, year, value: seed } });
    } catch (err) {
      // A concurrent call seeded it first — fine, we'll increment below.
      if (!(err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002")) throw err;
    }
  }

  const updated = await tx.documentSequence.update({
    where: { orgId_type_year: { orgId, type: prefix, year } },
    data: { value: { increment: 1 } },
    select: { value: true },
  });
  return composeOrgNumber(tag, inner, updated.value);
}

export async function nextAvailableInvoiceNumber(tx: Tx, orgId: string, preferred?: string | null, excludeInvoiceId?: string | null) {
  const preferredNumber = preferred?.trim();
  if (preferredNumber) {
    const existing = await tx.invoice.findUnique({
      where: { invoiceNumber: preferredNumber },
      select: { id: true },
    });
    if (!existing || existing.id === excludeInvoiceId) {
      return preferredNumber;
    }
  }

  for (let attempts = 0; attempts < 20; attempts += 1) {
    const candidate = await nextDocumentNumber(tx, "INV", "invoice", orgId);
    const existing = await tx.invoice.findUnique({
      where: { invoiceNumber: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeInvoiceId) {
      return candidate;
    }
  }

  throw new Error("Could not allocate a unique invoice number.");
}

function repairDescription(job: {
  jobNumber: string;
  brand: string;
  model: string;
  issueDescription: string;
  diagnosisNotes: string | null;
  recommendedRepair: string | null;
  partsNeeded: string | null;
}) {
  const details = [job.recommendedRepair, job.partsNeeded, job.diagnosisNotes, job.issueDescription]
    .filter(Boolean)
    .join(" | ");
  return `Repair for ${job.jobNumber} - ${job.brand} ${job.model}${details ? `: ${details}` : ""}`;
}

export async function ensureQuotationFromJob(tx: Tx, params: { orgId: string; jobId: string; userId: string; currency: string }) {
  const existing = await tx.quotation.findFirst({
    where: { orgId: params.orgId, jobId: params.jobId },
    include: { items: true },
  });
  if (existing) return existing;

  const job = await tx.job.findFirst({
    where: { id: params.jobId, orgId: params.orgId },
    select: {
      id: true,
      jobNumber: true,
      clientId: true,
      brand: true,
      model: true,
      issueDescription: true,
      diagnosisNotes: true,
      recommendedRepair: true,
      partsNeeded: true,
      clientBill: true,
    },
  });
  if (!job) return null;

  const totalAmount = job.clientBill ?? 0;
  const quoteNumber = await nextDocumentNumber(tx, "QT", "quotation", params.orgId);
  return tx.quotation.create({
    data: {
      orgId: params.orgId,
      quoteNumber,
      status: "DRAFT",
      currency: params.currency,
      clientId: job.clientId,
      jobId: job.id,
      subtotal: totalAmount,
      totalAmount,
      notes: `Converted from job card ${job.jobNumber}`,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdById: params.userId,
      items: {
        create: [{
          description: repairDescription(job),
          quantity: 1,
          unitPrice: totalAmount,
          lineTotal: totalAmount,
        }],
      },
    },
    include: { items: true },
  });
}

export async function ensureInvoiceFromQuotation(tx: Tx, params: { orgId: string; quotationId: string; currency: string }) {
  const quotation = await tx.quotation.findFirst({
    where: { id: params.quotationId, orgId: params.orgId },
    include: { items: true, job: { select: { id: true, jobNumber: true } } },
  });
  if (!quotation) return null;

  if (quotation.convertedToInvoiceId) {
    const existing = await tx.invoice.findFirst({ where: { id: quotation.convertedToInvoiceId, orgId: params.orgId } });
    if (existing) return existing;
  }

  if (quotation.jobId) {
    const existing = await tx.invoice.findFirst({ where: { jobId: quotation.jobId, orgId: params.orgId } });
    if (existing) {
      await tx.quotation.update({ where: { id: quotation.id }, data: { convertedToInvoiceId: existing.id } });
      return existing;
    }
  }

  const invoiceNumber = await nextAvailableInvoiceNumber(tx, params.orgId);
  const totalAmount = quotation.totalAmount;
  const taxableSubtotal = quotation.subtotal > 0 ? quotation.subtotal : totalAmount;
  const invoice = await tx.invoice.create({
    data: {
      orgId: params.orgId,
      jobId: quotation.jobId,
      clientId: quotation.clientId,
      invoiceType: quotation.jobId ? "REPAIR" : "SERVICE",
      subject: quotation.job ? `Repair invoice for ${quotation.job.jobNumber}` : `Invoice from quotation ${quotation.quoteNumber}`,
      invoiceNumber,
      currency: quotation.currency || params.currency,
      status: "ISSUED",
      totalAmount,
      notes: `Converted from quotation ${quotation.quoteNumber}`,
      lines: {
        create: quotation.items.length > 0
          ? quotation.items.map((item) => {
              const taxAmount = quotation.vatAmount > 0 && taxableSubtotal > 0
                ? quotation.vatAmount * (item.lineTotal / taxableSubtotal)
                : 0;
              return {
                orgId: params.orgId,
                sourceType: "QuotationItem",
                sourceId: item.id,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                // QuotationItem.discount is a percentage; InvoiceLine.discountAmount
                // is an absolute currency value — convert instead of copying raw.
                discountAmount: item.quantity * item.unitPrice * ((item.discount ?? 0) / 100),
                taxAmount,
                lineTotal: item.lineTotal,
              };
            })
          : [{
              orgId: params.orgId,
              sourceType: "Quotation",
              sourceId: quotation.id,
              description: `Quotation ${quotation.quoteNumber}`,
              quantity: 1,
              unitPrice: totalAmount,
              taxAmount: quotation.vatAmount,
              lineTotal: totalAmount,
            }],
      },
    },
  });

  await tx.quotation.update({ where: { id: quotation.id }, data: { convertedToInvoiceId: invoice.id } });
  if (quotation.jobId) {
    await tx.job.updateMany({
      where: { id: quotation.jobId, orgId: params.orgId },
      data: { invoiceNumber, invoiceIssuedAt: new Date() },
    });
  }
  return invoice;
}

export async function createReceiptForPayment(tx: Tx, params: { orgId: string; paymentId: string; invoiceId?: string | null; saleId?: string | null; clientId?: string | null; amount: number; currency: string; issuedById?: string | null }) {
  const receipt = await (async () => {
    const existing = await tx.receipt.findFirst({ where: { orgId: params.orgId, paymentId: params.paymentId } });
    if (existing) return existing;
    const receiptNumber = await nextDocumentNumber(tx, "RCT", "receipt", params.orgId);
    try {
      return await tx.receipt.create({
        data: {
          orgId: params.orgId,
          receiptNumber,
          paymentId: params.paymentId,
          invoiceId: params.invoiceId ?? null,
          saleId: params.saleId ?? null,
          clientId: params.clientId ?? null,
          amount: params.amount,
          currency: params.currency,
          issuedById: params.issuedById ?? null,
        },
      });
    } catch (err) {
      // @@unique([orgId, paymentId]) — a concurrent create won the race; return it
      // instead of surfacing a 500.
      if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
        const winner = await tx.receipt.findFirst({ where: { orgId: params.orgId, paymentId: params.paymentId } });
        if (winner) return winner;
      }
      throw err;
    }
  })();

  // C5: cash-basis ledger post for the customer payment. Idempotent on the
  // payment id, so it fires exactly once even across the six payment paths
  // that funnel through here. issuedById is the required journal author.
  if (params.issuedById) {
    await postSalePayment(tx, {
      orgId: params.orgId,
      userId: params.issuedById,
      amount: params.amount,
      reference: `pay:${params.paymentId}`,
      description: `Payment received (receipt ${receipt.receiptNumber})`,
    });
  }

  return receipt;
}
