import { Prisma } from "@prisma/client";

import { toBaseAmount } from "@/lib/currency";

type Tx = Prisma.TransactionClient;

export type InvoicePaymentSyncResult = {
  paidAmount: number;
  isPaid: boolean;
  totalAmount: number;
  jobId: string | null;
};

export type SalePaymentSyncResult = {
  paidAmount: number;
  isPaid: boolean;
  totalAmount: number;
};

/**
 * Convert a document total (held in its own currency) to org base currency, so
 * it can be compared like-for-like against the base-currency paid total. Uses
 * the FX rate from a payment on the document (foreign payments are required to
 * carry one). No-op when the document is already in base currency, or when no
 * rate is available yet (in which case paid is 0 anyway).
 */
async function toDocumentBase(
  tx: Tx,
  params: {
    orgId: string;
    amount: number;
    docCurrency: string | null | undefined;
    baseCurrency: string;
    rateFrom: { invoiceId?: string; saleId?: string };
  },
): Promise<number> {
  const cur = params.docCurrency ?? params.baseCurrency;
  if (cur === params.baseCurrency) return params.amount;
  const fx = await tx.payment.findFirst({
    where: {
      orgId: params.orgId,
      currency: cur,
      exchangeRateToBase: { not: null },
      ...(params.rateFrom.invoiceId ? { invoiceId: params.rateFrom.invoiceId } : {}),
      ...(params.rateFrom.saleId ? { saleId: params.rateFrom.saleId } : {}),
    },
    select: { exchangeRateToBase: true },
    orderBy: { receivedAt: "desc" },
  });
  const rate = fx?.exchangeRateToBase;
  return rate && rate > 0 ? params.amount * rate : params.amount;
}

/** Sum invoice-linked payments in org base currency; REFUND rows net off when enabled. */
export async function sumInvoicePaidAmount(
  tx: Tx,
  params: {
    orgId: string;
    invoiceId: string;
    baseCurrency: string;
    netRefunds?: boolean;
  },
): Promise<number> {
  const netRefunds = params.netRefunds !== false;
  const [payments, refunds] = await Promise.all([
    tx.payment.findMany({
      where: { orgId: params.orgId, invoiceId: params.invoiceId },
      select: { amount: true, currency: true, exchangeRateToBase: true, kind: true },
    }),
    // Standalone Refund rows (Documents → Refunds path) net off the invoice too.
    // The job-detail path instead records REFUND-kind Payment rows, and no single
    // refund produces both, so there is no double-counting.
    netRefunds
      ? tx.refund.findMany({
          where: { orgId: params.orgId, invoiceId: params.invoiceId },
          select: { amount: true, currency: true, exchangeRateToBase: true },
        })
      : Promise.resolve([]),
  ]);

  const paymentsTotal = payments.reduce((sum, payment) => {
    const base = toBaseAmount({
      amount: payment.amount,
      currency: payment.currency,
      baseCurrency: params.baseCurrency,
      exchangeRateToBase: payment.exchangeRateToBase,
    });
    if (netRefunds && payment.kind === "REFUND") return sum - base;
    return sum + base;
  }, 0);

  const refundsTotal = refunds.reduce((sum, refund) => sum + toBaseAmount({
    amount: refund.amount,
    currency: refund.currency,
    baseCurrency: params.baseCurrency,
    exchangeRateToBase: refund.exchangeRateToBase,
  }), 0);

  return paymentsTotal - refundsTotal;
}

/**
 * Recompute invoice paidAmount/status from linked payments and mirror paid state on the job.
 * Call after every payment create/update/delete on an invoice.
 */
export async function syncInvoicePaymentState(
  tx: Tx,
  params: {
    orgId: string;
    invoiceId: string;
    baseCurrency: string;
    actorUserId?: string | null;
    clientPaymentRef?: string | null;
    netRefunds?: boolean;
  },
): Promise<InvoicePaymentSyncResult> {
  const invoice = await tx.invoice.findFirst({
    where: { id: params.invoiceId, orgId: params.orgId },
    select: { id: true, totalAmount: true, currency: true, jobId: true, status: true },
  });

  if (!invoice) {
    throw new Error(`Invoice ${params.invoiceId} not found for org ${params.orgId}`);
  }

  if (invoice.status === "VOID") {
    return { paidAmount: 0, isPaid: false, totalAmount: invoice.totalAmount, jobId: invoice.jobId };
  }

  const paidAmount = await sumInvoicePaidAmount(tx, params);
  // paidAmount is in base currency, but totalAmount is in the invoice's currency —
  // convert the total to base so the paid/total comparison is like-for-like (a
  // foreign invoice must not flip to PAID after a tiny base-value payment).
  const totalBase = await toDocumentBase(tx, {
    orgId: params.orgId,
    amount: invoice.totalAmount,
    docCurrency: invoice.currency,
    baseCurrency: params.baseCurrency,
    rateFrom: { invoiceId: params.invoiceId },
  });
  const isPaid = totalBase > 0 && paidAmount >= totalBase;
  const paidAt = isPaid ? new Date() : null;
  const status = invoice.totalAmount <= 0 ? "PAID" : isPaid ? "PAID" : "ISSUED";

  await tx.invoice.updateMany({
    where: { id: invoice.id, orgId: params.orgId },
    data: { paidAmount, paidAt, status },
  });

  if (invoice.jobId) {
    const jobData: {
      clientPaid: boolean;
      clientPaidAt: Date | null;
      clientPaidById: string | null;
      clientPaymentRef?: string | null;
    } = {
      clientPaid: isPaid,
      clientPaidAt: paidAt,
      clientPaidById: isPaid ? (params.actorUserId ?? null) : null,
    };
    if (params.clientPaymentRef !== undefined) {
      jobData.clientPaymentRef = params.clientPaymentRef || null;
    }

    await tx.job.updateMany({
      where: { id: invoice.jobId, orgId: params.orgId },
      data: jobData,
    });
  }

  return { paidAmount, isPaid, totalAmount: invoice.totalAmount, jobId: invoice.jobId };
}

