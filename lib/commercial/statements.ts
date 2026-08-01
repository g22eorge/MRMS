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

/** Client receivables statement: their invoices + POS sales (excluding voided). */
export async function getClientStatement(orgId: string, clientId: string, currency: string): Promise<Statement> {
  const [invoices, sales] = await Promise.all([
    prisma.invoice.findMany({
      where: { orgId, clientId, status: { not: "VOID" } },
      select: { invoiceNumber: true, issuedAt: true, status: true, totalAmount: true, paidAmount: true },
    }),
    prisma.sale.findMany({
      where: { orgId, clientId, status: { not: "VOID" } },
      select: { saleNumber: true, createdAt: true, status: true, totalAmount: true, paidAmount: true },
    }),
  ]);

  const raw: Omit<StatementLine, "running">[] = [
    ...invoices.map((i) => ({
      type: "Invoice",
      number: i.invoiceNumber,
      date: i.issuedAt,
      status: i.status,
      billed: round2(i.totalAmount),
      paid: round2(i.paidAmount),
      balance: round2(i.totalAmount - i.paidAmount),
    })),
    ...sales.map((s) => ({
      type: "Sale",
      number: s.saleNumber,
      date: s.createdAt,
      status: s.status,
      billed: round2(s.totalAmount),
      paid: round2(s.paidAmount),
      balance: round2(s.totalAmount - s.paidAmount),
    })),
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
