import type { TxClient } from "@/lib/prisma";

import { currencyDecimals, normalizeCurrency, roundMoney } from "@/lib/currency";
import { composeUniversalNumber, getOrgNumberConfig } from "@/lib/commercial/org-number";

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

type Tx = TxClient;

// Standard cash-basis chart of accounts. Seeded per-org on first post.
const CORE_ACCOUNTS = [
  { code: "1000", name: "Cash & Bank", type: "ASSET" },
  // Cash sub-accounts: postings hit the channel the money actually moved on,
  // so till, mobile-money and bank balances read straight out of the ledger.
  // 1000 stays as the pooled parent — history booked before channels keeps
  // living there, untouched.
  { code: "1010", name: "Cash on Hand (Till)", type: "ASSET" },
  { code: "1020", name: "Mobile Money", type: "ASSET" },
  { code: "1030", name: "Bank Account", type: "ASSET" },
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

/**
 * Which cash sub-account a payment method moves money on. Unknown/empty
 * methods fall back to the pooled 1000 parent, which is also where all
 * pre-channel history lives.
 */
export function cashAccountFor(method?: string | null): CoreAccountCode {
  switch ((method ?? "").trim().toUpperCase()) {
    case "CASH":
      return "1010";
    case "MOBILE_MONEY":
      return "1020";
    case "BANK_TRANSFER":
    case "CARD":
      return "1030";
    default:
      return "1000";
  }
}

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
 * Next universal journal number TAG/JE/YYYY/MM/NNN, shared across manual and
 * auto entries. Uses the atomic per-(orgId,type,year,month) DocumentSequence
 * counter so two money-events posting concurrently in the same org can't
 * compute the same number. Legacy JE-YYYY-#### numbers stay grandfathered.
 */
async function nextEntryNumber(tx: Tx, orgId: string, at: Date): Promise<string> {
  const type = "JE";
  const year = at.getFullYear();
  const month = at.getMonth() + 1;
  // Branding read on the caller's tx (see getOrgNumberConfig deadlock note).
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
      if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002" && attempt < 24) continue;
      throw error;
    }
    const taken = await tx.journalEntry.findFirst({ where: { entryNumber: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  throw new Error("Could not allocate a unique journal entry number for this organisation.");
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
  const entryNumber = await nextEntryNumber(tx, params.orgId, date);

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
  const entryNumber = await nextEntryNumber(tx, params.orgId, date);
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

const CHANNEL_ACCOUNT_NAMES: Record<string, string> = {
  "1010": "Cash on Hand (Till)",
  "1020": "Mobile Money",
  "1030": "Bank Account",
};

/**
 * Mirror a cash-channel posting into the org's tracked bank account for that
 * channel, creating it (opening zero) on first movement. Manual accounts
 * (no ledgerCode) are never touched. Idempotent on `bank:<reference>`, so a
 * retried posting moves the balance once. Amounts are base-currency, signed:
 * positive in, negative out. Only call after the journal post succeeds — a
 * skipped (duplicate) post must not move money twice.
 */
export async function recordCashAccountMovement(
  tx: Tx,
  params: {
    orgId: string;
    code: string;
    amount: number;
    date?: Date;
    description?: string;
    reference?: string;
  },
): Promise<void> {
  if (!params.amount || !CHANNEL_ACCOUNT_NAMES[params.code]) return;
  const bankRef = params.reference ? `bank:${params.reference}` : null;
  if (bankRef) {
    const dup = await tx.bankTransaction.findFirst({
      where: { orgId: params.orgId, reference: bankRef },
      select: { id: true },
    });
    if (dup) return;
  }
  let account = await tx.bankAccount.findFirst({
    where: { orgId: params.orgId, ledgerCode: params.code },
    select: { id: true, currency: true },
  });
  if (!account) {
    const org = await tx.organization.findUnique({
      where: { id: params.orgId },
      select: { baseCurrency: true },
    }).catch(() => null);
    const label = CHANNEL_ACCOUNT_NAMES[params.code] ?? params.code;
    account = await tx.bankAccount.create({
      data: {
        orgId: params.orgId,
        name: label,
        bankName: label,
        currency: org?.baseCurrency ?? "UGX",
        openingBalance: 0,
        currentBalance: 0,
        ledgerCode: params.code,
      },
      select: { id: true, currency: true },
    });
  }
  const inward = params.amount > 0;
  await tx.bankTransaction.create({
    data: {
      orgId: params.orgId,
      bankAccountId: account.id,
      date: params.date ?? new Date(),
      description: params.description ?? "Till movement",
      amount: Math.abs(params.amount),
      currency: account.currency,
      type: inward ? "CREDIT" : "DEBIT",
      reference: bankRef,
    },
  });
  await tx.bankAccount.update({
    where: { id: account.id },
    data: { currentBalance: { increment: params.amount } },
  });
}

type MoneyEvent = {
  orgId: string;
  userId: string;
  amount: number;
  date?: Date;
  reference?: string;
  description?: string;
  /** Payment channel (CASH, MOBILE_MONEY, …) — selects the cash sub-account. */
  method?: string | null;
};

/** Customer payment received (POS sale or invoice): Dr cash channel, Cr Sales Revenue. */
export async function postSalePayment(tx: Tx, p: MoneyEvent): Promise<void> {
  if (!(p.amount > 0)) return;
  const cash = cashAccountFor(p.method);
  const posted = await postJournalEntry(tx, {
    orgId: p.orgId,
    userId: p.userId,
    date: p.date,
    description: p.description ?? "Payment received",
    reference: p.reference,
    lines: [
      { code: cash, debit: p.amount, memo: "Cash received" },
      { code: "4000", credit: p.amount, memo: "Sales revenue" },
    ],
  });
  if (posted) {
    await recordCashAccountMovement(tx, {
      orgId: p.orgId, code: cash, amount: p.amount, date: p.date,
      description: p.description ?? "Payment received", reference: p.reference,
    });
  }
}

/** Customer refund paid out: Dr Sales Revenue (contra), Cr cash channel. */
export async function postRefund(tx: Tx, p: MoneyEvent): Promise<void> {
  if (!(p.amount > 0)) return;
  const cash = cashAccountFor(p.method);
  const posted = await postJournalEntry(tx, {
    orgId: p.orgId,
    userId: p.userId,
    date: p.date,
    description: p.description ?? "Refund issued",
    reference: p.reference,
    lines: [
      { code: "4000", debit: p.amount, memo: "Refund of sales revenue" },
      { code: cash, credit: p.amount, memo: "Cash refunded" },
    ],
  });
  if (posted) {
    await recordCashAccountMovement(tx, {
      orgId: p.orgId, code: cash, amount: -p.amount, date: p.date,
      description: p.description ?? "Refund issued", reference: p.reference,
    });
  }
}

/** Operating expense paid: Dr Operating Expenses, Cr cash channel. */
export async function postExpensePayment(tx: Tx, p: MoneyEvent): Promise<void> {
  if (!(p.amount > 0)) return;
  const cash = cashAccountFor(p.method);
  const posted = await postJournalEntry(tx, {
    orgId: p.orgId,
    userId: p.userId,
    date: p.date,
    description: p.description ?? "Expense paid",
    reference: p.reference,
    lines: [
      { code: "6000", debit: p.amount, memo: "Operating expense" },
      { code: cash, credit: p.amount, memo: "Cash paid" },
    ],
  });
  if (posted) {
    await recordCashAccountMovement(tx, {
      orgId: p.orgId, code: cash, amount: -p.amount, date: p.date,
      description: p.description ?? "Expense paid", reference: p.reference,
    });
  }
}

/** External technician payout (repair labour paid out, cash basis): Dr Operating Expenses, Cr cash channel. */
export async function postTechnicianPayout(tx: Tx, p: MoneyEvent): Promise<void> {
  if (!(p.amount > 0)) return;
  const cash = cashAccountFor(p.method);
  const posted = await postJournalEntry(tx, {
    orgId: p.orgId,
    userId: p.userId,
    date: p.date,
    description: p.description ?? "Technician payout",
    reference: p.reference,
    lines: [
      { code: "6000", debit: p.amount, memo: "Technician labour" },
      { code: cash, credit: p.amount, memo: "Cash paid to technician" },
    ],
  });
  if (posted) {
    await recordCashAccountMovement(tx, {
      orgId: p.orgId, code: cash, amount: -p.amount, date: p.date,
      description: p.description ?? "Technician payout", reference: p.reference,
    });
  }
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
  const cash = cashAccountFor(p.method);
  const posted = await postJournalEntry(tx, {
    orgId: p.orgId,
    userId: p.userId,
    date: p.date,
    description: p.description ?? "Supplier transfer charge",
    reference: p.reference,
    lines: [
      { code: "6100", debit: p.amount, memo: "Bank & transfer charges" },
      { code: cash, credit: p.amount, memo: "Charge deducted on transfer" },
    ],
  });
  if (posted) {
    await recordCashAccountMovement(tx, {
      orgId: p.orgId, code: cash, amount: -p.amount, date: p.date,
      description: p.description ?? "Supplier transfer charge", reference: p.reference,
    });
  }
}

export async function postSupplierPayment(tx: Tx, p: MoneyEvent): Promise<void> {
  if (!(p.amount > 0)) return;
  const cash = cashAccountFor(p.method);
  const posted = await postJournalEntry(tx, {
    orgId: p.orgId,
    userId: p.userId,
    date: p.date,
    description: p.description ?? "Supplier payment",
    reference: p.reference,
    lines: [
      { code: "5000", debit: p.amount, memo: "Cost of sales" },
      { code: cash, credit: p.amount, memo: "Cash paid to supplier" },
    ],
  });
  if (posted) {
    await recordCashAccountMovement(tx, {
      orgId: p.orgId, code: cash, amount: -p.amount, date: p.date,
      description: p.description ?? "Supplier payment", reference: p.reference,
    });
  }
}
