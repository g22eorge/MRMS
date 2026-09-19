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

import type { Role } from "@prisma/client";
import { can } from "./permissions";

/**
 * Happy-path next step per status: what the primary CTA should do. The raw
 * transition lists lead with side branches (IN_REPAIR leads with
 * WAITING_FOR_PARTS), so pressing the big button diverted away from
 * completion instead of toward it. Alternates still list every option.
 */
export const PRIMARY_NEXT_STATUS: Partial<Record<JobStatus, JobStatus>> = {
  RECEIVED: "DIAGNOSING",
  DIAGNOSING: "IN_REPAIR",
  REFERRED: "AWAITING_APPROVAL",
  PENDING_EXTERNAL_ASSIGNMENT: "IN_EXTERNAL_REPAIR",
  ASSIGNED_ONE_TIME_EXTERNAL: "IN_EXTERNAL_REPAIR",
  IN_EXTERNAL_REPAIR: "AWAITING_APPROVAL",
  WAITING_FOR_PARTS: "IN_REPAIR",
  RETURNED_FROM_EXTERNAL: "IN_REPAIR",
  AWAITING_APPROVAL: "IN_REPAIR",
  IN_REPAIR: "READY_FOR_PICKUP",
  READY_FOR_PICKUP: "COMPLETED",
  DELIVERED: "COMPLETED",
};

/**
 * The primary move from a status, restricted to steps the role may actually
 * take (falls back to the first visible option, then null when terminal).
 */
export function primaryNextStatus(
  fromStatus: JobStatus,
  visibleNext: JobStatus[],
): JobStatus | null {
  const preferred = PRIMARY_NEXT_STATUS[fromStatus];
  if (preferred && visibleNext.includes(preferred)) return preferred;
  return visibleNext[0] ?? null;
}
/**
 * Single source of truth for who may move a job TO a status. Used by the
 * server action (enforcement) and the job page (which buttons to offer), so
 * the two cannot drift: every offered button succeeds, every hidden one
 * would have been rejected.
 *
 * Internal techs can submit for approval and record handover (external
 * techs already could submit estimates) — both were offered by the UI and
 * rejected by the server.
 */
export function canTransitionJobStatus(
  user: { role: Role; permissions?: string[] },
  nextStatus: JobStatus,
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "TECHNICIAN_EXTERNAL") {
    return (["AWAITING_APPROVAL", "RETURNED_FROM_EXTERNAL"] as JobStatus[]).includes(nextStatus);
  }
  if (user.role === "TECHNICIAN_INTERNAL" || can.editDiagnosis(user)) {
    return (
      [
        "DIAGNOSING",
        "REFERRED",
        "PENDING_EXTERNAL_ASSIGNMENT",
        "ASSIGNED_ONE_TIME_EXTERNAL",
        "IN_EXTERNAL_REPAIR",
        "RETURNED_FROM_EXTERNAL",
        "AWAITING_APPROVAL",
        "IN_REPAIR",
        "WAITING_FOR_PARTS",
        "READY_FOR_PICKUP",
        "DELIVERED",
        "COMPLETED",
        "CLOSED",
      ] as JobStatus[]
    ).includes(nextStatus);
  }
  // OPS runs the shop floor: the full chain, so pressing a status always
  // opens the next options until the job completes. (Previously the UI
  // offered steps the server then rejected; now offer and permission match.)
  if (user.role === "OPS" || user.role === "OPERATIONS_MANAGER") {
    return true;
  }
  return false;
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

export function isOpenJobStatus(status: JobStatus | string) {
  return !["COMPLETED", "CLOSED", "DELIVERED"].includes(status);
}

export function isCompletedJobStatus(status: JobStatus | string) {
  return status === "COMPLETED" || status === "DELIVERED";
}

/**
 * Progress-rail stage for a job status: 0 Intake, 1 Diagnosis, 2 Approval,
 * 3 Repair, 4 Complete/Closed.
 *
 * Every status is mapped explicitly. The rail previously listed only six
 * statuses and defaulted everything else to 4, so jobs in the external
 * chain (REFERRED→…→RETURNED_FROM_EXTERNAL) or WAITING_FOR_PARTS showed a
 * full "Complete" bar while the status buttons below correctly offered
 * repair steps — the exact mismatch reported on EIS/2026/0060.
 */
export function jobStageIndex(status: JobStatus | string): number {
  switch (status) {
    case "RECEIVED":
      return 0;
    case "DIAGNOSING":
      return 1;
    case "AWAITING_APPROVAL":
      return 2;
    case "REFERRED":
    case "PENDING_EXTERNAL_ASSIGNMENT":
    case "ASSIGNED_ONE_TIME_EXTERNAL":
    case "IN_EXTERNAL_REPAIR":
    case "RETURNED_FROM_EXTERNAL":
    case "IN_REPAIR":
    case "WAITING_FOR_PARTS":
    case "READY_FOR_PICKUP":
      return 3;
    case "DELIVERED":
    case "COMPLETED":
    case "CLOSED":
      return 4;
    default:
      // Unknown future status: show Repair (work ongoing) rather than
      // Complete — a wrong "ongoing" understates, a wrong "complete" lies.
      return 3;
  }
}
