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
    select: { id: true, totalAmount: true, jobId: true, status: true },
  });

  if (!invoice) {
    throw new Error(`Invoice ${params.invoiceId} not found for org ${params.orgId}`);
  }

  if (invoice.status === "VOID") {
    return { paidAmount: 0, isPaid: false, totalAmount: invoice.totalAmount, jobId: invoice.jobId };
  }

  const paidAmount = await sumInvoicePaidAmount(tx, params);
  const isPaid = invoice.totalAmount > 0 && paidAmount >= invoice.totalAmount;
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

/** Recompute sale paidAmount/status from linked payments. */
export async function syncSalePaymentState(
  tx: Tx,
  params: { orgId: string; saleId: string },
): Promise<SalePaymentSyncResult> {
  const sale = await tx.sale.findFirst({
    where: { id: params.saleId, orgId: params.orgId },
    select: { totalAmount: true },
  });

  if (!sale) {
    throw new Error(`Sale ${params.saleId} not found for org ${params.orgId}`);
  }

  const payAgg = await tx.payment.aggregate({
    where: { saleId: params.saleId, orgId: params.orgId },
    _sum: { amount: true },
  });
  const paidAmount = payAgg._sum.amount ?? 0;
  const isPaid = sale.totalAmount > 0 && paidAmount >= sale.totalAmount;

  await tx.sale.updateMany({
    where: { id: params.saleId, orgId: params.orgId },
    data: {
      paidAmount,
      paidAt: isPaid ? new Date() : null,
      status: isPaid ? "PAID" : "OPEN",
    },
  });

  return { paidAmount, isPaid, totalAmount: sale.totalAmount };
}