/** Sum sale-linked payments in org base currency; REFUND payments and standalone Refund rows net off. */
export async function sumSalePaidAmount(
  tx: Tx,
  params: { orgId: string; saleId: string; baseCurrency: string },
): Promise<number> {
  const [payments, refunds] = await Promise.all([
    tx.payment.findMany({
      where: { orgId: params.orgId, saleId: params.saleId },
      select: { amount: true, currency: true, exchangeRateToBase: true, kind: true },
    }),
    // Standalone Refund rows (Documents → Refunds path) net off the sale too.
    tx.refund.findMany({
      where: { orgId: params.orgId, saleId: params.saleId },
      select: { amount: true, currency: true, exchangeRateToBase: true },
    }),
  ]);

  const paymentsTotal = payments.reduce((sum, payment) => {
    const base = toBaseAmount({
      amount: payment.amount,
      currency: payment.currency,
      baseCurrency: params.baseCurrency,
      exchangeRateToBase: payment.exchangeRateToBase,
    });
    return payment.kind === "REFUND" ? sum - base : sum + base;
  }, 0);

  const refundsTotal = refunds.reduce((sum, refund) => sum + toBaseAmount({
    amount: refund.amount,
    currency: refund.currency,
    baseCurrency: params.baseCurrency,
    exchangeRateToBase: refund.exchangeRateToBase,
  }), 0);

  return paymentsTotal - refundsTotal;
}

/** Recompute sale paidAmount/status from linked payments (FX-converted, refunds netted). */
export async function syncSalePaymentState(
  tx: Tx,
  params: { orgId: string; saleId: string },
): Promise<SalePaymentSyncResult> {
  const sale = await tx.sale.findFirst({
    where: { id: params.saleId, orgId: params.orgId },
    select: { totalAmount: true, currency: true, status: true },
  });

  if (!sale) {
    throw new Error(`Sale ${params.saleId} not found for org ${params.orgId}`);
  }

  // A voided sale's status must not be recomputed back to OPEN/PAID.
  if (sale.status === "VOID") {
    return { paidAmount: 0, isPaid: false, totalAmount: sale.totalAmount };
  }

  const org = await tx.organization.findUnique({ where: { id: params.orgId }, select: { baseCurrency: true } });
  const baseCurrency = org?.baseCurrency ?? "UGX";
  const paidAmount = await sumSalePaidAmount(tx, { orgId: params.orgId, saleId: params.saleId, baseCurrency });
  // Compare paid (base) against the total converted to base — see toDocumentBase.
  const totalBase = await toDocumentBase(tx, {
    orgId: params.orgId,
    amount: sale.totalAmount,
    docCurrency: sale.currency,
    baseCurrency,
    rateFrom: { saleId: params.saleId },
  });
  const isPaid = totalBase > 0 && paidAmount >= totalBase;

  // M10: reflect returns on the sale. Fully-returned → RETURNED; partially
  // returned → PARTIALLY_RETURNED; otherwise the normal paid/open state.
  const [soldAgg, creditNotes] = await Promise.all([
    tx.saleItem.aggregate({ where: { saleId: params.saleId }, _sum: { quantity: true } }),
    tx.creditNote.findMany({ where: { orgId: params.orgId, saleId: params.saleId }, select: { items: { select: { quantity: true } } } }),
  ]);
  const soldQty = soldAgg._sum.quantity ?? 0;
  const returnedQty = creditNotes.reduce((s, cn) => s + cn.items.reduce((a, i) => a + i.quantity, 0), 0);

  let status: "OPEN" | "PAID" | "PARTIALLY_RETURNED" | "RETURNED";
  if (returnedQty > 0 && soldQty > 0 && returnedQty >= soldQty) status = "RETURNED";
  else if (returnedQty > 0) status = "PARTIALLY_RETURNED";
  else status = isPaid ? "PAID" : "OPEN";

  await tx.sale.updateMany({
    where: { id: params.saleId, orgId: params.orgId },
    data: {
      paidAmount,
      paidAt: isPaid ? new Date() : null,
      status,
    },
  });

  return { paidAmount, isPaid, totalAmount: sale.totalAmount };
}
