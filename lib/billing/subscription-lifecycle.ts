import { prisma } from "@/lib/prisma";
import { TRIAL_REMINDER_DAYS } from "@/lib/billing-access";
import { sendTrialExpiryWarning, sendPaymentFailedAlert } from "@/lib/email";
import { createNotificationsForRole } from "@/lib/notifications";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";

const DAY_MS = 86_400_000;
const REMINDER_DAYS = TRIAL_REMINDER_DAYS as readonly number[];

export type SubscriptionLifecycleResult = { remindersSent: number; markedPastDue: number };

/**
 * Subscription lifecycle sweep (run daily by the cron). Two jobs:
 *  1. Trial reminders at 14/7/3/1 days remaining — dashboard notification +
 *     email to org admins. Idempotent: a per-threshold SystemAuditEvent guards
 *     against re-sending if the sweep runs more than once a day.
 *  2. Renewal lapse — an ACTIVE org whose planRenewsAt has passed is flipped to
 *     PAST_DUE, which the existing assertOrgCanMutate gate already enforces as
 *     read-only. (Previously PAST_DUE was never written, so the branch was dead.)
 */
export async function runSubscriptionLifecycle(now: Date = new Date()): Promise<SubscriptionLifecycleResult> {
  const result: SubscriptionLifecycleResult = { remindersSent: 0, markedPastDue: 0 };

  // ── 1. Trial reminders ────────────────────────────────────────────────────
  const trialing = await prisma.organization.findMany({
    where: { billingStatus: "TRIALING", trialEndsAt: { gt: now } },
    select: { id: true, name: true, trialEndsAt: true },
  });

  for (const org of trialing) {
    if (!org.trialEndsAt) continue;
    const daysLeft = Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / DAY_MS);
    if (!REMINDER_DAYS.includes(daysLeft)) continue;

    const action = `TRIAL_REMINDER_${daysLeft}D`;
    const already = await prisma.systemAuditEvent.findFirst({
      where: { orgId: org.id, entityId: org.id, action },
      select: { id: true },
    });
    if (already) continue;

    await createNotificationsForRole({
      orgId: org.id,
      type: "BILLING",
      title: `Trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      message: `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Subscribe to keep full access to your workspace.`,
      roles: ["ADMIN", "OPS"],
    }).catch(() => {});

    const admins = await prisma.user.findMany({
      where: { orgId: org.id, role: "ADMIN", isActive: true },
      select: { email: true, name: true },
    });
    for (const admin of admins) {
      void sendTrialExpiryWarning(admin.email, admin.name, org.name, daysLeft);
    }

    await writeSystemAuditEvent({
      orgId: org.id,
      entityType: "Organization",
      entityId: org.id,
      action,
      summary: `Trial reminder sent — ${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`,
    });
    result.remindersSent++;
  }

  // ── 2. Renewal lapse → PAST_DUE ───────────────────────────────────────────
  const lapsed = await prisma.organization.findMany({
    where: { billingStatus: "ACTIVE", planRenewsAt: { lt: now } },
    select: { id: true, name: true },
  });

  for (const org of lapsed) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { billingStatus: "PAST_DUE" },
    });

    await createNotificationsForRole({
      orgId: org.id,
      type: "BILLING",
      title: "Payment overdue",
      message: "Your subscription renewal is overdue. The workspace is read-only until billing is restored.",
      roles: ["ADMIN", "OPS"],
    }).catch(() => {});

    const admins = await prisma.user.findMany({
      where: { orgId: org.id, role: "ADMIN", isActive: true },
      select: { email: true, name: true },
    });
    for (const admin of admins) {
      void sendPaymentFailedAlert(admin.email, admin.name, org.name);
    }

    await writeSystemAuditEvent({
      orgId: org.id,
      entityType: "Organization",
      entityId: org.id,
      action: "BILLING_PAST_DUE",
      summary: "Renewal lapsed — workspace set to PAST_DUE (read-only)",
    });
    result.markedPastDue++;
  }

  return result;
}
