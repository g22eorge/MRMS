import Link from "next/link";
import { Role } from "@prisma/client";

import { ProgressiveList } from "@/components/mobile/ProgressiveList";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { formatMoney } from "@/lib/currency";
import { JobStatus } from "@/lib/job-status";

export type JobRow = {
  id: string;
  jobNumber: string;
  status: JobStatus;
  deviceType: string;
  brand: string;
  model: string;
  clientName?: string;
  assignedTo?: string;
  receivedAt: Date;
  externalTechBill?: number | null;
  workflowReason?: WorkflowReason | null;
};

type WorkflowReason =
  | "NONE"
  | "PARTS_PENDING"
  | "SPECIALIST_ESCALATION"
  | "CLIENT_DECLINED"
  | "UNREPAIRABLE"
  | "CUSTOMER_CANCELLED"
  | "OTHER";

type HighlightReason = Exclude<WorkflowReason, "NONE">;

const workflowReasonTone: Record<HighlightReason, string> = {
  PARTS_PENDING: "bg-amber-100 text-amber-800",
  SPECIALIST_ESCALATION: "bg-cyan-100 text-cyan-800",
  CLIENT_DECLINED: "bg-rose-100 text-rose-800",
  UNREPAIRABLE: "bg-red-100 text-red-800",
  CUSTOMER_CANCELLED: "bg-zinc-200 text-zinc-800",
  OTHER: "bg-slate-100 text-slate-700",
};

function workflowReasonLabel(reason: HighlightReason) {
  return reason.replaceAll("_", " ");
}

