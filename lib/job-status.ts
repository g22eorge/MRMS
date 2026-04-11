export const JOB_STATUSES = [
  "RECEIVED",
  "DIAGNOSING",
  "AWAITING_APPROVAL",
  "IN_REPAIR",
  "READY_FOR_PICKUP",
  "DELIVERED",
  "COMPLETED",
  "CLOSED",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
