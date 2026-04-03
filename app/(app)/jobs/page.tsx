import Link from "next/link";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { JobTable, JobRow } from "@/components/jobs/JobTable";
import { StatusFlowNotice } from "@/components/jobs/StatusFlowNotice";
import { JOB_STATUSES, JobStatus } from "@/lib/job-status";
import { getExternalTechBill } from "@/lib/billing";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

type SearchParams = {
  status?: string;
  deviceType?: string;
  repairPath?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: string;
  sort?: string;
};

type JobWithClient = Prisma.JobGetPayload<{
  include: { client: true; assignedTo: true };
}>;
type JobWithoutClient = Prisma.JobGetPayload<{
  include: { assignedTo: true };
}>;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { session, user } = await getCurrentUserRole();
  const filters = await searchParams;
  const statuses = (filters.status ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as JobStatus[];
  const page = Math.max(Number(filters.page ?? "1") || 1, 1);
  const pageSize = 20;
  const sort = filters.sort === "job_number_desc" ? "job_number_desc" : "received_desc";
  const orderBy = sort === "job_number_desc" ? { jobNumber: "desc" as const } : { receivedAt: "desc" as const };

  const whereBase = {
    ...(user.role === "TECHNICIAN_EXTERNAL" || user.role === "TECHNICIAN_INTERNAL"
      ? { assignedToId: session.user.id }
      : {}),
    ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
    ...(filters.deviceType ? { deviceType: filters.deviceType as never } : {}),
    ...(filters.repairPath ? { repairPath: filters.repairPath as never } : {}),
    ...(filters.from || filters.to
      ? {
          receivedAt: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
          },
        }
      : {}),
  };

  const where =
    user.role === "TECHNICIAN_EXTERNAL"
      ? {
          ...whereBase,
          ...(filters.q ? { OR: [{ jobNumber: { contains: filters.q } }] } : {}),
        }
      : {
          ...whereBase,
          ...(filters.q
            ? {
                OR: [
                  { jobNumber: { contains: filters.q } },
                  { client: { fullName: { contains: filters.q } } },
                ],
              }
            : {}),
        };

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include:
        user.role === "TECHNICIAN_EXTERNAL"
          ? { assignedTo: true }
          : { client: true, assignedTo: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.job.count({ where }),
  ]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const isExternalTech = user.role === "TECHNICIAN_EXTERNAL";

  async function deleteJobAction(formData: FormData) {
    "use server";

    const { user } = await getCurrentUserRole();
    if (user.role !== "ADMIN") return;

    const id = String(formData.get("id") ?? "");
    if (!id) return;

    await prisma.job.delete({ where: { id } });
    revalidatePath("/jobs");
  }

  const rows: JobRow[] = (jobs as Array<JobWithClient | JobWithoutClient>).map((job) => {
    const withWorkflow = job as typeof job & { workflowReason?: JobRow["workflowReason"] };
    return {
      id: job.id,
      jobNumber: job.jobNumber,
      status: job.status,
      deviceType: job.deviceType,
      brand: job.brand,
      model: job.model,
      clientName: "client" in job ? job.client?.fullName : undefined,
      assignedTo: job.assignedTo?.name,
      receivedAt: job.receivedAt,
      externalTechBill: getExternalTechBill(job),
      workflowReason: withWorkflow.workflowReason ?? null,
    };
  });

  const preserved = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => typeof value === "string" && value.length > 0),
  ) as Record<string, string>;
  const returnToQuery = new URLSearchParams(preserved).toString();
  const returnTo = returnToQuery ? `/jobs?${returnToQuery}` : "/jobs";

  return (
    <div className="space-y-5">
      {can.createJob(user.role) ? (
        <div className="flex justify-end">
          <Link
            href="/jobs/new"
            className="btn-premium rounded-md px-3 py-1.5 text-[13px] font-medium sm:py-2 sm:text-sm"
          >
            New Job
          </Link>
        </div>
      ) : null}

      {isExternalTech ? (
        <form className="panel-shadow grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:grid-cols-5">
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Search job #"
            className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1"
          />
          <select name="status" defaultValue={filters.status} className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1">
            <option value="">All statuses</option>
            {JOB_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select name="sort" defaultValue={sort} className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1">
            <option value="received_desc">Newest received</option>
            <option value="job_number_desc">Job number desc</option>
          </select>
          <input type="date" name="from" defaultValue={filters.from} className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1" />
          <div className="flex gap-2">
            <button className="btn-premium-secondary rounded-md px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm">Apply</button>
            <Link href="/jobs" className="btn-premium-secondary rounded-md px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm">Reset</Link>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <form className="panel-shadow grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:grid-cols-6">
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Search job # or client"
              className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1"
            />
            <input
              name="status"
              defaultValue={filters.status}
              placeholder="Status list (csv)"
              className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1"
            />
            <select name="deviceType" defaultValue={filters.deviceType} className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1">
              <option value="">All devices</option>
              <option value="PHONE_ANDROID">Phone Android</option>
              <option value="PHONE_IPHONE">Phone iPhone</option>
              <option value="TABLET">Tablet</option>
              <option value="WINDOWS_PC">Windows PC</option>
              <option value="MAC">Mac</option>
              <option value="OTHER">Other</option>
            </select>
            <select name="repairPath" defaultValue={filters.repairPath} className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1">
              <option value="">All paths</option>
              <option value="IN_HOUSE">In-house</option>
              <option value="EXTERNAL">External</option>
            </select>
            <select name="sort" defaultValue={sort} className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1">
              <option value="received_desc">Newest received</option>
              <option value="job_number_desc">Job number desc</option>
            </select>
            <input type="date" name="from" defaultValue={filters.from} className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1" />
            <input type="date" name="to" defaultValue={filters.to} className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1" />
            <button className="btn-premium-secondary rounded-md px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm">Apply</button>
            <p className="mono md:col-span-6 text-[11px] text-[var(--ink-muted)]">Tip: `RECEIVED,IN_REPAIR,COMPLETED`</p>
          </form>
          <StatusFlowNotice message="Status flow: RECEIVED -> DIAGNOSING -> AWAITING_APPROVAL -> IN_REPAIR -> READY_FOR_PICKUP -> COMPLETED or CLOSED. Use job workflow notes for parts pending, specialist escalation, or closure reason." />
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-[var(--ink-muted)]">
        <p>Page {page} of {totalPages}</p>
        <div className="flex gap-2">
          <Link
            href={`?${new URLSearchParams({ ...preserved, page: String(Math.max(page - 1, 1)) }).toString()}`}
            className="btn-premium-secondary rounded-md px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm"
          >
            Prev
          </Link>
          <Link
            href={`?${new URLSearchParams({ ...preserved, page: String(Math.min(page + 1, totalPages)) }).toString()}`}
            className="btn-premium-secondary rounded-md px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm"
          >
            Next
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="panel-shadow rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--ink-muted)]">No jobs found for the current filters.</div>
      ) : (
        <JobTable
          jobs={rows}
          role={user.role}
          canDelete={user.role === "ADMIN"}
          deleteAction={deleteJobAction}
          returnTo={returnTo}
        />
      )}
    </div>
  );
}
