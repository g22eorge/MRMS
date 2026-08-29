import type { Prisma } from "@prisma/client";

import { currencyDecimals, normalizeCurrency, roundMoney } from "@/lib/currency";

/**
 * Cash-basis double-entry posting service (C5).
 *
 * Business money-events (customer payments, expenses, refunds, supplier
 * payments) post a balanced, POSTED JournalEntry against a small set of
 * system accounts so the ledger — and the P&L / Balance Sheet / Trial
 * Balance reports — populate automatically. Cash basis: revenue and
 * expense are recognised when money moves, not when invoiced.
 *
 * Every post is idempotent on `reference` (e.g. "pay:<paymentId>"): if an
 * entry with that reference already exists for the org, we skip. This makes
 * retries and one-off backfills safe.
 */

type Tx = Prisma.TransactionClient;

// Standard cash-basis chart of accounts. Seeded per-org on first post.
const CORE_ACCOUNTS = [
  { code: "1000", name: "Cash & Bank", type: "ASSET" },
  { code: "2100", name: "VAT Payable", type: "LIABILITY" },
  { code: "3000", name: "Owner's Equity", type: "EQUITY" },
  { code: "4000", name: "Sales Revenue", type: "REVENUE" },
  { code: "5000", name: "Cost of Sales", type: "EXPENSE" },
  { code: "6000", name: "Operating Expenses", type: "EXPENSE" },
  // Bank and transfer charges are a finance cost, not part of what the goods
  // cost. Keeping them out of 5000 is what lets gross margin stay meaningful
  // while the true landed cost of stock is still reported for pricing.
  { code: "6100", name: "Bank & Transfer Charges", type: "EXPENSE" },
] as const;

export type CoreAccountCode = (typeof CORE_ACCOUNTS)[number]["code"];

/** Ensure the org has the core system accounts; returns a code -> accountId map. */
export async function ensureCoreAccounts(tx: Tx, orgId: string): Promise<Record<string, string>> {
  const existing = await tx.chartOfAccount.findMany({ where: { orgId }, select: { id: true, code: true } });
  const byCode: Record<string, string> = {};
  for (const a of existing) byCode[a.code] = a.id;

  for (const acct of CORE_ACCOUNTS) {
    if (byCode[acct.code]) continue;
    const created = await tx.chartOfAccount.create({
      data: { orgId, code: acct.code, name: acct.name, type: acct.type as never, isSystem: true, isActive: true },
      select: { id: true },
    });
    byCode[acct.code] = created.id;
  }
  return byCode;
}

/**
 * Next JE-YYYY-#### number, shared across manual and auto entries for the
 * org/year. Uses the atomic per-(orgId,type,year) DocumentSequence counter so
 * two money-events posting concurrently in the same org can't compute the same
 * number (which previously collided on the @@unique and rolled back the whole
 * payment). Seeds from the current max existing entry so numbering continues.
 */
