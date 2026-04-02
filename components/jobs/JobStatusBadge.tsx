import { JobStatus } from "@prisma/client";

const classMap: Record<JobStatus, string> = {
  RECEIVED: "bg-slate-100 text-slate-700",
  DIAGNOSING: "bg-amber-100 text-amber-800",
  REFERRED: "bg-cyan-100 text-cyan-800",
  AWAITING_APPROVAL: "bg-orange-100 text-orange-800",
  IN_REPAIR: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-rose-100 text-rose-800",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classMap[status]}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
