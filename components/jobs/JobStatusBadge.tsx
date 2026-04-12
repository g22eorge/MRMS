import { JobStatus } from "@/lib/job-status";

const classMap: Record<JobStatus, string> = {
  RECEIVED: "bg-[var(--panel)] text-[var(--ink)]",
  DIAGNOSING: "bg-[var(--panel-strong)] text-[var(--ink)]",
  PENDING_EXTERNAL_ASSIGNMENT: "bg-[var(--panel-strong)] text-[var(--ink)]",
  ASSIGNED_ONE_TIME_EXTERNAL: "bg-black text-white",
  IN_EXTERNAL_REPAIR: "bg-black text-white",
  WAITING_FOR_PARTS: "bg-[#D4AF37] text-white",
  RETURNED_FROM_EXTERNAL: "bg-[#D4AF37] text-white",
  AWAITING_APPROVAL: "bg-[#D4AF37] text-white",
  IN_REPAIR: "bg-black text-white",
  READY_FOR_PICKUP: "bg-[#D4AF37] text-white",
  DELIVERED: "bg-black text-white",
  COMPLETED: "bg-[#D4AF37] text-white",
  CLOSED: "bg-[var(--panel)] text-[var(--ink-muted)]",
};

const helpText: Record<JobStatus, string> = {
  RECEIVED: "Job has been received and is waiting to be worked on.",
  DIAGNOSING: "Technician is diagnosing the issue.",
  PENDING_EXTERNAL_ASSIGNMENT: "Marked for outsourcing. Waiting to assign a one-time external technician.",
  ASSIGNED_ONE_TIME_EXTERNAL: "A one-time external technician has been assigned.",
  IN_EXTERNAL_REPAIR: "Device is currently with a one-time external technician.",
  WAITING_FOR_PARTS: "External repair is waiting on parts.",
  RETURNED_FROM_EXTERNAL: "Device has been returned from the external technician.",
  AWAITING_APPROVAL: "Waiting for client approval before proceeding.",
  IN_REPAIR: "Repair work is actively in progress.",
  READY_FOR_PICKUP: "Repair is done and device is ready for pickup/handover.",
  DELIVERED: "Device has been delivered to the client.",
  COMPLETED: "Repair work finished successfully.",
  CLOSED: "Job ended without successful completion (declined/unrepairable).",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      title={helpText[status]}
      aria-label={`${status.replaceAll("_", " ")}. ${helpText[status]}`}
      className={`rounded-full px-2 py-1 text-xs font-semibold ${classMap[status]}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
