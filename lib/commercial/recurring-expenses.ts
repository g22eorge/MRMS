import { Prisma } from "@prisma/client";

import type { TxClient } from "@/lib/prisma";

import { prisma } from "@/lib/prisma";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { nextExpenseNumber } from "@/lib/commercial/org-number";
import {
  advanceRecurringDate,
  isRecurringFrequency,
  recurringPeriodKey,
  type RecurringFrequency,
} from "@/lib/commercial/recurring-schedule";

export type IssueRecurringResult =
  | { issued: true; expenseId: string; expenseNumber: string; nextDueAt: Date }
  | { issued: false; reason: "inactive" | "not-due" | "already-issued" };

/**
 * Issues one UNPAID Expense row for a due recurring template and advances it.
 * Idempotent per (template, period): the expense carries a stable reference,
 * so a retried cron never double-issues a month's rent.
 */
export async function issueRecurringExpense(
  orgId: string,
  templateId: string,
  actorUserId: string,
  now = new Date(),
): Promise<IssueRecurringResult> {
  const template = await prisma.recurringExpense.findFirst({
    where: { id: templateId, orgId },
    select: {
      id: true, description: true, category: true, amount: true, currency: true,
      supplierId: true, frequency: true, nextDueAt: true, isActive: true,
      autoIssue: true, notes: true,
    },
  });
  if (!template || !template.isActive) return { issued: false, reason: "inactive" };
  if (template.nextDueAt.getTime() > now.getTime()) return { issued: false, reason: "not-due" };
  if (!isRecurringFrequency(template.frequency)) return { issued: false, reason: "inactive" };

  const frequency = template.frequency as RecurringFrequency;
  const period = recurringPeriodKey(template.nextDueAt);
  const reference = `recurring-exp:${template.id}:${period}`;
  const existing = await prisma.expense.findFirst({
    where: { orgId, reference },
    select: { id: true },
  });
  if (existing) {
    // Already issued (e.g. manual issue beat the cron) — still advance so the
    // template doesn't sit due forever.
    const nextDueAt = advanceRecurringDate(template.nextDueAt, frequency);
    await prisma.recurringExpense.updateMany({
      where: { id: template.id, orgId },
      data: { nextDueAt, lastIssuedAt: now },
    });
    return { issued: false, reason: "already-issued" };
  }

  const nextDueAt = advanceRecurringDate(template.nextDueAt, frequency);

  // Number inside the retry: a P2002 means a concurrent issuer won the same
  // sequence — recompute and try again rather than failing the month's rent.
  let created: { id: string } | null = null;
  let expenseNumber = "";
  for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
    expenseNumber = await nextExpenseNumber(orgId, now);
    try {
      created = await prisma.$transaction(async (tx: TxClient) => {
        const expense = await tx.expense.create({
          data: {
            orgId,
            expenseNumber,
            description: template.description,
            category: template.category,
            amount: template.amount,
            currency: template.currency,
            supplierId: template.supplierId,
            reference,
            notes: template.notes,
            paidAt: null, // Issued as owed — the ledger posts when it is marked paid.
            dueAt: template.nextDueAt,
            createdById: actorUserId,
          },
          select: { id: true },
        });
        await tx.recurringExpense.updateMany({
          where: { id: template.id, orgId },
          data: { nextDueAt, lastIssuedAt: now },
        });
        return expense;
      });
    } catch (error) {
      const dupe = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!dupe || attempt >= 2) throw error;
    }
  }
  if (!created) throw new Error("Could not number the scheduled expense.");

  await writeSystemAuditEvent({
    orgId,
    actorUserId,
    entityType: "Expense",
    entityId: created.id,
    action: "EXPENSE_CREATED",
    summary: `${expenseNumber} — ${template.description} (scheduled, owed)`,
  }).catch(() => {});

  return { issued: true, expenseId: created.id, expenseNumber, nextDueAt };
}
