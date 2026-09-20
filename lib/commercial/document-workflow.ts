import type { Prisma } from "@prisma/client";

import { postSalePayment } from "@/lib/accounting/post";
import { getOrgNumberConfig, composeUniversalNumber } from "@/lib/commercial/org-number";
import { roundMoney, toBaseAmount } from "@/lib/currency";

type Tx = Prisma.TransactionClient;
type CountModel = "quotation" | "invoice" | "deliveryNote" | "receipt" | "creditNote" | "complaint";

/**
 * Allocate the next org-scoped, org-tagged document number in the universal
 * format TAG/TYPE/YYYY/MM/NNN (e.g. "EIS/INV/2026/09/001").
 *
 * Uses an atomic per-(orgId,type,year,month) counter (DocumentSequence) so
 * concurrent creation can't compute the same number, and the sequence resets
 * every month. The org tag (branding code) keeps the full number globally
 * unique, so the existing @unique columns keep working. Monthly counters
 * start at zero — new-format strings can never equal a legacy number, so no
 * history seeding is needed and old numbers stay grandfathered.
 */
export async function nextDocumentNumber(tx: Tx, type: string, countModel: CountModel, orgId: string, at = new Date()) {
  const year = at.getFullYear();
  const month = at.getMonth() + 1;
  // Pass `tx` so the branding read runs on the transaction's own connection.
  // Using the global client here deadlocks the interactive tx on Turso/libSQL
  // (see getOrgNumberConfig) — the bug that silently hung repair/POS payments
  // for fresh orgs and cold serverless instances.
  const { prefix, pad } = await getOrgNumberConfig(orgId, tx);

  for (let attempt = 0; attempt < 25; attempt += 1) {
    let candidate: string;
    try {
      const seq = await tx.documentSequence.upsert({
        where: { orgId_type_year_month: { orgId, type, year, month } },
        create: { orgId, type, year, month, value: 1 },
        update: { value: { increment: 1 } },
        select: { value: true },
      });
      candidate = composeUniversalNumber(prefix, type, at, seq.value, pad);
    } catch (error) {
      // Lost a concurrent upsert race on a fresh month row — the winner's
      // row exists now, so retrying lands on the update path.
      if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002" && attempt < 24) continue;
      throw error;
    }
    if (!(await documentNumberTaken(tx, countModel, candidate))) return candidate;
  }
  throw new Error(`Could not allocate a unique ${type} number for this organisation.`);
}

