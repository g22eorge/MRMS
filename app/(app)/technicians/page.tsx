import Link from "next/link";

import { ProgressiveList } from "@/components/mobile/ProgressiveList";
import { JOB_STATUSES, JobStatus } from "@/lib/job-status";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

type SearchParams = {
  q?: string;
  status?: string;
  ready?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function confidenceLabel(value: string | null) {
  if (!value) return "ESTIMATED";
  return value.replaceAll("_", " ");
}

function priorityBand(overdue: boolean, ready: boolean, ageDays: number) {
  if (overdue) return { label: "Attention", tone: "bg-orange-100 text-orange-700 border-orange-200" };
  if (ready) return { label: "High", tone: "bg-amber-100 text-amber-700 border-amber-200" };
  if (ageDays >= 2) return { label: "Medium", tone: "bg-cyan-100 text-cyan-700 border-cyan-200" };
  return { label: "Normal", tone: "bg-slate-100 text-slate-700 border-slate-200" };
}

function shortText(value: string | null, max = 78) {
  if (!value) return "No issue summary provided";
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}...`;
}

export default async function TechniciansPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { session, user } = await getCurrentUserRole();
  const filters = await searchParams;
  const validStatuses = new Set<string>(JOB_STATUSES);
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
    include: {
      assignedTo: { select: { name: true } },
    },
  });

  const normalized = jobs.map((job) => {
    const extendedJob = job as typeof job & { timelineNote?: string | null };
    const ageDays = Math.floor((job.updatedAt.getTime() - job.receivedAt.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedMinutes = Math.max(0, Math.floor((job.updatedAt.getTime() - job.receivedAt.getTime()) / (1000 * 60)));
    const etaMinutes = job.timelineMaxMinutes ?? job.timelineMinMinutes ?? null;
    const etaProgress = etaMinutes ? clamp((elapsedMinutes / etaMinutes) * 100, 0, 180) : null;
    const ready = job.status === "IN_REPAIR" && job.clientApproved === true;
    const overdue = ready && ageDays >= 3;
    const priority = priorityBand(overdue, ready, ageDays);
    return {
      ...job,
      ageDays,
      ready,
      overdue,
      etaProgress,
      elapsedMinutes,
      priority,
      timelineNote: extendedJob.timelineNote ?? null,
    };
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
  const awaitingApprovalCount = normalized.filter((job) => job.status === "AWAITING_APPROVAL").length;
  const spotlightJobs = sortedJobs.slice(0, 3);
  const statusCounts = [
    { key: "RECEIVED", count: normalized.filter((job) => job.status === "RECEIVED").length },
    { key: "DIAGNOSING", count: normalized.filter((job) => job.status === "DIAGNOSING").length },
    { key: "AWAITING_APPROVAL", count: awaitingApprovalCount },
    { key: "IN_REPAIR", count: inRepairCount },
    { key: "READY_FOR_PICKUP", count: normalized.filter((job) => job.status === "READY_FOR_PICKUP").length },
  ];

  const quickActions = [
    ...(readyCount > 0 ? [{ href: "/technicians?ready=1", label: "Ready Queue" }] : []),
    ...(inRepairCount > 0 ? [{ href: "/technicians?status=IN_REPAIR", label: "In Repair" }] : []),
    ...(awaitingApprovalCount > 0 ? [{ href: "/technicians?status=AWAITING_APPROVAL", label: "Awaiting Approval" }] : []),
    ...(user.role === "TECHNICIAN_EXTERNAL"
      ? [{ href: "/technicians/payouts", label: "My Payouts" }]
      : [{ href: "/jobs?status=IN_REPAIR&returnTo=%2Ftechnicians", label: "Add Timeline Note" }]),
  ];

  return (
    <div className="space-y-4">
      <div className="panel-shadow sticky top-14 z-20 -mx-1 flex gap-2 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] px-2 py-2 md:hidden">
        <Link href="/technicians" className="min-w-[110px] shrink-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Assigned</p>
          <p className="text-sm font-semibold">{assignedCount}</p>
        </Link>
        <Link href="/technicians?ready=1" className="min-w-[110px] shrink-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Ready</p>
          <p className="text-sm font-semibold text-emerald-700">{readyCount}</p>
        </Link>
        <Link href="/technicians?status=IN_REPAIR" className="min-w-[110px] shrink-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">In Repair</p>
          <p className="text-sm font-semibold text-[var(--brand)]">{inRepairCount}</p>
        </Link>
        <Link href="/technicians?ready=1" className="min-w-[110px] shrink-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Overdue</p>
          <p className="text-sm font-semibold text-amber-700">{overdueCount}</p>
        </Link>
      </div>

      <div className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-4">
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
          <p className="text-2xl font-semibold text-amber-700">{overdueCount}</p>
        </div>
      </div>

      <form className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:hidden">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Search job # / device and press Enter"
          className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2"
        />
      </form>

      <form className="panel-shadow hidden gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 md:grid md:grid-cols-4">
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

      <div className="panel-shadow sticky top-[var(--mobile-stack-offset)] z-10 flex flex-wrap gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2 md:top-24">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href} className="btn-premium-secondary rounded-md px-3 py-1.5 text-xs">
            {action.label}
          </Link>
        ))}
      </div>

      <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Queue Map</p>
        <div className="mt-2 grid grid-cols-2 gap-2 md:hidden">
          {statusCounts.map((status) => (
            <div key={`mobile-${status.key}`} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <p className="text-[11px] text-[var(--ink-muted)]">{status.key.replaceAll("_", " ")}</p>
              <p className="text-lg font-semibold text-[var(--ink)]">{status.count}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 hidden gap-2 md:grid md:grid-cols-2 lg:grid-cols-5">
          {statusCounts.map((status) => (
            <div key={status.key} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <p className="text-[11px] text-[var(--ink-muted)]">{status.key.replaceAll("_", " ")}</p>
              <p className="text-lg font-semibold text-[var(--ink)]">{status.count}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Priority Spotlight</p>
          <span className="text-xs text-[var(--ink-muted)]">Top actionables</span>
        </div>
        {spotlightJobs.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">Nothing urgent right now.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-3">
            {spotlightJobs.map((job) => (
              <div key={`spotlight-${job.id}`} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="mono truncate text-xs font-semibold">{job.jobNumber}</p>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${job.priority.tone}`}>
                    {job.priority.label}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-medium">{job.brand} {job.model}</p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">Assigned: {job.assignedTo?.name ?? "Unassigned"}</p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">{shortText(job.issueDescription, 72)}</p>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--ink-muted)]">
                  <span className="rounded-full bg-white px-2 py-0.5">{job.status.replaceAll("_", " ")}</span>
                  <span>Age {job.ageDays}d</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`/jobs/${job.id}?returnTo=${encodeURIComponent("/technicians")}`} className="btn-premium flex-1 rounded-md px-2 py-1.5 text-center text-xs">
                    Open
                  </Link>
                  <Link href={`/jobs/${job.id}/edit?returnTo=${encodeURIComponent("/technicians")}`} className="btn-premium-secondary flex-1 rounded-md px-2 py-1.5 text-center text-xs">
                    Update
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        {sortedJobs.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No jobs in this queue. Try changing filters.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            <ProgressiveList initialCount={5} step={5}>
              {sortedJobs.map((job) => (
                <li key={job.id} className="border-b border-[var(--line)] py-2">
                <details className="rounded-lg sm:rounded-none">
                  <summary className="list-none">
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium">{job.jobNumber} - {job.brand} {job.model}</p>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${job.priority.tone}`}>
                          {job.priority.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--ink-muted)]">{shortText(job.issueDescription, 88)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">{job.status}</span>
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">
                          Assigned: {job.assignedTo?.name ?? "Unassigned"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">Age {job.ageDays}d</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">{confidenceLabel(job.timelineConfidence)}</span>
                        {job.ready ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">Ready</span> : null}
                        {job.overdue ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700">Overdue</span> : null}
                        {job.repairTimeline ? <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-cyan-700">ETA {job.repairTimeline}</span> : null}
                        {job.timelineNote ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Delay: {job.timelineNote}</span>
                        ) : null}
                      </div>
                      {typeof job.etaProgress === "number" ? (
                        <div className="mt-2">
                          <div className="h-1.5 rounded-full bg-slate-200">
                            <div
                              className={`h-1.5 rounded-full ${job.etaProgress >= 100 ? "bg-amber-500" : "bg-[var(--brand)]"}`}
                              style={{ width: `${Math.min(job.etaProgress, 100)}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
                            Elapsed {Math.floor(job.elapsedMinutes / 60)}h of ETA budget
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </summary>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-[var(--ink-muted)]">
                      {user.role === "TECHNICIAN_EXTERNAL" ? "Use Work Order for estimate and timeline updates" : "Use Work Order for repair log and completion updates"}
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/jobs/${job.id}?returnTo=${encodeURIComponent("/technicians")}`} className="text-teal-700 hover:underline">Open</Link>
                      {job.status === "IN_REPAIR" || job.status === "READY_FOR_PICKUP" ? (
                        <Link href={`/jobs/${job.id}?returnTo=${encodeURIComponent("/technicians")}`} className="text-emerald-700 hover:underline">Mark completed</Link>
                      ) : null}
                    </div>
                  </div>
                </details>
                </li>
              ))}
            </ProgressiveList>
          </ul>
        )}
      </div>
    </div>
  );
}
