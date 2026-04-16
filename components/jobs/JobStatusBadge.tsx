import { JobStatus, normalizeJobStatus } from "@/lib/job-status";

const classMap: Record<ReturnType<typeof normalizeJobStatus>, string> = {
  RECEIVED: "bg-[var(--panel)] text-[var(--ink)]",
  DIAGNOSING: "bg-[var(--panel-strong)] text-[var(--ink)]",
  IN_EXTERNAL_REPAIR: "bg-black text-white",
  AWAITING_APPROVAL: "bg-[#D4AF37] text-white",
  IN_REPAIR: "bg-black text-white",
  READY_FOR_PICKUP: "bg-[#D4AF37] text-white",
  COMPLETED: "bg-[#D4AF37] text-white",
  CLOSED: "bg-[var(--panel)] text-[var(--ink-muted)]",
};

const helpText: Record<ReturnType<typeof normalizeJobStatus>, string> = {
  RECEIVED: "Job has been received and is waiting to be worked on.",
  DIAGNOSING: "Technician is diagnosing the issue.",
  IN_EXTERNAL_REPAIR: "Device is currently with a one-time external technician.",
  AWAITING_APPROVAL: "Waiting for client approval before proceeding.",
  IN_REPAIR: "Repair work is actively in progress.",
  READY_FOR_PICKUP: "Repair is done and device is ready for pickup/handover.",
  COMPLETED: "Repair work finished successfully.",
  CLOSED: "Job ended without successful completion (declined/unrepairable).",
};

const labelMap: Record<ReturnType<typeof normalizeJobStatus>, string> = {
  RECEIVED: "Received",
  DIAGNOSING: "Diagnosing",
  IN_EXTERNAL_REPAIR: "External",
  AWAITING_APPROVAL: "Awaiting",
  IN_REPAIR: "In Repair",
  READY_FOR_PICKUP: "Ready",
  COMPLETED: "Completed",
  CLOSED: "Closed",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const normalized = normalizeJobStatus(status);
  return (
    <span
      title={helpText[normalized]}
      aria-label={`${normalized.replaceAll("_", " ")}. ${helpText[normalized]}`}
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${classMap[normalized]}`}
    >
      {labelMap[normalized]}
    </span>
  );
}