/** Is this composed number already used by ANY org? (the columns are global @unique) */
async function documentNumberTaken(tx: Tx, countModel: CountModel, value: string): Promise<boolean> {
  switch (countModel) {
    case "quotation":
      // Job quotations print a number without creating a Quotation row, so the
      // job column has to be checked too — Job.quotationNumber is unique, and a
      // candidate that collides with one would fail the write with P2002.
      return Boolean(
        (await tx.quotation.findFirst({ where: { quoteNumber: value }, select: { id: true } })) ??
        (await tx.job.findFirst({ where: { quotationNumber: value }, select: { id: true } })),
      );
    case "invoice":
      return Boolean(await tx.invoice.findFirst({ where: { invoiceNumber: value }, select: { id: true } }));
    case "deliveryNote":
      return Boolean(await tx.deliveryNote.findFirst({ where: { deliveryNoteNumber: value }, select: { id: true } }));
    case "creditNote":
      return Boolean(await tx.creditNote.findFirst({ where: { creditNoteNumber: value }, select: { id: true } }));
    case "complaint":
      return Boolean(await tx.complaint.findFirst({ where: { complaintNumber: value }, select: { id: true } }));
    default:
      return Boolean(await tx.receipt.findFirst({ where: { receiptNumber: value }, select: { id: true } }));
  }
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
  const quoteNumber = await nextDocumentNumber(tx, "EST", "quotation", params.orgId);
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

  // Only client-facing quotes convert: drafts, rejections and expired offers
  // must not become invoices behind the UI's back.
  if (!["SENT", "ACCEPTED"].includes(quotation.status)) return null;

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

  // Snapshot the cost of any stocked product on the quotation, exactly as the
  // direct-invoice path does. These lines were written as sourceType
  // "QuotationItem" with no costAtSale, and the COGS query only looks at
  // sourceType "Part" — so every quotation-converted sale reported zero cost
  // and therefore a 100% gross margin, with not even the live-cost fallback
  // applying. Repair invoices all come through here.
  const quotedPartIds = [...new Set(quotation.items.map((i) => i.partId).filter((id): id is string => Boolean(id)))];
  const quotedParts = quotedPartIds.length
    ? await tx.part.findMany({
        where: { id: { in: quotedPartIds }, orgId: params.orgId },
        select: { id: true, unitCost: true, saleUomFactor: true },
      })
    : [];
  const quotedPartById = new Map(quotedParts.map((p) => [p.id, p]));
  const invoice = await tx.invoice.create({
    data: {
      orgId: params.orgId,
      jobId: quotation.jobId,
      clientId: quotation.clientId,
      invoiceType: quotation.jobId ? "REPAIR" : "SERVICE",
      subject: quotation.job ? `Repair invoice for ${quotation.job.jobNumber}` : `Invoice from quotation ${quotation.quoteNumber}`,
      invoiceNumber,
      currency: quotation.currency || params.currency,
      // The quote's rate, not today's. An invoice raised from a quote agreed at
      // 3,750 is worth what was agreed; re-reading a live rate here would make
      // the same work worth a different number of shillings depending on when
      // the conversion happened to be clicked.
      exchangeRateToBase: quotation.exchangeRateToBase,
      status: "ISSUED",
      totalAmount,
      notes: `Converted from quotation ${quotation.quoteNumber}`,
      lines: {
        create: quotation.items.length > 0
          ? quotation.items.map((item) => {
              const lineCurrency = quotation.currency || params.currency;
              const taxAmount = roundMoney(
                quotation.vatAmount > 0 && taxableSubtotal > 0
                  ? quotation.vatAmount * (item.lineTotal / taxableSubtotal)
                  : 0,
                lineCurrency,
              );
              const part = item.partId ? quotedPartById.get(item.partId) : undefined;
              return {
                orgId: params.orgId,
                // Part-linked lines are tagged "Part" so cost reporting sees
                // them; free-text lines keep pointing back at the quote item.
                sourceType: part ? "Part" : "QuotationItem",
                sourceId: part ? item.partId : item.id,
                costAtSale: part?.unitCost ?? null,
                saleUomFactor: part?.saleUomFactor ?? null,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                // QuotationItem.discount is a percentage; InvoiceLine.discountAmount
                // is an absolute currency value — convert instead of copying raw.
                discountAmount: roundMoney(item.quantity * item.unitPrice * ((item.discount ?? 0) / 100), lineCurrency),
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

export async function createReceiptForPayment(tx: Tx, params: { orgId: string; paymentId: string; invoiceId?: string | null; saleId?: string | null; clientId?: string | null; amount: number; currency: string; issuedById?: string | null; method?: string | null }) {
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
    // The ledger posts in org base currency, but params.amount is in the
    // document's currency — convert so a foreign payment posts its true base
    // value (a 100 USD payment must post ~380,000 UGX, not 100). No-op in base.
    let baseAmount = params.amount;
    const org = await tx.organization.findUnique({ where: { id: params.orgId }, select: { baseCurrency: true } });
    const baseCurrency = org?.baseCurrency ?? params.currency;
    let method = params.method ?? null;
    if (params.currency !== baseCurrency) {
      const pay = await tx.payment.findUnique({ where: { id: params.paymentId }, select: { exchangeRateToBase: true, method: true } });
      baseAmount = toBaseAmount({ amount: params.amount, currency: params.currency, baseCurrency, exchangeRateToBase: pay?.exchangeRateToBase ?? null });
      method ??= pay?.method ?? null;
    } else if (!method) {
      const pay = await tx.payment.findUnique({ where: { id: params.paymentId }, select: { method: true } });
      method = pay?.method ?? null;
    }
    await postSalePayment(tx, {
      orgId: params.orgId,
      userId: params.issuedById,
      amount: baseAmount,
      method,
      reference: `pay:${params.paymentId}`,
      description: `Payment received (receipt ${receipt.receiptNumber})`,
    });
  }

  return receipt;
}
