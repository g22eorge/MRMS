// Full set as stored in the database (keep for typing and legacy data).
export const JOB_STATUSES = [
  "RECEIVED",
  "DIAGNOSING",
  "REFERRED",
  "PENDING_EXTERNAL_ASSIGNMENT",
  "ASSIGNED_ONE_TIME_EXTERNAL",
  "IN_EXTERNAL_REPAIR",
  "WAITING_FOR_PARTS",
  "RETURNED_FROM_EXTERNAL",
  "AWAITING_APPROVAL",
  "IN_REPAIR",
  "READY_FOR_PICKUP",
  "DELIVERED",
  "COMPLETED",
  "CLOSED",
] as const;

// Reduced set for UI filters and primary workflow display.
export const UI_JOB_STATUSES = [
  "RECEIVED",
  "DIAGNOSING",
  "REFERRED",
  "AWAITING_APPROVAL",
  "IN_REPAIR",
  "READY_FOR_PICKUP",
  "COMPLETED",
  "CLOSED",
] as const;

/**
 * A job that is still work — open on the bench, not yet handed back.
 *
 * There were three definitions of this and they disagreed. The dashboard's
 * "Active" tile counted three statuses, the queries beside it counted seven,
 * and the client portal counted six. So the tile understated the shop's own
 * workload by omitting diagnosis, referral, external repair and awaiting
 * collection, and a client whose device had gone to an external repairer
 * watched it drop out of their active list altogether — the job had not
 * stalled, the definition had.
 *
 * Deliberately excludes DELIVERED, COMPLETED and CLOSED: those are finished,
 * whatever remains to be invoiced. The legacy external-assignment states are
 * excluded too, since normalizeJobStatus folds them into IN_EXTERNAL_REPAIR
 * before anything counts them.
 */
export const ACTIVE_JOB_STATUSES = [
  "RECEIVED",
  "DIAGNOSING",
  "REFERRED",
  "IN_EXTERNAL_REPAIR",
  "AWAITING_APPROVAL",
  "IN_REPAIR",
  "READY_FOR_PICKUP",
] as const;

/**
 * Active, minus the jobs too new to have earned a client update.
 *
 * A job received an hour ago has not been neglected. Derived rather than
 * retyped, so the two lists cannot drift the way the three above did.
 */
export const ACTIVE_STATUSES_EXPECTING_CONTACT = ACTIVE_JOB_STATUSES.filter(
  (s) => s !== "RECEIVED",
);

export type JobStatus = (typeof JOB_STATUSES)[number];
export type UiJobStatus = (typeof UI_JOB_STATUSES)[number];

export function normalizeJobStatus(status: JobStatus): UiJobStatus {
  // Legacy external assignment states now surface as a single UI stage.
  if (status === "PENDING_EXTERNAL_ASSIGNMENT" || status === "ASSIGNED_ONE_TIME_EXTERNAL") {
    return "REFERRED";
  }

  // Legacy external progress states are treated as active repair in the simplified UI.
  if (status === "IN_EXTERNAL_REPAIR" || status === "WAITING_FOR_PARTS" || status === "RETURNED_FROM_EXTERNAL") {
    return "IN_REPAIR";
  }

  if (status === "DELIVERED") {
    return "COMPLETED";
  }

  if (UI_JOB_STATUSES.includes(status as UiJobStatus)) {
    return status as UiJobStatus;
  }

  // Fallback for any unknown/added statuses.
  return "DIAGNOSING";
}

export function isOpenJobStatus(status: JobStatus | string) {
  return !["COMPLETED", "CLOSED", "DELIVERED"].includes(status);
}

export function isCompletedJobStatus(status: JobStatus | string) {
  return status === "COMPLETED" || status === "DELIVERED";
}
