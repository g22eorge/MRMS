import Link from "next/link";
import { Role } from "@prisma/client";

import { ProgressiveList } from "@/components/mobile/ProgressiveList";
import { JobStatusBadge, statusStripClass } from "@/components/jobs/JobStatusBadge";
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

const workflowReasonConfig: Record<HighlightReason, { badge: string; label: string }> = {
  PARTS_PENDING:        { badge: "bg-amber-50 text-amber-600 border border-amber-200",   label: "Parts pending" },
  SPECIALIST_ESCALATION:{ badge: "bg-violet-50 text-violet-700 border border-violet-200", label: "Escalated" },
  CLIENT_DECLINED:      { badge: "bg-red-50 text-red-600 border border-red-200",          label: "Declined" },
  UNREPAIRABLE:         { badge: "bg-red-50 text-red-600 border border-red-200",          label: "Unrepairable" },
  CUSTOMER_CANCELLED:   { badge: "bg-gray-50 text-gray-500 border border-gray-200",       label: "Cancelled" },
  OTHER:                { badge: "bg-gray-50 text-gray-600 border border-gray-200",       label: "Other" },
};

const deviceLabel: Record<string, string> = {
  PHONE_ANDROID: "Android",
  PHONE_IPHONE:  "iPhone",
  TABLET:        "Tablet",
  WINDOWS_PC:    "Windows",
  MAC:           "Mac",
  OTHER:         "Other",
};

/** Small SVG icons for device types */
function DeviceIcon({ type }: { type: string }) {
  if (type === "PHONE_ANDROID" || type === "PHONE_IPHONE") {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
        <path d="M5 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H5Zm3 11a.75.75 0 1 1 0 1.5A.75.75 0 0 1 8 12ZM6.5 2.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1Z" />
      </svg>
    );
  }
  if (type === "TABLET") {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
        <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2Zm9 11a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z" />
      </svg>
    );
  }
  if (type === "WINDOWS_PC" || type === "MAC") {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
        <path d="M1 3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5.5L4 14h8a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.354-.854L5.293 12H3a2 2 0 0 1-2-2V3Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
      <path fillRule="evenodd" d="M2 2.5A.5.5 0 0 1 2.5 2h11a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5H8.5v2H10a.5.5 0 0 1 0 1H6a.5.5 0 0 1 0-1h1.5v-2H2.5A.5.5 0 0 1 2 10.5v-8Z" clipRule="evenodd" />
    </svg>
  );
}

