import type { Prisma } from "@prisma/client";

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

/** Next JE-YYYY-#### number, shared across manual and auto entries for the org/year. */
async function nextEntryNumber(tx: Tx, orgId: string, year: number): Promise<string> {
  const prefix = `JE-${year}-`;
  const rows = await tx.journalEntry.findMany({
    where: { orgId, entryNumber: { startsWith: prefix } },
    select: { entryNumber: true },
  });
  const max = rows.reduce((m, r) => {
    const n = Number(r.entryNumber.slice(prefix.length));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

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

  let totalDebit = 0;
  let totalCredit = 0;
  const lineData = params.lines.map((l) => {
    const accountId = accounts[l.code];
    if (!accountId) throw new Error(`Auto-post: unknown account code ${l.code}`);
    const debit = round2(l.debit ?? 0);
    const credit = round2(l.credit ?? 0);
    totalDebit += debit;
    totalCredit += credit;
    return { accountId, debit, credit, description: l.memo ?? null };
  });

  totalDebit = round2(totalDebit);
  totalCredit = round2(totalCredit);
  if (totalDebit <= 0 && totalCredit <= 0) return null;
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
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

/** Supplier/inventory payment (cash basis = cost recognised when paid): Dr Cost of Sales, Cr Cash. */
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
