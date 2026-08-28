import { toBaseAmount } from "@/lib/currency";
import { INCOMING_PAYMENT } from "@/lib/finance/payment-kinds";
import { prisma } from "@/lib/prisma";

/**
 * How much may still be refunded in cash, in org base currency.
 *
 * Two ceilings apply and the lower one wins:
 *
 *   1. the credit note — you cannot refund more than you credited;
 *   2. the money actually received — you cannot pay back what was never paid.
 *
 * Only the first was ever enforced. That was safe only because credit notes
 * could be raised against fully-paid documents alone, so "credited" could never
 * exceed "received" and the payment gate stood in for this check without
 * anyone stating it. The moment credit notes are allowed on unpaid credit
 * sales — which they must be, since a customer returning goods bought on
 * 30-day terms needs their balance reduced — that coincidence ends, and
 * refunding against an invoice nobody has paid becomes possible.
 *
 * So the two changes belong together: whoever opens credit notes to unpaid
 * documents has to bring this ceiling with them.
 *
 * A return on an unpaid invoice is still handled correctly. The credit note
 * reduces the balance owed, which is the whole remedy; there is simply no cash
 * to hand back, so the refundable amount is zero and the UI says so.
 */

export type RefundableCeiling = {
  /** Base-currency amount that may still be refunded. */
  refundableBase: number;
  /** Ceiling from the credit note alone, for messaging. */
  creditRemainingBase: number;
  /** Ceiling from cash actually received, for messaging. */
  cashRemainingBase: number;
  /** True when the cash ceiling is the binding one. */
  limitedByCash: boolean;
};

export async function refundableCeiling(params: {
  orgId: string;
  baseCurrency: string;
  creditNote: {
    id: string;
    totalAmount: number;
    currency: string | null;
    exchangeRateToBase: number | null;
    invoiceId: string | null;
    saleId: string | null;
  };
}): Promise<RefundableCeiling> {
  const { orgId, baseCurrency, creditNote } = params;
  const base = (amount: number, currency: string | null, rate: number | null) =>
    toBaseAmount({ amount, currency, baseCurrency, exchangeRateToBase: rate });

  // ── ceiling 1: the credit note ──────────────────────────────────────────
  const creditedBase = base(creditNote.totalAmount, creditNote.currency, creditNote.exchangeRateToBase);
  const againstNote = await prisma.refund.findMany({
    where: { orgId, creditNoteId: creditNote.id },
    select: { amount: true, currency: true, exchangeRateToBase: true },
  });
  const refundedOnNoteBase = againstNote.reduce((sum, r) => sum + base(r.amount, r.currency, r.exchangeRateToBase), 0);
  const creditRemainingBase = Math.max(0, creditedBase - refundedOnNoteBase);

  // ── ceiling 2: cash actually received on the parent ─────────────────────
  const parentWhere = creditNote.invoiceId
    ? { invoiceId: creditNote.invoiceId }
    : creditNote.saleId
      ? { saleId: creditNote.saleId }
      : null;

  if (!parentWhere) {
    // No parent to measure against; the credit note is the only ceiling.
    return {
      refundableBase: creditRemainingBase,
      creditRemainingBase,
      cashRemainingBase: creditRemainingBase,
      limitedByCash: false,
    };
  }

  const [payments, refundsOnParent, refundPayments] = await Promise.all([
    prisma.payment.findMany({
      // kind matters: a refund taken from the job Billing tab is written as a
      // Payment row with kind "REFUND" and a POSITIVE amount, negated only when
      // read. Summing every row therefore counted money paid out as money
      // received, and doubled the ceiling — pay 100,000, refund it from the job,
      // and a credit note would let you refund another 100,000. The guard that
      // exists to stop paying back money never received was inverted by the very
      // rows that record paying it back.
      where: { orgId, ...parentWhere, ...INCOMING_PAYMENT },
      select: { amount: true, currency: true, exchangeRateToBase: true },
    }),
    prisma.refund.findMany({
      where: { orgId, ...parentWhere },
      select: { amount: true, currency: true, exchangeRateToBase: true },
    }),
    // Refunds are recorded two ways depending on where they were taken: a
    // Refund row from the documents side, and a REFUND-kind Payment row from
    // the job Billing tab. Both are money out, and both have to be subtracted
    // or the same cash can be handed back through the other door.
    prisma.payment.findMany({
      where: { orgId, ...parentWhere, kind: "REFUND" },
      select: { amount: true, currency: true, exchangeRateToBase: true },
    }),
  ]);
  const receivedBase = payments.reduce((sum, p) => sum + base(p.amount, p.currency, p.exchangeRateToBase), 0);
  const paidOutBase =
    refundsOnParent.reduce((sum, r) => sum + base(r.amount, r.currency, r.exchangeRateToBase), 0) +
    refundPayments.reduce((sum, p) => sum + base(p.amount, p.currency, p.exchangeRateToBase), 0);
  const cashRemainingBase = Math.max(0, receivedBase - paidOutBase);

  return {
    refundableBase: Math.min(creditRemainingBase, cashRemainingBase),
    creditRemainingBase,
    cashRemainingBase,
    limitedByCash: cashRemainingBase < creditRemainingBase,
  };
}