export function JobTable({
  jobs,
  role,
  canDelete,
  deleteAction,
  returnTo,
}: {
  jobs: JobRow[];
  role: Role;
  canDelete?: boolean;
  deleteAction?: (formData: FormData) => Promise<void>;
  returnTo?: string;
}) {
  const canSeeClient = role !== "TECHNICIAN_EXTERNAL";
  const canSeeCost = role === "ADMIN" || role === "OPS";
  const canSeeAssignment = role === "ADMIN" || role === "OPS";
  const canEditPage = role !== "TECHNICIAN_EXTERNAL";

  return (
    <div className="panel-shadow overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="space-y-3 p-3 sm:hidden">
        <ProgressiveList initialCount={4} step={6}>
          {jobs.map((job) => (
            <details key={job.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-3 max-[360px]:p-2.5">
              <summary className="list-none">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="mono truncate text-sm font-semibold">{job.jobNumber}</p>
                    <p className="mt-1 truncate text-sm font-medium text-[var(--ink)]">{job.brand} {job.model}</p>
                    <p className="truncate text-xs uppercase tracking-[0.12em] text-[var(--ink-muted)]">{job.deviceType.replaceAll("_", " ")}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
                      {canSeeAssignment ? (
                        <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-white px-2 py-0.5">
                          Assigned: {job.assignedTo ?? "-"}
                        </span>
                      ) : null}
                      {canSeeClient ? (
                        <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-white px-2 py-0.5">
                          Client: {job.clientName ?? "-"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <JobStatusBadge status={job.status} />
                    <p className="mt-1 text-[11px] text-[var(--ink-muted)]">{job.receivedAt.toLocaleDateString()}</p>
                    {canSeeCost ? (
                      <p className="mt-1 text-[11px] font-semibold text-[var(--ink)]">
                        {job.externalTechBill ? formatMoney(job.externalTechBill) : "UGX -"}
                      </p>
                    ) : null}
                  </div>
                </div>
              </summary>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {canSeeClient ? (
                <div>
                  <p className="text-[var(--ink-muted)]">Client</p>
                  <p className="truncate font-medium text-[var(--ink)]">{job.clientName ?? "-"}</p>
                </div>
              ) : null}
              {canSeeAssignment ? (
                <div>
                  <p className="text-[var(--ink-muted)]">Assigned</p>
                  <p className="truncate font-medium text-[var(--ink)]">{job.assignedTo ?? "-"}</p>
                </div>
              ) : null}
              {job.workflowReason && job.workflowReason !== "NONE" ? (
                <div className="col-span-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${workflowReasonTone[job.workflowReason]}`}>
                    {workflowReasonLabel(job.workflowReason)}
                  </span>
                </div>
              ) : null}
              {canSeeCost ? (
                <div>
                  <p className="text-[var(--ink-muted)]">External Bill</p>
                  <p className="font-medium text-[var(--ink)]">{job.externalTechBill ? formatMoney(job.externalTechBill) : "UGX -"}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex gap-2">
              <Link
                href={`/jobs/${job.id}`}
                className="btn-premium flex-1 rounded-md px-3 py-1.5 text-center text-[13px] font-medium sm:py-2 sm:text-sm"
              >
                Open
              </Link>
              {canEditPage ? (
                <Link
                  href={`/jobs/${job.id}/edit${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
                  className="btn-premium-secondary flex-1 rounded-md px-3 py-1.5 text-center text-[13px] font-medium sm:py-2 sm:text-sm"
                >
                  Edit
                </Link>
              ) : null}
              {canDelete && deleteAction ? (
                <form action={deleteAction} className="flex-1">
                  <input type="hidden" name="id" value={job.id} />
                  <button className="btn-premium-danger w-full rounded-md px-3 py-1.5 text-[13px] font-medium sm:py-2 sm:text-sm">
                    Delete
                  </button>
                </form>
              ) : null}
            </div>
            </details>
          ))}
        </ProgressiveList>
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-[1080px] w-full border-collapse text-sm">
        <thead className="bg-[var(--panel-strong)] text-left text-[11px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
          <tr>
            <th className="border-b border-[var(--line)] px-4 py-3">Job #</th>
            <th className="border-b border-[var(--line)] px-4 py-3">Device</th>
            <th className="border-b border-[var(--line)] px-4 py-3">Status</th>
            {canSeeClient ? <th className="border-b border-[var(--line)] px-4 py-3">Client</th> : null}
            {canSeeAssignment ? <th className="border-b border-[var(--line)] px-4 py-3">Assigned</th> : null}
            <th className="border-b border-[var(--line)] px-4 py-3">Flag</th>
            <th className="border-b border-[var(--line)] px-4 py-3">Received</th>
            {canSeeCost ? <th className="border-b border-[var(--line)] px-4 py-3">External Bill</th> : null}
            <th className="border-b border-[var(--line)] px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="transition hover:bg-[var(--panel-strong)]/60">
              <td className="border-b border-[var(--line)] px-4 py-3 align-middle font-semibold">
                <p className="mono max-w-[12rem] truncate">{job.jobNumber}</p>
              </td>
              <td className="border-b border-[var(--line)] px-4 py-3 align-middle">
                <p className="max-w-[20rem] truncate font-medium text-[var(--ink)]">
                  {job.brand} {job.model} <span className="text-xs text-[var(--ink-muted)]">- {job.deviceType.replaceAll("_", " ")}</span>
                </p>
              </td>
              <td className="border-b border-[var(--line)] px-4 py-3 align-middle"><JobStatusBadge status={job.status} /></td>
              {canSeeClient ? <td className="border-b border-[var(--line)] px-4 py-3 align-middle"><p className="max-w-[14rem] truncate">{job.clientName ?? "-"}</p></td> : null}
              {canSeeAssignment ? <td className="border-b border-[var(--line)] px-4 py-3 align-middle"><p className="max-w-[14rem] truncate">{job.assignedTo ?? "-"}</p></td> : null}
              <td className="border-b border-[var(--line)] px-4 py-3 align-middle">
                {job.workflowReason && job.workflowReason !== "NONE" ? (
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${workflowReasonTone[job.workflowReason]}`}>
                    {workflowReasonLabel(job.workflowReason)}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--ink-muted)]">-</span>
                )}
              </td>
              <td className="border-b border-[var(--line)] px-4 py-3 align-middle whitespace-nowrap">{job.receivedAt.toLocaleDateString()}</td>
              {canSeeCost ? <td className="border-b border-[var(--line)] px-4 py-3 align-middle whitespace-nowrap">{job.externalTechBill ? formatMoney(job.externalTechBill) : "-"}</td> : null}
              <td className="border-b border-[var(--line)] px-4 py-3 align-middle whitespace-nowrap">
                <div className="inline-flex items-center gap-2">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="btn-premium inline-block rounded-md px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm"
                  >
                    Open
                  </Link>
                  {canEditPage ? (
                    <Link
                      href={`/jobs/${job.id}/edit${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
                      className="btn-premium-secondary inline-block rounded-md px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm"
                    >
                      Edit
                    </Link>
                  ) : null}
                  {canDelete && deleteAction ? (
                    <form action={deleteAction} className="inline">
                      <input type="hidden" name="id" value={job.id} />
                      <button className="btn-premium-danger rounded-md px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm">Delete</button>
                    </form>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}
