import { JobStatus } from "@/lib/job-status";

const classMap: Record<JobStatus, string> = {
  RECEIVED: "bg-slate-100 text-slate-700",
  DIAGNOSING: "bg-amber-100 text-amber-800",
  AWAITING_APPROVAL: "bg-orange-100 text-orange-800",
  IN_REPAIR: "bg-blue-100 text-blue-800",
  READY_FOR_PICKUP: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-rose-100 text-rose-800",
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
