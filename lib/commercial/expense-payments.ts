import { Prisma } from "@prisma/client";

import { postExpensePayment } from "@/lib/accounting/post";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { parsePaymentMethod } from "@/lib/constants/payment-methods";
import { prisma } from "@/lib/prisma";

export type ExpensePaidStatus = "UNPAID" | "PART_PAID" | "PAID";

/** Derived status: no extra column to drift. Full payment stamps paidAt. */
export function expensePaymentStatus(amount: number, paidAmount: number): ExpensePaidStatus {
  if (paidAmount >= amount) return "PAID";
  if (paidAmount > 0) return "PART_PAID";
  return "UNPAID";
}

export type RecordExpensePaymentResult = {
  paymentId: string;
  paidAmount: number;
  isPaid: boolean;
  /** Data needed to post to ledger asynchronously */
  ledgerPostData?: {
    orgId: string;
    userId: string;
    amount: number;
    method: string | null;
    date: Date;
    reference: string;
    description: string;
  };
};

/**
 * Record one (possibly partial) payment against an expense, atomically:
 * balance cap, ExpensePayment row, paidAmount rollup, paidAt on completion.
 * Returns data needed for async ledger posting (caller handles ledger post separately).
 */
export async function recordExpensePayment(
  tx: Prisma.TransactionClient,
  params: {
    orgId: string;
    userId: string;
    expenseId: string;
    amount: number;
    method?: string | null;
    paidAt: Date;
    note?: string | null;
  },
): Promise<RecordExpensePaymentResult> {
  const { orgId, userId, expenseId } = params;
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new Error("Enter a payment amount greater than zero.");
  }
  const expense = await tx.expense.findFirst({
    where: { id: expenseId, orgId },
    select: { id: true, expenseNumber: true, description: true, amount: true, currency: true, paidAmount: true, paidAt: true },
  });
  if (!expense) throw new Error("Expense not found.");
  if (expense.paidAt) throw new Error(`${expense.expenseNumber} is already paid.`);
  const balance = expense.amount - expense.paidAmount;
  if (params.amount > balance) {
    throw new Error(
      `That is more than the ${expense.expenseNumber} balance of ${balance.toLocaleString()}.`,
    );
  }

  const method = parsePaymentMethod(params.method ?? "CASH", "CASH");
  const payment = await tx.expensePayment.create({
    data: {
      orgId,
      expenseId,
      currency: expense.currency,
      amount: params.amount,
      method,
      paidAt: params.paidAt,
      note: params.note ?? null,
      createdById: userId,
    },
    select: { id: true },
  });

  const paidAmount = expense.paidAmount + params.amount;
  const isPaid = paidAmount >= expense.amount;
  await tx.expense.updateMany({
    where: { id: expenseId, orgId },
    data: { paidAmount, ...(isPaid ? { paidAt: params.paidAt } : {}) },
  });

  await writeSystemAuditEvent({
    orgId,
    actorUserId: userId,
    entityType: "Expense",
    entityId: expenseId,
    action: "EXPENSE_PAID",
    summary: `${expense.expenseNumber} — ${params.amount.toLocaleString()} paid${isPaid ? " — settled in full" : " — part payment"}`,
  }).catch(() => {});

  return {
    paymentId: payment.id,
    paidAmount,
    isPaid,
    ledgerPostData: {
      orgId,
      userId,
      amount: params.amount,
      method: params.method ?? null,
      date: params.paidAt,
      reference: `expensepay:${payment.id}`,
      description: `Expense ${expense.expenseNumber} — ${expense.description}`,
    },
  };
}

/**
 * Post expense payment to the cash-basis ledger.
 * Idempotent on reference — safe to call multiple times / retry.
 * Runs in its own transaction so it doesn't block the payment recording.
 */
export async function postExpensePaymentToLedger(
  params: {
    orgId: string;
    userId: string;
    amount: number;
    method: string | null;
    date: Date;
    reference: string;
    description: string;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await postExpensePayment(tx, params);
  }).catch((error) => {
    console.error("[expense-payments] Ledger post failed:", error);
    // Idempotent — can be retried. Logged for observability.
  });
}
