import Link from "next/link";
import { JobStatus, Role } from "@prisma/client";

import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { formatMoney } from "@/lib/currency";

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
};

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
  const canSeeCost = role === "ADMIN" || role === "ACCOUNTS";
  const canSeeAssignment = role === "ADMIN" || role === "OPS";
  const canEditPage = role !== "TECHNICIAN_EXTERNAL";

  return (
    <div className="panel-shadow overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="space-y-3 p-3 sm:hidden">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-3 max-[360px]:p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="mono min-w-0 truncate text-sm font-semibold">{job.jobNumber}</p>
              <JobStatusBadge status={job.status} />
            </div>
            <p className="mt-1 truncate text-sm font-medium text-[var(--ink)]">{job.brand} {job.model}</p>
            <p className="truncate text-xs uppercase tracking-[0.12em] text-[var(--ink-muted)]">{job.deviceType.replaceAll("_", " ")}</p>

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
              <div>
                <p className="text-[var(--ink-muted)]">Received</p>
                <p className="font-medium text-[var(--ink)]">{job.receivedAt.toLocaleDateString()}</p>
              </div>
              {canSeeCost ? (
                <div>
                  <p className="text-[var(--ink-muted)]">External Bill</p>
                  <p className="font-medium text-[var(--ink)]">{job.externalTechBill ? formatMoney(job.externalTechBill) : "UGX -"}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex gap-2 max-[360px]:grid max-[360px]:grid-cols-2">
              <Link
                href={`/jobs/${job.id}`}
                className="flex-1 rounded-md bg-[var(--brand)] px-3 py-2 text-center text-sm font-medium text-white max-[360px]:px-2"
              >
                Open
              </Link>
              {canEditPage ? (
                <Link
                  href={`/jobs/${job.id}/edit${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
                  className="flex-1 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-center text-sm font-medium text-[var(--ink)] max-[360px]:px-2"
                >
                  Edit
                </Link>
              ) : null}
              {canDelete && deleteAction ? (
                <form action={deleteAction} className="flex-1 max-[360px]:col-span-2">
                  <input type="hidden" name="id" value={job.id} />
                  <button className="w-full rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                    Delete
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-full text-sm">
        <thead className="bg-[var(--panel-strong)] text-left text-[11px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
          <tr>
            <th className="px-4 py-3">Job #</th>
            <th className="px-4 py-3">Device</th>
            <th className="px-4 py-3">Status</th>
            {canSeeClient ? <th className="px-4 py-3">Client</th> : null}
            {canSeeAssignment ? <th className="px-4 py-3">Assigned</th> : null}
            <th className="px-4 py-3">Received</th>
            {canSeeCost ? <th className="px-4 py-3">External Bill</th> : null}
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-t border-[var(--line)]/70 transition hover:bg-[var(--panel-strong)]/70">
              <td className="px-4 py-3 font-semibold">{job.jobNumber}</td>
              <td className="px-4 py-3">{job.deviceType} / {job.brand} {job.model}</td>
              <td className="px-4 py-3"><JobStatusBadge status={job.status} /></td>
              {canSeeClient ? <td className="px-4 py-3">{job.clientName ?? "-"}</td> : null}
              {canSeeAssignment ? <td className="px-4 py-3">{job.assignedTo ?? "-"}</td> : null}
              <td className="px-4 py-3">{job.receivedAt.toLocaleDateString()}</td>
              {canSeeCost ? <td className="px-4 py-3">{job.externalTechBill ? formatMoney(job.externalTechBill) : "-"}</td> : null}
              <td className="px-4 py-3">
                <Link href={`/jobs/${job.id}`} className="text-teal-700 hover:underline">
                  Open
                </Link>
                {canEditPage ? (
                  <Link
                    href={`/jobs/${job.id}/edit${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
                    className="ml-3 text-slate-700 hover:underline"
                  >
                    Edit
                  </Link>
                ) : null}
                {canDelete && deleteAction ? (
                  <form action={deleteAction} className="ml-3 inline">
                    <input type="hidden" name="id" value={job.id} />
                    <button className="text-rose-700 hover:underline">Delete</button>
                  </form>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}
