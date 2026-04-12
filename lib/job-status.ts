// Full set as stored in the database (keep for typing and legacy data).
export const JOB_STATUSES = [
  "RECEIVED",
  "DIAGNOSING",
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
  "IN_EXTERNAL_REPAIR",
  "AWAITING_APPROVAL",
  "IN_REPAIR",
  "READY_FOR_PICKUP",
  "COMPLETED",
  "CLOSED",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
export type UiJobStatus = (typeof UI_JOB_STATUSES)[number];

export function normalizeJobStatus(status: JobStatus): UiJobStatus {
  if (
    status === "PENDING_EXTERNAL_ASSIGNMENT" ||
    status === "ASSIGNED_ONE_TIME_EXTERNAL" ||
    status === "WAITING_FOR_PARTS" ||
    status === "RETURNED_FROM_EXTERNAL"
  ) {
    return "IN_EXTERNAL_REPAIR";
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
