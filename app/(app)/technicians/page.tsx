import Link from "next/link";
import { JobStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

type SearchParams = {
  q?: string;
  status?: string;
  ready?: string;
};

export default async function TechniciansPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { session, user } = await getCurrentUserRole();
  const filters = await searchParams;
  const validStatuses = new Set(Object.values(JobStatus));
  const statusFilter = filters.status && validStatuses.has(filters.status as JobStatus)
    ? (filters.status as JobStatus)
    : undefined;

  const where =
    user.role === "TECHNICIAN_EXTERNAL" || user.role === "TECHNICIAN_INTERNAL"
      ? { assignedToId: session.user.id }
      : { repairPath: "EXTERNAL" as const };

  const jobs = await prisma.job.findMany({
    where: {
      ...where,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(filters.ready === "1" ? { status: { in: ["IN_REPAIR"] }, clientApproved: true } : {}),
      ...(filters.q
        ? {
            OR: [
              { jobNumber: { contains: filters.q } },
              { brand: { contains: filters.q } },
              { model: { contains: filters.q } },
            ],
          }
        : {}),
    },
    orderBy: { receivedAt: "desc" },
  });

  const normalized = jobs.map((job) => {
    const extendedJob = job as typeof job & { timelineNote?: string | null };
    const ageDays = Math.floor((job.updatedAt.getTime() - job.receivedAt.getTime()) / (1000 * 60 * 60 * 24));
    const ready = job.status === "IN_REPAIR" && job.clientApproved === true;
    const overdue = ready && ageDays >= 3;
    return { ...job, ageDays, ready, overdue, timelineNote: extendedJob.timelineNote ?? null };
  });

  const sortedJobs = [...normalized].sort((a, b) => {
    if (a.ready !== b.ready) return Number(b.ready) - Number(a.ready);
    if (a.overdue !== b.overdue) return Number(b.overdue) - Number(a.overdue);
    return b.ageDays - a.ageDays;
  });

  const assignedCount = normalized.length;
  const readyCount = normalized.filter((job) => job.ready).length;
  const inRepairCount = normalized.filter((job) => job.status === "IN_REPAIR").length;
  const overdueCount = normalized.filter((job) => job.overdue).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">Assigned</p>
          <p className="text-2xl font-semibold">{assignedCount}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">Ready</p>
          <p className="text-2xl font-semibold text-emerald-700">{readyCount}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">In Repair</p>
          <p className="text-2xl font-semibold text-[var(--brand)]">{inRepairCount}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">Overdue</p>
          <p className="text-2xl font-semibold text-rose-700">{overdueCount}</p>
        </div>
      </div>

      <form className="panel-shadow grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:grid-cols-4">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Search job # / device"
          className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1"
        />
        <select name="status" defaultValue={filters.status} className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1">
          <option value="">All statuses</option>
          <option value="RECEIVED">RECEIVED</option>
          <option value="DIAGNOSING">DIAGNOSING</option>
          <option value="AWAITING_APPROVAL">AWAITING_APPROVAL</option>
          <option value="IN_REPAIR">IN_REPAIR</option>
          <option value="READY_FOR_PICKUP">READY_FOR_PICKUP</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="CLOSED">CLOSED</option>
        </select>
        <select name="ready" defaultValue={filters.ready} className="rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1">
          <option value="">All queue</option>
          <option value="1">Ready only</option>
        </select>
        <div className="flex gap-2">
          <button className="rounded-md border border-[var(--line)] bg-white px-3 py-2">Apply</button>
          <Link href="/technicians" className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">Reset</Link>
        </div>
      </form>

      <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        {sortedJobs.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No jobs in this queue. Try changing filters.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {sortedJobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{job.jobNumber} - {job.brand} {job.model}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">{job.status}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">Age {job.ageDays}d</span>
                    {job.ready ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">Ready</span> : null}
                    {job.overdue ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">Overdue</span> : null}
                    {job.repairTimeline ? <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-cyan-700">ETA {job.repairTimeline}</span> : null}
                    {job.timelineNote ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Delay: {job.timelineNote}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/jobs/${job.id}?returnTo=${encodeURIComponent("/technicians")}`} className="text-teal-700 hover:underline">Open</Link>
                  {job.status === "IN_REPAIR" || job.status === "READY_FOR_PICKUP" ? (
                    <Link href={`/jobs/${job.id}?returnTo=${encodeURIComponent("/technicians")}`} className="text-emerald-700 hover:underline">Mark completed</Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
