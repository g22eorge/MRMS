import type { OrgBillingStatus, OrgPlan } from "@prisma/client";

/** Length of the free trial granted to every new organization, in days. */
export const TRIAL_DAYS = 30;

/** Days-remaining thresholds at which the org admin is reminded the trial is ending. */
export const TRIAL_REMINDER_DAYS = [14, 7, 3, 1] as const;

export type OrgBillingSnapshot = {
  plan: OrgPlan;
  billingStatus: OrgBillingStatus;
  trialEndsAt: Date | null;
  planRenewsAt: Date | null;
  planCancelledAt: Date | null;
  /** Operator kill-switch. Optional so older callers keep compiling. */
  isActive?: boolean;
};

export type OrgAccess = {
  isSuspended: boolean;
  reason: "INACTIVE" | "TRIAL_EXPIRED" | "PAST_DUE" | "CANCELLED" | null;
};

export function getOrgAccess(org: OrgBillingSnapshot | null): OrgAccess {
  if (!org) return { isSuspended: false, reason: null };
  const now = new Date();

  // Operator deactivation outranks every billing state — an org switched off by
  // the platform admin is read-only regardless of plan (yes, even ENTERPRISE).
  // Organization.isActive existed but was consulted nowhere, so a deactivated
  // workspace kept full read/write access.
  if (org.isActive === false) return { isSuspended: true, reason: "INACTIVE" };

  const trialExpired =
    org.billingStatus === "TRIALING" &&
    org.trialEndsAt != null &&
    org.trialEndsAt < now;

  if (trialExpired) return { isSuspended: true, reason: "TRIAL_EXPIRED" };
  if (org.billingStatus === "PAST_DUE") return { isSuspended: true, reason: "PAST_DUE" };

  // Cancelled should remain usable until the period ends. After that we treat it as suspended
  // (layout may downgrade it separately).
  if (org.billingStatus === "CANCELLED" && org.planRenewsAt && org.planRenewsAt < now) {
    return { isSuspended: true, reason: "CANCELLED" };
  }

  return { isSuspended: false, reason: null };
}

export function suspensionMessage(access: OrgAccess) {
  if (!access.isSuspended) return null;
  if (access.reason === "INACTIVE") return "This workspace has been deactivated. Contact support to reactivate it.";
  if (access.reason === "TRIAL_EXPIRED") return "Your trial has ended. This workspace is read-only until you upgrade.";
  if (access.reason === "PAST_DUE") return "Payment is overdue. This workspace is read-only until billing is restored.";
  if (access.reason === "CANCELLED") return "Subscription ended. This workspace is read-only until billing is restored.";
  return "This workspace is read-only.";
}

export function canRecordPaymentsWhenSuspended(role: string) {
  return role === "ADMIN";
}
