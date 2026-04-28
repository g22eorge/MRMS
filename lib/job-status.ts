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

export type JobStatus = (typeof JOB_STATUSES)[number];
export type UiJobStatus = (typeof UI_JOB_STATUSES)[number];

// In production it is possible for the running Prisma Client to be temporarily
// out of sync with code (e.g. a deployment where Prisma Client wasn't regenerated).
// Guard enum-valued queries by filtering to values the runtime client supports.
export function filterSupportedJobStatuses<T extends string>(values: readonly T[]) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Prisma } = require("@prisma/client") as typeof import("@prisma/client");
    const jobStatusEnum = Prisma.dmmf.datamodel.enums.find((e) => e.name === "JobStatus");
    const allowed = new Set((jobStatusEnum?.values ?? []).map((v) => v.name));
    return values.filter((value) => allowed.has(value));
  } catch {
    return [...values];
  }
}

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
