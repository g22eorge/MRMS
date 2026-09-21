import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { resolveTechCost } from "@/lib/billing";
import { rowToBase } from "@/lib/currency";
import { getTechnicianPayoutTotalsByJobIds } from "@/lib/payouts";
import { can } from "@/lib/permissions";
import { issueRecurringExpense } from "@/lib/commercial/recurring-expenses";

export type PayablesCronOutcome = {
  orgId: string;
  issued: number;
  skipped: number;
  digestSent: boolean;
  digestTo: number;
};

const FINANCE_ROLES: Role[] = ["ADMIN", "MANAGER", "FINANCE", "OPS", "OPERATIONS_MANAGER"];

/**
 * Daily payables run for one org: issue due recurring-expense templates as
 * UNPAID rows, then nudge finance staff once if anything is overdue or due
 * within 7 days. Re-runs are safe: issuing is idempotent per (template,
 * period) and the digest is one unread note per user per day.
 */
export async function runPayablesForOrg(orgId: string, now = new Date()): Promise<PayablesCronOutcome> {
  const outcome: PayablesCronOutcome = { orgId, issued: 0, skipped: 0, digestSent: false, digestTo: 0 };

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, baseCurrency: true },
  });
  if (!org) return outcome;
  const baseCurrency = org.baseCurrency ?? "UGX";

  // An actor is required on created rows — the org's earliest admin, else the
  // earliest active finance user. No actor, no issuing (digest still runs).
  const actor =
    (await prisma.user.findFirst({ where: { orgId, role: "ADMIN", isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } })) ??
    (await prisma.user.findFirst({ where: { orgId, isActive: true, role: { in: FINANCE_ROLES } }, orderBy: { createdAt: "asc" }, select: { id: true } }));

  const dueTemplates = await prisma.recurringExpense.findMany({
    where: { orgId, isActive: true, autoIssue: true, nextDueAt: { lte: now } },
    select: { id: true },
  });
  for (const t of dueTemplates) {
    try {
      if (!actor) {
        outcome.skipped += 1;
        continue;
      }
      const res = await issueRecurringExpense(orgId, t.id, actor.id, now);
      if (res.issued) outcome.issued += 1;
      else outcome.skipped += 1;
    } catch (error) {
      console.error(`[payables] issue template ${t.id} failed:`, error);
      outcome.skipped += 1;
    }
  }

  // ── Digest: what needs money in the next 7 days (or is already late) ──────
  const weekOut = new Date(now.getTime() + 7 * 86_400_000);
  const [dueBills, openExpenses, techJobs] = await Promise.all([
    prisma.supplierBill.findMany({
      where: { orgId, status: { in: ["POSTED", "PART_PAID"] }, OR: [{ dueAt: null }, { dueAt: { lte: weekOut } }] },
      select: { totalAmount: true, paidAmount: true, currency: true, exchangeRateToBase: true, dueAt: true },
      take: 500,
    }).catch(() => []),
    prisma.expense.findMany({
      where: { orgId, paidAt: null, OR: [{ dueAt: null }, { dueAt: { lte: weekOut } }] },
      select: { amount: true, currency: true, exchangeRateToBase: true, dueAt: true, createdAt: true },
      take: 500,
    }).catch(() => []),
    prisma.job.findMany({
      where: { orgId, repairPath: "EXTERNAL", externalPaid: false, status: { in: ["READY_FOR_PICKUP", "COMPLETED", "DELIVERED"] } },
      select: { id: true, externalTechFee: true, externalTechBill: true },
      take: 500,
    }).catch(() => []),
  ]);
  const toBase = (amount: number, curr?: string | null, rate?: number | null) =>
    rowToBase({ amount, currency: curr ?? baseCurrency, exchangeRateToBase: rate ?? null }, baseCurrency);
  const billsBase = dueBills.reduce((s, b) => s + toBase(b.totalAmount - b.paidAmount, b.currency, b.exchangeRateToBase), 0);
  const expensesBase = openExpenses.reduce((s, e) => s + toBase(e.amount, e.currency, e.exchangeRateToBase), 0);
  const payoutTotals = await getTechnicianPayoutTotalsByJobIds(techJobs.map((j) => j.id), orgId).catch(() => new Map());
  const techBase = techJobs.reduce((s, j) => {
    const paid = (payoutTotals as Map<string, { paidAmount: number }>).get(j.id)?.paidAmount ?? 0;
    return s + Math.max(0, resolveTechCost(j.externalTechFee, j.externalTechBill) - paid);
  }, 0);
  const overdueBills = dueBills.filter((b) => b.dueAt && b.dueAt.getTime() < now.getTime()).length;
  const openCount = dueBills.length + openExpenses.length + techJobs.length;
  if (openCount === 0) return outcome;

  const parts = [
    dueBills.length > 0 ? `${dueBills.length} bill${dueBills.length !== 1 ? "s" : ""}` : null,
    openExpenses.length > 0 ? `${openExpenses.length} open expense${openExpenses.length !== 1 ? "s" : ""}` : null,
    techJobs.length > 0 ? `${techJobs.length} tech payout${techJobs.length !== 1 ? "s" : ""}` : null,
  ].filter(Boolean) as string[];
  const total = billsBase + expensesBase + techBase;
  const title = overdueBills > 0
    ? `${overdueBills} overdue payable${overdueBills !== 1 ? "s" : ""} need money`
    : "Payables due in the next 7 days";
  const message = `${parts.join(" · ")} ≈ ${baseCurrency} ${Math.round(total).toLocaleString()} open. See Payables.`;

  const recipients = await prisma.user.findMany({
    where: { orgId, isActive: true, role: { in: FINANCE_ROLES } },
    select: { id: true, role: true, permissionGrants: { select: { permission: true } } },
  });
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  for (const u of recipients) {
    if (!can.viewFinancials({ role: u.role, permissions: u.permissionGrants.map((g) => g.permission) })) continue;
    const already = await prisma.notification.findFirst({
      where: { orgId, userId: u.id, type: "PAYABLE_DUE", isRead: false, createdAt: { gte: startOfDay } },
      select: { id: true },
    }).catch(() => null);
    if (already) continue;
    await prisma.notification.create({
      data: { orgId, userId: u.id, type: "PAYABLE_DUE", title, message, channel: "DASHBOARD" },
    }).catch(() => {});
    outcome.digestTo += 1;
  }
  outcome.digestSent = outcome.digestTo > 0;
  return outcome;
}
