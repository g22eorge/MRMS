import { JobStatus } from "@/lib/job-status";

const classMap: Record<JobStatus, string> = {
  RECEIVED: "bg-slate-100 text-slate-700",
  DIAGNOSING: "bg-slate-300 text-slate-800",
  AWAITING_APPROVAL: "bg-[#D4AF37] text-white",
  IN_REPAIR: "bg-black text-white",
  READY_FOR_PICKUP: "bg-[#D4AF37] text-white",
  COMPLETED: "bg-[#D4AF37] text-white",
  CLOSED: "bg-slate-200 text-slate-500",
};

const helpText: Record<JobStatus, string> = {
  RECEIVED: "Job has been received and is waiting to be worked on.",
  DIAGNOSING: "Technician is diagnosing the issue.",
  AWAITING_APPROVAL: "Waiting for client approval before proceeding.",
  IN_REPAIR: "Repair work is actively in progress.",
  READY_FOR_PICKUP: "Repair is done and device is ready for pickup/handover.",
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