export function JobTable({
  jobs,
  role,
  permissions = [],
  canDelete,
  deleteAction,
  returnTo,
  pageStart,
  pageEnd,
  total,
  page,
  totalPages,
  isPrevDisabled,
  isNextDisabled,
  prevPageHref,
  nextPageHref,
}: {
  jobs: JobRow[];
  role: Role;
  permissions?: string[];
  canDelete?: boolean;
  deleteAction?: (formData: FormData) => Promise<void>;
  returnTo?: string;
  pageStart?: number;
  pageEnd?: number;
  total?: number;
  page?: number;
  totalPages?: number;
  isPrevDisabled?: boolean;
  isNextDisabled?: boolean;
  prevPageHref?: string;
  nextPageHref?: string;
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

  const hasPagination = typeof total === "number" && typeof page === "number" && typeof totalPages === "number";

  const paginationBar = hasPagination && (totalPages ?? 0) > 1 ? (
    <div className="flex items-center gap-1.5">
      <Link
        href={prevPageHref ?? "#"}
        aria-disabled={isPrevDisabled}
        className={`rounded-md border border-[var(--line)] px-2.5 py-1 text-xs font-medium transition-colors ${
          isPrevDisabled
            ? "pointer-events-none opacity-30 text-[var(--ink-muted)]"
            : "text-[var(--ink)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/6"
        }`}
      >
        ← Prev
      </Link>
      <span className="min-w-[3rem] text-center text-xs tabular-nums text-[var(--ink-muted)]">{page} / {totalPages}</span>
      <Link
        href={nextPageHref ?? "#"}
        aria-disabled={isNextDisabled}
        className={`rounded-md border border-[var(--line)] px-2.5 py-1 text-xs font-medium transition-colors ${
          isNextDisabled
            ? "pointer-events-none opacity-30 text-[var(--ink-muted)]"
            : "text-[var(--ink)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/6"
        }`}
      >
        Next →
      </Link>
    </div>
  ) : null;

  return (
    <div className="panel-shadow overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
        <p className="text-xs text-[var(--ink-muted)]">
          {hasPagination ? (
            <>
              <span className="font-bold text-[var(--ink)]">{pageStart}–{pageEnd}</span>
              {" of "}
              <span className="font-bold text-[var(--ink)]">{total}</span>
              {" jobs"}
            </>
          ) : (
            <><span className="font-bold text-[var(--ink)]">{jobs.length}</span> jobs</>
          )}
        </p>
        {paginationBar}
      </div>

      {/* ── Mobile list ── */}
      <div className="xl:hidden">
        <ProgressiveList initialCount={5} step={6}>
          {jobs.map((job) => {
            const strip = statusStripClass(job.status);
            const hasFlag = job.workflowReason && job.workflowReason !== "NONE";
            const flagCfg = hasFlag ? workflowReasonConfig[job.workflowReason as HighlightReason] : null;
            return (
              <div
                key={job.id}
                className="relative border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3.5 transition-colors last:border-b-0 hover:bg-[var(--panel-strong)]/30"
              >
                {/* Status strip */}
                <span className={`absolute inset-y-0 left-0 w-[3px] rounded-r ${strip}`} aria-hidden="true" />

                <div className="flex items-start justify-between gap-3 pl-2">
                  {/* Left content */}
                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Row 1: Job # + status */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mono text-[13px] font-bold text-[var(--ink)]">{job.jobNumber}</span>
                      <JobStatusBadge status={job.status} />
                      {flagCfg && (
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${flagCfg.badge}`}>
                          {flagCfg.label}
                        </span>
                      )}
                    </div>
                    {/* Row 2: Device */}
                    <p className="font-medium text-[var(--ink)]">
                      {job.brand} {job.model}
                      <span className="ml-1.5 inline-flex items-center gap-1 rounded bg-[var(--panel-strong)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]">
                        <DeviceIcon type={job.deviceType} />
                        {deviceLabel[job.deviceType] ?? job.deviceType}
                      </span>
                    </p>
                    {/* Row 3: Meta */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--ink-muted)]">
                      {canSeeClient && job.clientName ? <span>{job.clientName}</span> : null}
                      {canSeeAssignment && job.assignedTo ? (
                        <span className="flex items-center gap-1">
                          <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5 opacity-40" aria-hidden="true">
                            <circle cx="6" cy="4" r="2.5"/><path d="M1 10c0-2.21 2.24-4 5-4s5 1.79 5 4H1Z"/>
                          </svg>
                          {job.assignedTo}
                        </span>
                      ) : null}
                      <span>{formatEATDate(job.receivedAt)}</span>
                      {canSeeCost ? (
                        <span className="font-semibold text-[var(--ink)]">
                          {showClientFacingCostOnly
                            ? job.clientBill && ["READY_FOR_PICKUP", "DELIVERED", "COMPLETED", "CLOSED"].includes(job.status)
                              ? formatMoney(job.clientBill)
                              : null
                            : job.externalTechBill ? formatMoney(job.externalTechBill) : null}
                        </span>
                      ) : null}
                      {canManagePricing && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          typeof job.clientBill === "number"
                            ? "bg-[var(--accent)]/10 text-[#9A7A00]"
                            : ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"].includes(job.status)
                              ? "bg-amber-50 text-amber-600"
                              : "hidden"
                        }`}>
                          {typeof job.clientBill === "number"
                            ? "Priced"
                            : ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"].includes(job.status)
                              ? "Needs pricing"
                              : null}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/6 hover:text-[var(--accent)]"
                    >
                      Open
                    </Link>
                    {canEditPage ? (
                      <Link
                        href={`/jobs/${job.id}/edit${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
                        className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-muted)] transition hover:border-[var(--ink)]/20 hover:text-[var(--ink)]"
                      >
                        Edit
                      </Link>
                    ) : null}
                    {canDelete && deleteAction ? (
                      <form action={deleteAction}>
                        <input type="hidden" name="id" value={job.id} />
                        <button className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-600 transition hover:bg-red-100">
                          Del
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </ProgressiveList>

        {/* Mobile pagination */}
        {hasPagination && (totalPages ?? 0) > 1 ? (
          <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-3">
            <span className="text-xs text-[var(--ink-muted)]">
              <span className="font-semibold text-[var(--ink)]">{pageStart}–{pageEnd}</span> of {total}
            </span>
            {paginationBar}
          </div>
        ) : null}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--panel-strong)]/50">
              {/* narrow strip col */}
              <th className="w-[3px] p-0" aria-hidden="true" />
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">Job #</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">Device</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">Status</th>
              {canSeeClient ? <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">Client</th> : null}
              {canSeeAssignment ? <th className="hidden px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)] 2xl:table-cell">Assigned</th> : null}
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">Received</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">Flag</th>
              {canSeeCost ? <th className="hidden px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)] 2xl:table-cell">{showClientFacingCostOnly ? "Cost" : "Ext. Bill"}</th> : null}
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {jobs.map((job) => {
              const strip = statusStripClass(job.status);
              const hasFlag = job.workflowReason && job.workflowReason !== "NONE";
              const flagCfg = hasFlag ? workflowReasonConfig[job.workflowReason as HighlightReason] : null;
              return (
                <tr
                  key={job.id}
                  className="group transition-colors hover:bg-[var(--panel-strong)]/40"
                >
                  {/* Status color strip */}
                  <td className="p-0 w-[3px]" aria-hidden="true">
                    <div className={`h-full min-h-[3rem] w-[3px] ${strip}`} />
                  </td>

                  {/* Job # */}
                  <td className="px-4 py-3 align-middle">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="mono block font-bold text-[var(--ink)] transition-colors hover:text-[var(--accent)]"
                    >
                      {job.jobNumber}
                    </Link>
                  </td>

                  {/* Device */}
                  <td className="px-4 py-3 align-middle">
                    <p className="max-w-[16rem] truncate font-semibold text-[var(--ink)]">{job.brand} {job.model}</p>
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-[var(--panel-strong)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]">
                      <DeviceIcon type={job.deviceType} />
                      {deviceLabel[job.deviceType] ?? job.deviceType}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 align-middle">
                    <JobStatusBadge status={job.status} />
                  </td>

                  {/* Client */}
                  {canSeeClient ? (
                    <td className="px-4 py-3 align-middle">
                      <p className="max-w-[13rem] truncate text-[var(--ink)]">{job.clientName ?? <span className="text-[var(--ink-muted)]">—</span>}</p>
                    </td>
                  ) : null}

                  {/* Assigned (2xl) */}
                  {canSeeAssignment ? (
                    <td className="hidden px-4 py-3 align-middle 2xl:table-cell">
                      <p className="max-w-[11rem] truncate text-[var(--ink-muted)]">{job.assignedTo ?? "—"}</p>
                    </td>
                  ) : null}

                  {/* Received */}
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-[var(--ink-muted)]">
                    {formatEATDate(job.receivedAt)}
                  </td>

                  {/* Flag */}
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap items-center gap-1">
                      {flagCfg && (
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${flagCfg.badge}`}>
                          {flagCfg.label}
                        </span>
                      )}
                      {canManagePricing && (
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                          typeof job.clientBill === "number"
                            ? "bg-[var(--accent)]/10 text-[#9A7A00]"
                            : ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"].includes(job.status)
                              ? "bg-amber-50 text-amber-600"
                              : "hidden"
                        }`}>
                          {typeof job.clientBill === "number"
                            ? "Priced"
                            : ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"].includes(job.status)
                              ? "Needs pricing"
                              : null}
                        </span>
                      )}
                      {!flagCfg && !canManagePricing && <span className="text-[var(--ink-muted)]">—</span>}
                    </div>
                  </td>

                  {/* Cost (2xl) */}
                  {canSeeCost ? (
                    <td className="hidden whitespace-nowrap px-4 py-3 text-right align-middle 2xl:table-cell">
                      <span className="font-semibold text-[var(--ink)]">
                        {showClientFacingCostOnly
                          ? job.clientBill && ["READY_FOR_PICKUP", "COMPLETED", "CLOSED"].includes(job.status)
                            ? formatMoney(job.clientBill)
                            : <span className="font-normal text-[var(--ink-muted)]">—</span>
                          : job.externalTechBill
                            ? formatMoney(job.externalTechBill)
                            : <span className="font-normal text-[var(--ink-muted)]">—</span>}
                      </span>
                    </td>
                  ) : null}

                  {/* Actions */}
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="whitespace-nowrap rounded-md border border-[var(--line)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/8 hover:text-[var(--accent)]"
                      >
                        Open
                      </Link>
                      {canEditPage ? (
                        <Link
                          href={`/jobs/${job.id}/edit${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
                          className="whitespace-nowrap rounded-md border border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-muted)] transition-colors hover:border-[var(--ink)]/20 hover:text-[var(--ink)]"
                        >
                          Edit
                        </Link>
                      ) : null}
                      {canDelete && deleteAction ? (
                        <form action={deleteAction} className="inline">
                          <input type="hidden" name="id" value={job.id} />
                          <button className="whitespace-nowrap rounded-md border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600">
                            Delete
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