async function nextEntryNumber(tx: Tx, orgId: string, year: number): Promise<string> {
  const type = "JE";
  const prefix = `JE-${year}-`;
  const existing = await tx.documentSequence.findUnique({ where: { orgId_type_year: { orgId, type, year } } });
  if (!existing) {
    const rows = await tx.journalEntry.findMany({
      where: { orgId, entryNumber: { startsWith: prefix } },
      select: { entryNumber: true },
    });
    const seed = rows.reduce((m, r) => {
      const n = Number(r.entryNumber.slice(prefix.length));
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    try {
      await tx.documentSequence.create({ data: { orgId, type, year, value: seed } });
    } catch (err) {
      // A concurrent post seeded it first — fine, we increment below.
      if (!(err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002")) throw err;
    }
  }
  const updated = await tx.documentSequence.update({
    where: { orgId_type_year: { orgId, type, year } },
    data: { value: { increment: 1 } },
    select: { value: true },
  });
  return `${prefix}${String(updated.value).padStart(4, "0")}`;
}

/**
 * The org's base currency, for rounding ledger lines to a real minor unit.
 *
 * Read on the caller's `tx` — this runs inside interactive write transactions,
 * and on Turso/libSQL a read issued on the global client while such a
 * transaction holds the connection deadlocks it.
 */
async function ledgerCurrency(tx: Tx, orgId: string): Promise<string> {
  try {
    const org = await tx.organization.findUnique({ where: { id: orgId }, select: { baseCurrency: true } });
    return normalizeCurrency(org?.baseCurrency, "UGX");
  } catch {
    return "UGX";
  }
}

type PostLine = { code: CoreAccountCode | string; debit?: number; credit?: number; memo?: string };

export type PostJournalParams = {
  orgId: string;
  userId: string;
  date?: Date;
  description: string;
  reference?: string; // idempotency key; also shown as the entry ref
  lines: PostLine[];
};

/**
 * Post a balanced journal entry. Returns the created entry id, or null when
 * there is nothing to post (zero total) or an entry with the same reference
 * already exists (idempotent skip). Throws if debits != credits.
 */
export async function postJournalEntry(tx: Tx, params: PostJournalParams): Promise<{ id: string } | null> {
  if (params.reference) {
    const dup = await tx.journalEntry.findFirst({
      where: { orgId: params.orgId, reference: params.reference },
      select: { id: true },
    });
    if (dup) return null;
  }

  const accounts = await ensureCoreAccounts(tx, params.orgId);

  // Round to the org's actual minor unit, not a hardcoded two decimals. The
  // ledger used round2 regardless of currency, so on a zero-decimal currency
  // like UGX every line kept up to two phantom decimals — and because the
  // balance tolerance was a flat 0.01, whether an entry was accepted depended
  // on how many lines it had: three lines each 0.004 out summed past the
  // tolerance while one line did not. Same entry, different verdict.
  const currency = await ledgerCurrency(tx, params.orgId);

  let totalDebit = 0;
  let totalCredit = 0;
  const lineData = params.lines.map((l) => {
    const accountId = accounts[l.code];
    if (!accountId) throw new Error(`Auto-post: unknown account code ${l.code}`);
    const debit = roundMoney(l.debit ?? 0, currency);
    const credit = roundMoney(l.credit ?? 0, currency);
    totalDebit += debit;
    totalCredit += credit;
    return { accountId, debit, credit, description: l.memo ?? null };
  });

  totalDebit = roundMoney(totalDebit, currency);
  totalCredit = roundMoney(totalCredit, currency);
  if (totalDebit <= 0 && totalCredit <= 0) return null;
  // Both sides are now on the same minor-unit grid, so anything beyond half a
  // minor unit is a genuine imbalance rather than accumulated float dust.
  const tolerance = 10 ** -currencyDecimals(currency) / 2;
  if (Math.abs(totalDebit - totalCredit) > tolerance) {
    throw new Error(`Auto-post not balanced: debit ${totalDebit} != credit ${totalCredit} (${params.description})`);
  }

  const date = params.date ?? new Date();
  const entryNumber = await nextEntryNumber(tx, params.orgId, date.getFullYear());

  return tx.journalEntry.create({
    data: {
      orgId: params.orgId,
      entryNumber,
      date,
      description: params.description,
      reference: params.reference ?? null,
      status: "POSTED",
      postedAt: new Date(),
      totalAmount: totalDebit,
      createdById: params.userId,
      lines: { create: lineData },
    },
    select: { id: true },
  });
}

/**
 * Post a reversing entry that exactly cancels a prior POSTED entry (found by its
 * `reference`, e.g. "pay:<id>" or "refund:<id>"): same accounts and amounts with
 * debit/credit swapped. Used when a receipt/refund is deleted so the cash-basis
 * ledger doesn't overstate cash. Idempotent on "<reference>:reversal", and a
 * no-op when the original never posted (nothing to reverse).
 */
export async function reverseJournalEntry(
  tx: Tx,
  params: { orgId: string; userId: string; originalReference: string; description?: string; date?: Date },
): Promise<{ id: string } | null> {
  const reversalRef = `${params.originalReference}:reversal`;
  const already = await tx.journalEntry.findFirst({ where: { orgId: params.orgId, reference: reversalRef }, select: { id: true } });
  if (already) return null;

  const original = await tx.journalEntry.findFirst({
    where: { orgId: params.orgId, reference: params.originalReference, status: "POSTED" },
    select: { totalAmount: true, lines: { select: { accountId: true, debit: true, credit: true, description: true } } },
  });
  if (!original || original.lines.length === 0) return null;

  const date = params.date ?? new Date();
  const entryNumber = await nextEntryNumber(tx, params.orgId, date.getFullYear());
  return tx.journalEntry.create({
    data: {
      orgId: params.orgId,
      entryNumber,
      date,
      description: params.description ?? `Reversal of ${params.originalReference}`,
      reference: reversalRef,
      status: "POSTED",
      postedAt: new Date(),
      totalAmount: original.totalAmount,
      createdById: params.userId,
      lines: { create: original.lines.map((l) => ({ accountId: l.accountId, debit: l.credit, credit: l.debit, description: l.description })) },
    },
    select: { id: true },
  });
}

// ---------------------------------------------------------------------------
// Event helpers (cash basis)
// ---------------------------------------------------------------------------

type MoneyEvent = {
  orgId: string;
  userId: string;
  amount: number;
  date?: Date;
  reference?: string;
  description?: string;
};

/** Customer payment received (POS sale or invoice): Dr Cash, Cr Sales Revenue. */
export async function postSalePayment(tx: Tx, p: MoneyEvent): Promise<void> {
  if (!(p.amount > 0)) return;
  await postJournalEntry(tx, {
    orgId: p.orgId,
    userId: p.userId,
    date: p.date,
    description: p.description ?? "Payment received",
    reference: p.reference,
    lines: [
      { code: "1000", debit: p.amount, memo: "Cash received" },
      { code: "4000", credit: p.amount, memo: "Sales revenue" },
    ],
  });
}

/** Customer refund paid out: Dr Sales Revenue (contra), Cr Cash. */
export async function postRefund(tx: Tx, p: MoneyEvent): Promise<void> {
  if (!(p.amount > 0)) return;
  await postJournalEntry(tx, {
    orgId: p.orgId,
    userId: p.userId,
    date: p.date,
    description: p.description ?? "Refund issued",
    reference: p.reference,
    lines: [
      { code: "4000", debit: p.amount, memo: "Refund of sales revenue" },
      { code: "1000", credit: p.amount, memo: "Cash refunded" },
    ],
  });
}

/** Operating expense paid: Dr Operating Expenses, Cr Cash. */
export async function postExpensePayment(tx: Tx, p: MoneyEvent): Promise<void> {
  if (!(p.amount > 0)) return;
  await postJournalEntry(tx, {
    orgId: p.orgId,
    userId: p.userId,
    date: p.date,
    description: p.description ?? "Expense paid",
    reference: p.reference,
    lines: [
      { code: "6000", debit: p.amount, memo: "Operating expense" },
      { code: "1000", credit: p.amount, memo: "Cash paid" },
    ],
  });
}

/** External technician payout (repair labour paid out, cash basis): Dr Operating Expenses, Cr Cash. */
export async function postTechnicianPayout(tx: Tx, p: MoneyEvent): Promise<void> {
  if (!(p.amount > 0)) return;
  await postJournalEntry(tx, {
    orgId: p.orgId,
    userId: p.userId,
    date: p.date,
    description: p.description ?? "Technician payout",
    reference: p.reference,
    lines: [
      { code: "6000", debit: p.amount, memo: "Technician labour" },
      { code: "1000", credit: p.amount, memo: "Cash paid to technician" },
    ],
  });
}

/** Supplier/inventory payment (cash basis = cost recognised when paid): Dr Cost of Sales, Cr Cash. */
/**
 * The charge paid to move money to a supplier, as a finance cost.
 *
 * Posted separately from the goods so the books answer two different questions
 * correctly: cost of sales stays the cost of what was bought, and the annual
 * cost of moving money abroad is visible as its own line rather than buried in
 * stock. Pricing uses landed cost, which adds this back per item — the two
 * views are deliberately different and both are right.
 */
export async function postSupplierTransferFee(tx: Tx, p: MoneyEvent): Promise<void> {
  if (!(p.amount > 0)) return;
  await postJournalEntry(tx, {
    orgId: p.orgId,
    userId: p.userId,
    date: p.date,
    description: p.description ?? "Supplier transfer charge",
    reference: p.reference,
    lines: [
      { code: "6100", debit: p.amount, memo: "Bank & transfer charges" },
      { code: "1000", credit: p.amount, memo: "Charge deducted on transfer" },
    ],
  });
}

export async function postSupplierPayment(tx: Tx, p: MoneyEvent): Promise<void> {
  if (!(p.amount > 0)) return;
  await postJournalEntry(tx, {
    orgId: p.orgId,
    userId: p.userId,
    date: p.date,
    description: p.description ?? "Supplier payment",
    reference: p.reference,
    lines: [
      { code: "5000", debit: p.amount, memo: "Cost of sales" },
      { code: "1000", credit: p.amount, memo: "Cash paid to supplier" },
    ],
  });
}
