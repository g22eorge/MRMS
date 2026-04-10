import Link from "next/link";

import { ProgressiveList } from "@/components/mobile/ProgressiveList";
import { JOB_STATUSES, JobStatus } from "@/lib/job-status";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

type SearchParams = {
  q?: string;
  status?: string;
  ready?: string;
  dismiss?: string;
};

const ACTIVE_BOARD_STATUSES = [
  "RECEIVED",
  "DIAGNOSING",
  "AWAITING_APPROVAL",
  "IN_REPAIR",
  "READY_FOR_PICKUP",
];

const statusOptionLabel: Record<JobStatus, string> = {
  RECEIVED: "Received",
  DIAGNOSING: "Diagnosing",
  AWAITING_APPROVAL: "Awaiting Approval",
  IN_REPAIR: "In Repair",
  READY_FOR_PICKUP: "Ready for Pickup",
  COMPLETED: "Completed",
  CLOSED: "Closed",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function priorityBand(overdue: boolean, ready: boolean, ageDays: number) {
  if (overdue) return { label: "Attention", tone: "bg-black text-white border-black" };
  if (ready) return { label: "High", tone: "bg-[#D4AF37] text-white border-[#D4AF37]" };
  if (ageDays >= 2) return { label: "Medium", tone: "bg-slate-300 text-slate-800 border-slate-400" };
  return { label: "Normal", tone: "bg-slate-100 text-slate-700 border-slate-200" };
}

function statusTone(status: JobStatus) {
  if (status === "READY_FOR_PICKUP") return "bg-[#D4AF37] text-white border-[#D4AF37]";
  if (status === "IN_REPAIR") return "bg-black text-white border-black";
  if (status === "AWAITING_APPROVAL") return "bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30";
  if (status === "DIAGNOSING") return "bg-slate-300 text-slate-800 border-slate-400";
  if (status === "CLOSED") return "bg-slate-100 text-slate-500 border-slate-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function shortText(value: string | null, max = 78) {
  if (!value) return "No issue summary provided";
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}...`;
}

function statusTone(status: JobStatus) {
  if (status === "READY_FOR_PICKUP") return "bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30";
  if (status === "IN_REPAIR") return "bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30";
  if (status === "AWAITING_APPROVAL") return "bg-[#D4AF37] text-white border-[#D4AF37]";
  if (status === "DIAGNOSING") return "bg-slate-300 text-slate-800 border-slate-400";
  if (status === "CLOSED") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function statusLabel(status: JobStatus) {
  return statusOptionLabel[status];
}

function nextCourse(job: {
  status: JobStatus;
  ready: boolean;
  clientApproved: boolean | null;
  repairPath: "IN_HOUSE" | "EXTERNAL" | null;
}) {
  if (job.status === "RECEIVED") return "Start diagnosis and capture baseline findings.";
  if (job.status === "DIAGNOSING") {
    return job.repairPath === "EXTERNAL"
      ? "Prepare referral notes and submit external handoff."
      : "Finalize diagnosis and move job to internal repair.";
  }
  if (job.status === "AWAITING_APPROVAL") return "Await client approval before active repair work.";
  if (job.status === "IN_REPAIR") {
    if (job.ready) return "Run final checks and prepare pickup handoff.";
    return job.clientApproved ? "Continue repair and keep timeline updated." : "Pause work until approval is confirmed.";
  }
  if (job.status === "READY_FOR_PICKUP") return "Notify client and complete pickup checklist.";
  if (job.status === "COMPLETED") return "Close documentation and archive supporting notes.";
  return "No pending action for this job.";
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

  function routeWith(next: Partial<Record<keyof SearchParams, string>>) {
    const params = new URLSearchParams();
    const entries: Array<[keyof SearchParams, string | undefined]> = [
      ["q", filters.q],
      ["status", filters.status],
      ["ready", filters.ready],
      ["dismiss", filters.dismiss],
    ];
    for (const [key, value] of entries) {
      const update = next[key];
      const finalValue = update !== undefined ? update : value;
      if (finalValue && finalValue.trim().length > 0) {
        params.set(key, finalValue);
      }
    }
    const query = params.toString();
    return query ? `/technicians?${query}` : "/technicians";
  }

  const where =
    user.role === "TECHNICIAN_EXTERNAL" || user.role === "TECHNICIAN_INTERNAL"
      ? { assignedToId: session.user.id }
      : { repairPath: "EXTERNAL" as const };

  const jobs = await prisma.job.findMany({
    where: {
      ...where,
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

  const normalized = jobs
    .filter((job) => {
      if (statusFilter && job.status !== statusFilter) return false;
      if (!statusFilter && !ACTIVE_BOARD_STATUSES.includes(job.status)) return false;
      if (filters.ready === "1" && !(job.status === "IN_REPAIR" && job.clientApproved === true)) return false;
      return true;
    })
    .map((job) => {
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
  const dismissedSpotlightIds = new Set(
    (filters.dismiss ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const spotlightCandidates = sortedJobs.filter(
    (job) =>
      !dismissedSpotlightIds.has(job.id) &&
      ["RECEIVED", "DIAGNOSING", "AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"].includes(job.status),
  );
  const spotlightJobs = spotlightCandidates.slice(0, 3);
  const boardReturnTo = routeWith({});
  const hasActiveFilters = Boolean(filters.q || filters.status || filters.ready);
  const statusCounts = [
    { key: "RECEIVED", count: normalized.filter((job) => job.status === "RECEIVED").length },
    { key: "DIAGNOSING", count: normalized.filter((job) => job.status === "DIAGNOSING").length },
    { key: "AWAITING_APPROVAL", count: awaitingApprovalCount },
    { key: "IN_REPAIR", count: inRepairCount },
    { key: "READY_FOR_PICKUP", count: normalized.filter((job) => job.status === "READY_FOR_PICKUP").length },
  ];

  const quickActions = [
    { href: routeWith({ ready: "1", status: "" }), label: "Ready", count: readyCount, active: filters.ready === "1" },
    { href: routeWith({ status: "IN_REPAIR", ready: "" }), label: "In Repair", count: inRepairCount, active: filters.status === "IN_REPAIR" && filters.ready !== "1" },
    { href: routeWith({ status: "AWAITING_APPROVAL", ready: "" }), label: "Approval", count: awaitingApprovalCount, active: filters.status === "AWAITING_APPROVAL" },
  ];
  const controlClass =
    "rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm outline-none transition focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20";
  const mobileControlClass =
    "rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20";
  const boardBrief = hasActiveFilters
    ? "Filtered queue view is active. Use the KPI cards below for live counts and clear filters to return to the full technician board."
    : "Use this board to triage work by readiness, approvals, and aging risk. KPI cards below provide live queue totals at a glance.";

  function dismissSpotlightReturnTo(jobId: string) {
    const merged = new Set([...dismissedSpotlightIds, jobId]);
    return routeWith({ dismiss: Array.from(merged).join(",") });
  }

  return (
    <div className="space-y-4">
      <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">Board Brief</p>
          <p className="mt-1 text-sm text-[var(--ink)] [overflow-wrap:anywhere]">{boardBrief}</p>
        </div>
      </div>

      <div className="panel-shadow grid grid-cols-2 gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-2 py-2 lg:hidden">
        <Link href="/technicians" className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Assigned</p>
          <p className="text-sm font-semibold">{assignedCount}</p>
        </Link>
        <Link href="/technicians?ready=1" className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Ready</p>
          <p className="text-sm font-semibold text-[#D4AF37]">{readyCount}</p>
        </Link>
        <Link href="/technicians?status=IN_REPAIR" className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">In Repair</p>
          <p className="text-sm font-semibold text-[var(--brand)]">{inRepairCount}</p>
        </Link>
        <Link href="/technicians?ready=1" className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Overdue</p>
          <p className="text-sm font-semibold text-[#D4AF37]">{overdueCount}</p>
        </Link>
      </div>

      <div className="hidden gap-3 lg:grid lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">Assigned</p>
          <p className="text-2xl font-semibold">{assignedCount}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">Ready</p>
          <p className="text-2xl font-semibold text-[#D4AF37]">{readyCount}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">In Repair</p>
          <p className="text-2xl font-semibold text-[var(--brand)]">{inRepairCount}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-xs text-[var(--ink-muted)]">Overdue</p>
          <p className="text-2xl font-semibold text-[#D4AF37]">{overdueCount}</p>
        </div>
      </div>

      <form className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 lg:hidden">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Search job # / device and press Enter"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm outline-none transition focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20"
        />
        <details className="mt-2 rounded-lg border border-[#D4AF37]/30 bg-[linear-gradient(180deg,rgba(212,175,55,0.1),rgba(245,245,245,0.9))] p-2">
          <summary className="list-none">
            <div className="flex items-center justify-between rounded-md border border-[#D4AF37]/30 bg-white/70 px-2 py-1.5">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--ink-muted)]">Advanced filters</p>
              <span className="text-xs text-[#D4AF37]">Status + Queue</span>
            </div>
          </summary>
          <div className="mt-2 grid gap-2">
            <select name="status" defaultValue={filters.status} className={mobileControlClass}>
              <option value="">All statuses</option>
              {JOB_STATUSES.map((status) => (
                <option key={status} value={status}>{statusOptionLabel[status]}</option>
              ))}
            </select>
            <select name="ready" defaultValue={filters.ready} className={mobileControlClass}>
              <option value="">All queue</option>
              <option value="1">Ready only</option>
            </select>
          </div>
        </details>
      </form>

      <form className="panel-shadow hidden gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 lg:grid lg:grid-cols-4">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Search job # / device"
          className={controlClass}
        />
        <select name="status" defaultValue={filters.status} className={controlClass}>
          <option value="">All statuses</option>
          {JOB_STATUSES.map((status) => (
            <option key={status} value={status}>{statusOptionLabel[status]}</option>
          ))}
        </select>
        <select name="ready" defaultValue={filters.ready} className={controlClass}>
          <option value="">All queue</option>
          <option value="1">Ready only</option>
        </select>
        <div className="flex gap-2">
          <button className="btn-premium-secondary rounded-lg px-3 py-2">Apply</button>
          <Link href="/technicians" className="btn-premium-secondary rounded-lg px-3 py-2 text-sm">Reset</Link>
        </div>
      </form>

      {hasActiveFilters ? (
        <div className="panel-shadow flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Active filters</span>
          {filters.q ? (
            <Link href={routeWith({ q: "" })} className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-muted)]">
              Search: {filters.q} x
            </Link>
          ) : null}
          {filters.status ? (
            <Link href={routeWith({ status: "" })} className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-muted)]">
              Status: {statusOptionLabel[filters.status as JobStatus] ?? filters.status} x
            </Link>
          ) : null}
          {filters.ready === "1" ? (
            <Link href={routeWith({ ready: "" })} className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-muted)]">
              Ready only x
            </Link>
          ) : null}
          <Link href="/technicians" className="btn-premium-secondary rounded-md px-2 py-1 text-[11px]">Clear all</Link>
        </div>
      ) : null}

      <div className="panel-shadow grid grid-cols-3 gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className={`rounded-md px-3 py-1.5 text-center text-xs ${action.active ? "btn-premium text-white" : "btn-premium-secondary"}`}
          >
            {action.label} ({action.count})
          </Link>
        ))}
      </div>

      <div className="flex">
        <Link
          href={user.role === "TECHNICIAN_EXTERNAL" ? "/technicians/payouts" : `/jobs?status=IN_REPAIR&returnTo=${encodeURIComponent(boardReturnTo)}`}
          className="btn-premium-secondary rounded-md px-3 py-1.5 text-xs"
        >
          {user.role === "TECHNICIAN_EXTERNAL" ? "My Payouts" : "Add Timeline Note"}
        </Link>
      </div>

      <details className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <summary className="list-none cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
          Queue Map
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2 lg:hidden">
          {statusCounts.map((status) => (
            <div key={`mobile-${status.key}`} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <p className="text-[11px] text-[var(--ink-muted)]">{statusOptionLabel[status.key as JobStatus]}</p>
              <p className="text-lg font-semibold text-[var(--ink)]">{status.count}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 hidden gap-2 lg:grid lg:grid-cols-5">
          {statusCounts.map((status) => (
            <div key={status.key} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
              <p className="text-[11px] text-[var(--ink-muted)]">{statusOptionLabel[status.key as JobStatus]}</p>
              <p className="text-lg font-semibold text-[var(--ink)]">{status.count}</p>
            </div>
          ))}
        </div>
      </details>

      <details className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" open>
        <summary className="mb-2 flex list-none cursor-pointer items-center justify-between gap-2">
          <p className="text-sm font-semibold">Priority Spotlight</p>
          <span className="text-xs text-[var(--ink-muted)]">Top actionables</span>
        </summary>
        {spotlightJobs.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">Nothing urgent right now.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {spotlightJobs.map((job) => (
              <article
                key={`spotlight-${job.id}`}
                className="overflow-hidden rounded-xl border border-[var(--line)] bg-[linear-gradient(160deg,#ffffff_0%,#f4f9f8_52%,#eef6f5_100%)] p-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="mono truncate text-[11px] font-semibold text-[var(--ink-muted)]">{job.jobNumber}</p>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${job.priority.tone}`}>
                    {job.priority.label}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">{job.brand} {job.model}</p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">{shortText(job.issueDescription, 86)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${statusTone(job.status)}`}>{statusLabel(job.status)}</span>
                  <span className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[var(--ink-muted)]">
                    Assigned: {job.assignedTo?.name ?? "Unassigned"}
                  </span>
                  <span className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[var(--ink-muted)]">Age {job.ageDays}d</span>
                </div>

                {typeof job.etaProgress === "number" ? (
                  <div className="mt-2">
                    <div className="h-1.5 rounded-full bg-slate-200">
                      <div
                        className={`h-1.5 rounded-full ${job.etaProgress >= 100 ? "bg-[#D4AF37]" : "bg-[var(--brand)]"}`}
                        style={{ width: `${Math.min(job.etaProgress, 100)}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <p className="mt-2 rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[11px] text-[var(--ink-muted)]">
                  Next: {nextCourse(job)}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    href={`/jobs/${job.id}?returnTo=${encodeURIComponent(dismissSpotlightReturnTo(job.id))}`}
                    className="btn-premium flex-1 rounded-md px-2 py-1.5 text-center text-xs text-white"
                  >
                    Open
                  </Link>
                  <Link
                    href={`/jobs/${job.id}/edit?returnTo=${encodeURIComponent(dismissSpotlightReturnTo(job.id))}`}
                    className="btn-premium-secondary flex-1 rounded-md px-2 py-1.5 text-center text-xs"
                  >
                    Update
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </details>

      <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="mb-2 text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Work Queue</p>
        {sortedJobs.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No jobs in this queue. Try changing filters.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            <ProgressiveList initialCount={5} step={5}>
              {sortedJobs.map((job) => (
                <li key={job.id} className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="mono truncate text-[11px] font-semibold text-[var(--ink-muted)]">{job.jobNumber}</p>
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">{job.brand} {job.model}</p>
                    </div>
                    <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${job.priority.tone}`}>
                      {job.priority.label}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-[var(--ink-muted)]">{shortText(job.issueDescription, 104)}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${statusTone(job.status)}`}>
                      {statusLabel(job.status)}
                    </span>
                    <span className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[var(--ink-muted)]">
                      Assigned: {job.assignedTo?.name ?? "Unassigned"}
                    </span>
                    <span className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[var(--ink-muted)]">Age {job.ageDays}d</span>
                    {job.repairTimeline ? <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 text-[#D4AF37]">ETA {job.repairTimeline}</span> : null}
                    {job.overdue ? <span className="rounded-full border border-black bg-black px-2 py-0.5 text-white">Overdue</span> : null}
                  </div>

                  {typeof job.etaProgress === "number" ? (
                    <div className="mt-2">
                      <div className="h-1.5 rounded-full bg-slate-200">
                        <div
className={`h-1.5 rounded-full ${job.etaProgress >= 100 ? "bg-[#D4AF37]" : "bg-[var(--brand)]"}`}
                          style={{ width: `${Math.min(job.etaProgress, 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--ink-muted)]">Elapsed {Math.floor(job.elapsedMinutes / 60)}h of ETA budget</p>
                    </div>
                  ) : null}

                  <p className="mt-2 rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[11px] text-[var(--ink-muted)]">
                    Next: {nextCourse(job)}
                  </p>

                  {job.timelineNote ? (
                    <p className="mt-2 rounded-md border border-black bg-black px-2 py-1 text-[11px] text-white">Delay note: {shortText(job.timelineNote, 88)}</p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-[var(--ink-muted)]">
                      {user.role === "TECHNICIAN_EXTERNAL" ? "Use Work Order for estimate and timeline updates" : "Use Work Order for repair log and completion updates"}
                    </p>
                    <div className="flex gap-2">
                      <Link href={`/jobs/${job.id}?returnTo=${encodeURIComponent(boardReturnTo)}`} className="btn-premium-secondary rounded-md px-2.5 py-1 text-xs">
                        Open
                      </Link>
                      {job.status === "IN_REPAIR" || job.status === "READY_FOR_PICKUP" ? (
                        <Link href={`/jobs/${job.id}?returnTo=${encodeURIComponent(boardReturnTo)}`} className="btn-premium rounded-md px-2.5 py-1 text-xs text-white">
                          Complete
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ProgressiveList>
          </ul>
        )}
      </div>
    </div>
  );
}
