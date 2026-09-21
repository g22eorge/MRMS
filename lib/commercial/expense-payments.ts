import type { TxClient } from "@/lib/prisma";

import { postExpensePayment } from "@/lib/accounting/post";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { parsePaymentMethod } from "@/lib/constants/payment-methods";

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
};

/**
 * Record one (possibly partial) payment against an expense, atomically:
 * balance cap, ExpensePayment row, paidAmount rollup, paidAt on completion,
 * and one idempotent ledger post keyed on the payment id. Throws Error on
 * any violation — callers turn it into their banner.
 */
export async function recordExpensePayment(
  tx: TxClient,
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

  await postExpensePayment(tx, {
    orgId,
    userId,
    amount: params.amount,
    method: params.method ?? null,
    date: params.paidAt,
    reference: `expensepay:${payment.id}`,
    description: `Expense ${expense.expenseNumber} — ${expense.description}`,
  });

  await writeSystemAuditEvent({
    orgId,
    actorUserId: userId,
    entityType: "Expense",
    entityId: expenseId,
    action: "EXPENSE_PAID",
    summary: `${expense.expenseNumber} — ${params.amount.toLocaleString()} paid${isPaid ? " — settled in full" : " — part payment"}`,
  }).catch(() => {});

  return { paymentId: payment.id, paidAmount, isPaid };
}
