import Link from "next/link";
import { Role } from "@prisma/client";

import { ProgressiveList } from "@/components/mobile/ProgressiveList";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { formatMoney } from "@/lib/currency";
import { formatEATDate } from "@/lib/date-eat";
import { JobStatus } from "@/lib/job-status";
import { can } from "@/lib/permissions";

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
  clientBill?: number | null;
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
  PARTS_PENDING: "bg-[#D4AF37]/20 text-[#D4AF37]",
  SPECIALIST_ESCALATION: "bg-[#D4AF37] text-white",
  CLIENT_DECLINED: "bg-black text-white",
  UNREPAIRABLE: "bg-black text-white",
  CUSTOMER_CANCELLED: "bg-[var(--panel-strong)] text-[var(--ink-muted)]",
  OTHER: "bg-[var(--panel-strong)] text-[var(--ink)]",
};

function workflowReasonLabel(reason: HighlightReason) {
  return reason.replaceAll("_", " ");
}

export function JobTable({
  jobs,
  role,
  permissions = [],
  canDelete,
  deleteAction,
  returnTo,
}: {
  jobs: JobRow[];
  role: Role;
  permissions?: string[];
  canDelete?: boolean;
  deleteAction?: (formData: FormData) => Promise<void>;
  returnTo?: string;
}) {
  const permissionUser = { role, permissions };
  const canSeeClient = role !== "TECHNICIAN_EXTERNAL";
  const canSeeCost =
    can.viewApprovedCost(permissionUser)
    || can.reviewExternalBills(permissionUser)
    || can.approveInvoices(permissionUser);
  const canSeeAssignment = can.assignJobs(permissionUser) || role === "ADMIN" || role === "OPS";
  const canEditPage = role !== "TECHNICIAN_EXTERNAL" && !can.createJob(permissionUser);
  const canManagePricing = can.approveInvoices(permissionUser);
  const showClientFacingCostOnly =
    (can.viewApprovedCost(permissionUser) || canManagePricing)
    && !can.reviewExternalBills(permissionUser);

  return (
    <div className="panel-shadow overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[linear-gradient(180deg,rgba(212,175,55,0.1),rgba(245,245,245,0.9))] px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Job Results</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-[var(--ink-muted)]">{jobs.length} in this page</p>
          {jobs.length > 0 ? (
            <Link href={`/jobs/${jobs[0].id}`} className="btn-premium-secondary rounded-lg px-2 py-1 text-[11px]">
              Open
            </Link>
          ) : null}
        </div>
      </div>
      <div className="space-y-3 p-3 2xl:hidden">
        <ProgressiveList initialCount={4} step={6}>
          {jobs.map((job) => (
            <details key={job.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-3 transition hover:border-[#D4AF37]/50 hover:bg-white max-[360px]:p-2.5">
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
                    <p className="mt-1 text-[11px] text-[var(--ink-muted)]">{formatEATDate(job.receivedAt)}</p>
                    {canSeeCost ? (
                      <p className="mt-1 text-[11px] font-semibold text-[var(--ink)]">
                        {showClientFacingCostOnly
                          ? job.clientBill && ["READY_FOR_PICKUP", "DELIVERED", "COMPLETED", "CLOSED"].includes(job.status)
                            ? formatMoney(job.clientBill)
                            : "Pending final"
                          : job.externalTechBill
                            ? formatMoney(job.externalTechBill)
                            : "UGX -"}
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
              {canManagePricing ? (
                <div className="col-span-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      typeof job.clientBill === "number"
                        ? "bg-[#D4AF37]/20 text-[#D4AF37]"
                        : ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"].includes(job.status)
                          ? "bg-[#D4AF37]/20 text-[#D4AF37]"
                          : "bg-[var(--panel-strong)] text-[var(--ink)]"
                    }`}
                  >
                    {typeof job.clientBill === "number"
                      ? "Priced"
                      : ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"].includes(job.status)
                        ? "Needs pricing"
                        : "Pricing n/a"}
                  </span>
                </div>
              ) : null}
              {canSeeCost ? (
                <div>
                  <p className="text-[var(--ink-muted)]">{showClientFacingCostOnly ? "Client Cost" : "External Bill"}</p>
                  <p className="font-medium text-[var(--ink)]">
                    {showClientFacingCostOnly
                      ? job.clientBill && ["READY_FOR_PICKUP", "DELIVERED", "COMPLETED", "CLOSED"].includes(job.status)
                        ? formatMoney(job.clientBill)
                        : "Pending final"
                      : job.externalTechBill
                        ? formatMoney(job.externalTechBill)
                        : "UGX -"}
                  </p>
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

      <div className="hidden overflow-x-auto 2xl:block">
        <table className="min-w-[1080px] w-full border-collapse text-sm">
        <thead className="bg-[linear-gradient(180deg,rgba(212,175,55,0.1),rgba(240,240,240,0.95))] text-left text-[11px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
          <tr>
            <th className="border-b border-[var(--line)] px-4 py-3">Job #</th>
            <th className="border-b border-[var(--line)] px-4 py-3">Device</th>
            <th className="border-b border-[var(--line)] px-4 py-3">Status</th>
            {canSeeClient ? <th className="border-b border-[var(--line)] px-4 py-3">Client</th> : null}
            {canSeeAssignment ? <th className="border-b border-[var(--line)] px-4 py-3">Assigned</th> : null}
            <th className="border-b border-[var(--line)] px-4 py-3">Flag</th>
            <th className="border-b border-[var(--line)] px-4 py-3">Received</th>
            {canSeeCost ? <th className="border-b border-[var(--line)] px-4 py-3">{showClientFacingCostOnly ? "Client Cost" : "External Bill"}</th> : null}
            <th className="border-b border-[var(--line)] px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="transition even:bg-[var(--panel-strong)]/35 hover:bg-[var(--panel-strong)]/75">
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
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${workflowReasonTone[job.workflowReason]}`}>
                      {workflowReasonLabel(job.workflowReason)}
                    </span>
                    {canManagePricing ? (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          typeof job.clientBill === "number"
                            ? "bg-[#D4AF37]/20 text-[#D4AF37]"
                            : ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"].includes(job.status)
                              ? "bg-[#D4AF37]/20 text-[#D4AF37]"
                              : "bg-[var(--panel-strong)] text-[var(--ink)]"
                        }`}
                      >
                        {typeof job.clientBill === "number"
                          ? "Priced"
                          : ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"].includes(job.status)
                            ? "Needs pricing"
                            : "Pricing n/a"}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-[var(--ink-muted)]">
                    {canManagePricing
                      ? typeof job.clientBill === "number"
                        ? "Priced"
                        : ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"].includes(job.status)
                          ? "Needs pricing"
                          : "-"
                      : "-"}
                  </span>
                )}
              </td>
              <td className="border-b border-[var(--line)] px-4 py-3 align-middle whitespace-nowrap">{formatEATDate(job.receivedAt)}</td>
              {canSeeCost ? (
                <td className="border-b border-[var(--line)] px-4 py-3 align-middle whitespace-nowrap">
                  {showClientFacingCostOnly
                    ? job.clientBill && ["READY_FOR_PICKUP", "COMPLETED", "CLOSED"].includes(job.status)
                      ? formatMoney(job.clientBill)
                      : "Pending final"
                    : job.externalTechBill
                      ? formatMoney(job.externalTechBill)
                      : "-"}
                </td>
              ) : null}
              <td className="border-b border-[var(--line)] px-4 py-3 align-middle whitespace-nowrap">
                <div className="inline-flex items-center gap-2">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="btn-premium inline-block rounded-lg px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm"
                  >
                    Open
                  </Link>
                  {canEditPage ? (
                    <Link
                      href={`/jobs/${job.id}/edit${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
                      className="btn-premium-secondary inline-block rounded-lg px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm"
                    >
                      Edit
                    </Link>
                  ) : null}
                  {canDelete && deleteAction ? (
                    <form action={deleteAction} className="inline">
                      <input type="hidden" name="id" value={job.id} />
                      <button className="btn-premium-danger rounded-lg px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm">Delete</button>
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
