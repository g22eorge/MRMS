import { prisma } from "@/lib/prisma";

/**
 * Statement-of-account builders (M20).
 *
 * A party statement lists every billed document (invoice/sale for a client,
 * bill for a supplier) with the amount billed, paid, and the outstanding
 * balance, plus a running balance and headline totals. Uses each document's
 * own paidAmount (kept accurate by the payment-sync + refund-netting fixes),
 * so it reconciles with the ledger without re-deriving payments.
 */

export type StatementLine = {
  type: string;
  number: string;
  date: Date;
  status: string;
  billed: number;
  paid: number;
  balance: number; // billed - paid for this document
  running: number; // cumulative outstanding up to and including this line
};

export type Statement = {
  lines: StatementLine[];
  totals: { billed: number; paid: number; outstanding: number };
  currency: string;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Rate to convert one document's currency into org base.
 *
 * Invoice/Sale.totalAmount is stored in the DOCUMENT's currency while
 * paidAmount is stored in org BASE currency, so subtracting one from the other
 * mixes units: a USD 100 invoice paid in full at 3,800 produced a statement
 * reading "billed 100, paid 380,000, balance -379,900". Documents carry no rate
 * of their own, so the rate is taken from their own payments — the same source
 * paidAmount was built from, which keeps the two sides consistent.
 */
async function documentRates(
  orgId: string,
  baseCurrency: string,
  docs: Array<{ key: "invoiceId" | "saleId"; id: string; currency: string }>,
): Promise<Map<string, number>> {
  const foreign = docs.filter((d) => d.currency && d.currency !== baseCurrency);
  const rates = new Map<string, number>();
  if (!foreign.length) return rates;

  const payments = await prisma.payment.findMany({
    where: {
      orgId,
      exchangeRateToBase: { not: null },
      OR: [
        { invoiceId: { in: foreign.filter((d) => d.key === "invoiceId").map((d) => d.id) } },
        { saleId: { in: foreign.filter((d) => d.key === "saleId").map((d) => d.id) } },
      ],
    },
    select: { invoiceId: true, saleId: true, exchangeRateToBase: true, receivedAt: true },
    orderBy: { receivedAt: "asc" },
  });
  // Ascending order means the last write wins, i.e. the most recent rate.
  for (const p of payments) {
    const id = p.invoiceId ?? p.saleId;
    if (id && p.exchangeRateToBase && p.exchangeRateToBase > 0) rates.set(id, p.exchangeRateToBase);
  }
  return rates;
}

/** Client receivables statement: their invoices + POS sales (excluding voided). */
export async function getClientStatement(orgId: string, clientId: string, currency: string): Promise<Statement> {
  const [invoices, sales] = await Promise.all([
    prisma.invoice.findMany({
      where: { orgId, clientId, status: { not: "VOID" } },
      select: { id: true, invoiceNumber: true, issuedAt: true, status: true, totalAmount: true, paidAmount: true, currency: true },
    }),
    prisma.sale.findMany({
      where: { orgId, clientId, status: { not: "VOID" } },
      select: { id: true, saleNumber: true, createdAt: true, status: true, totalAmount: true, paidAmount: true, currency: true },
    }),
  ]);

  // The statement is presented in one currency (org base), so the billed side is
  // converted into base too rather than being left in the document's currency.
  const rates = await documentRates(orgId, currency, [
    ...invoices.map((i) => ({ key: "invoiceId" as const, id: i.id, currency: i.currency })),
    ...sales.map((s) => ({ key: "saleId" as const, id: s.id, currency: s.currency })),
  ]);
  const toBase = (amount: number, docCurrency: string, id: string) =>
    !docCurrency || docCurrency === currency ? amount : amount * (rates.get(id) ?? 1);

  const raw: Omit<StatementLine, "running">[] = [
    ...invoices.map((i) => {
      const billed = round2(toBase(i.totalAmount, i.currency, i.id));
      const paid = round2(i.paidAmount);
      return {
        type: "Invoice",
        number: i.invoiceNumber,
        date: i.issuedAt,
        status: i.status,
        billed,
        paid,
        balance: round2(billed - paid),
      };
    }),
    ...sales.map((s) => {
      const billed = round2(toBase(s.totalAmount, s.currency, s.id));
      const paid = round2(s.paidAmount);
      return {
        type: "Sale",
        number: s.saleNumber,
        date: s.createdAt,
        status: s.status,
        billed,
        paid,
        balance: round2(billed - paid),
      };
    }),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return finalize(raw, currency);
}

/** Supplier payables statement: their non-cancelled bills. */
export async function getSupplierStatement(orgId: string, supplierId: string, currency: string): Promise<Statement> {
  const bills = await prisma.supplierBill.findMany({
    where: { orgId, supplierId, status: { not: "CANCELLED" } },
    select: { billNumber: true, issuedAt: true, status: true, totalAmount: true, paidAmount: true },
  });

  const raw: Omit<StatementLine, "running">[] = bills
    .map((b) => ({
      type: "Bill",
      number: b.billNumber,
      date: b.issuedAt,
      status: b.status,
      billed: round2(b.totalAmount),
      paid: round2(b.paidAmount),
      balance: round2(b.totalAmount - b.paidAmount),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return finalize(raw, currency);
}

function finalize(raw: Omit<StatementLine, "running">[], currency: string): Statement {
  let running = 0;
  const lines: StatementLine[] = raw.map((l) => {
    running = round2(running + l.balance);
    return { ...l, running };
  });
  const billed = round2(lines.reduce((s, l) => s + l.billed, 0));
  const paid = round2(lines.reduce((s, l) => s + l.paid, 0));
  return { lines, totals: { billed, paid, outstanding: round2(billed - paid) }, currency };
}
