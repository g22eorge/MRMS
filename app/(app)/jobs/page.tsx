import Link from "next/link";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { JobTable, JobRow } from "@/components/jobs/JobTable";
import { StatusFlowNotice } from "@/components/jobs/StatusFlowNotice";
import { JOB_STATUSES, JobStatus } from "@/lib/job-status";
import { getClientBill, getExternalTechBill } from "@/lib/billing";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

type SearchParams = {
  status?: string;
  pricing?: string;
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

const statusOptionLabel: Record<JobStatus, string> = {
  RECEIVED: "Received",
  DIAGNOSING: "Diagnosing",
  AWAITING_APPROVAL: "Awaiting Approval",
  IN_REPAIR: "In Repair",
  READY_FOR_PICKUP: "Ready for Pickup",
  COMPLETED: "Completed",
  CLOSED: "Closed",
  DELIVERED: "Delivered",
};

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
  const pricingFilter = filters.pricing === "needs" || filters.pricing === "priced" ? filters.pricing : "";
  const page = Math.max(Number(filters.page ?? "1") || 1, 1);
  const pageSize = 20;
  const sort = filters.sort === "job_number_desc" ? "job_number_desc" : "received_desc";
  const orderBy = sort === "job_number_desc" ? { jobNumber: "desc" as const } : { receivedAt: "desc" as const };
  const internalCanSearchAll =
    user.role === "TECHNICIAN_INTERNAL"
    && (can.searchJobs(user) || can.approveInvoices(user));

  const whereBase = {
    ...(user.role === "TECHNICIAN_EXTERNAL" || (user.role === "TECHNICIAN_INTERNAL" && !internalCanSearchAll)
      ? { assignedToId: session.user.id }
      : {}),
    ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
    ...(pricingFilter === "needs"
      ? {
          clientBill: null,
          status: { in: ["AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"] as JobStatus[] },
        }
      : pricingFilter === "priced"
        ? { clientBill: { not: null } }
        : {}),
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
                  { client: { phone: { contains: filters.q } } },
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
  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);
  const prevPage = Math.max(page - 1, 1);
  const nextPage = Math.min(page + 1, totalPages);
  const isPrevDisabled = page <= 1;
  const isNextDisabled = page >= totalPages;
  const isExternalTech = user.role === "TECHNICIAN_EXTERNAL";
  const lookupByPhone = can.viewClientInfo(user);

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
      clientBill: getClientBill(job),
      workflowReason: withWorkflow.workflowReason ?? null,
    };
  });

  const preserved = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => typeof value === "string" && value.length > 0),
  ) as Record<string, string>;
  const returnToQuery = new URLSearchParams(preserved).toString();
  const returnTo = returnToQuery ? `/jobs?${returnToQuery}` : "/jobs";
  const openNow = rows.filter((row) => row.status !== "COMPLETED" && row.status !== "CLOSED").length;
  const readyForPickup = rows.filter((row) => row.status === "READY_FOR_PICKUP").length;
  const awaitingApproval = rows.filter((row) => row.status === "AWAITING_APPROVAL").length;
  const pulseBaseFilters = Object.fromEntries(
    Object.entries(preserved).filter(([key]) => key !== "status" && key !== "page"),
  ) as Record<string, string>;

  function pulseHref(statusCsv?: string) {
    const params = new URLSearchParams(pulseBaseFilters);
    if (statusCsv) params.set("status", statusCsv);
    const query = params.toString();
    return query ? `/jobs?${query}` : "/jobs";
  }

  const staleThresholdHours = 24;
  const staleCutoff = new Date();
  staleCutoff.setHours(staleCutoff.getHours() - staleThresholdHours);
  const openStatuses: JobStatus[] = ["RECEIVED", "DIAGNOSING", "AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP"];
  const staleOpenCount = jobs.filter((job) => openStatuses.includes(job.status as JobStatus) && job.updatedAt < staleCutoff).length;
  const unassignedOpenCount = jobs.filter(
    (job) => openStatuses.includes(job.status as JobStatus) && !job.assignedToId,
  ).length;
  const completedCount = rows.filter((row) => row.status === "COMPLETED").length;
  const hasJobsFilters = Boolean(
    filters.q || filters.status || filters.pricing || filters.deviceType || filters.repairPath || filters.from || filters.to || sort === "job_number_desc",
  );
  const briefing = hasJobsFilters
    ? "Filtered queue view is active. Use the signal cards below for live totals and open any work order to apply diagnosis, approval, and repair updates."
    : "Use the signal cards below to monitor queue health, then open each work order to move repairs forward with consistent handoffs.";
  const briefingWithWatch =
    staleOpenCount > 0
      ? `${briefing} Review the Watch card for jobs that have gone ${staleThresholdHours}+ hours without an update.`
      : briefing;
  const quickCards = [
    {
      label: "Active Queue",
      value: String(openNow),
      href: pulseHref("RECEIVED,DIAGNOSING,AWAITING_APPROVAL,IN_REPAIR"),
      accent: "border-[#D4AF37]/30 bg-[#D4AF37]/10",
      tone: "text-[#D4AF37]",
    },
    {
      label: "Ready for Pickup",
      value: String(readyForPickup),
      href: pulseHref("READY_FOR_PICKUP"),
      accent: readyForPickup > 0 ? "border-[#D4AF37] bg-[#D4AF37]" : "border-[var(--line)] bg-[var(--panel)]",
      tone: readyForPickup > 0 ? "text-white" : "text-[var(--ink)]",
    },
    {
      label: "Stale",
      value: String(staleOpenCount),
      href: pulseHref("RECEIVED,DIAGNOSING,AWAITING_APPROVAL,IN_REPAIR"),
      accent: staleOpenCount > 0 ? "border-[#000] bg-[#000]" : "border-[var(--line)] bg-[var(--panel)]",
      tone: staleOpenCount > 0 ? "text-white" : "text-[var(--ink)]",
    },
    {
      label: "Unassigned",
      value: String(unassignedOpenCount),
      href: pulseHref("RECEIVED,DIAGNOSING,AWAITING_APPROVAL"),
      accent: unassignedOpenCount > 0 ? "border-[var(--brand)] bg-[var(--panel-strong)]" : "border-[var(--line)] bg-[var(--panel)]",
      tone: unassignedOpenCount > 0 ? "text-[var(--ink)]" : "text-[var(--ink)]",
    },
    {
      label: "Completed",
      value: String(completedCount),
      href: pulseHref("COMPLETED"),
      accent: "border-[#D4AF37]/30 bg-[#D4AF37]/10",
      tone: "text-[#D4AF37]",
    },
  ];
  const searchInputClass =
    "w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)]/90 px-3 py-2 text-sm outline-none transition focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20";
  const selectControlClass =
    "rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20";
  const desktopControlClass =
    "rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-2 text-sm outline-none transition focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/20";
  const advancedWrapClass =
    "mt-2 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 bg-[linear-gradient(180deg,rgba(212,175,55,0.1),rgba(245,245,245,0.9))] p-2";

  return (
    <div className="space-y-5">
      <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">Executive Brief</p>
          <p className="mt-1 text-sm text-[var(--ink)] [overflow-wrap:anywhere]">{briefingWithWatch}</p>
        </div>
        <div className="grid gap-2 p-3 grid-cols-2 xl:grid-cols-6">
          {quickCards.map((card) => (
            <Link key={card.label} href={card.href} className={`rounded-lg border px-3 py-2 transition hover:-translate-y-[1px] ${card.accent}`}>
              <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">{card.label}</p>
              <p className={`mt-1 text-lg font-semibold ${card.tone}`}>{card.value}</p>
            </Link>
          ))}
        </div>
      </section>

      {can.createJob(user) ? (
        <div className="flex justify-end">
          <Link
            href="/jobs/new"
            className="btn-premium rounded-lg px-3 py-1.5 text-[13px] font-medium sm:py-2 sm:text-sm"
          >
            New Job
          </Link>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Quick Filters</p>
        <p className="text-[11px] text-[var(--ink-muted)]">Keep essentials visible, expand advanced only when needed</p>
      </div>

      {!isExternalTech && can.approveInvoices(user) ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--ink-muted)]">Pricing View:</span>
          <Link
            href="/jobs?pricing=needs&status=AWAITING_APPROVAL,IN_REPAIR,READY_FOR_PICKUP"
            className={`rounded-full border px-2.5 py-1 ${pricingFilter === "needs" ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]" : "border-[var(--line)] bg-[var(--panel)] text-[var(--ink-muted)]"}`}
          >
            Needs pricing
          </Link>
          <Link
            href="/jobs?pricing=priced"
            className={`rounded-full border px-2.5 py-1 ${pricingFilter === "priced" ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]" : "border-[var(--line)] bg-[var(--panel)] text-[var(--ink-muted)]"}`}
          >
            Priced
          </Link>
          {pricingFilter ? (
            <Link href="/jobs" className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[var(--ink-muted)]">
              Clear pricing
            </Link>
          ) : null}
        </div>
      ) : null}

      {isExternalTech ? (
        <>
          <div className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-2 text-xs text-[#D4AF37]">
            External Diagnosis and timeline updates are available inside each work order.
          </div>
          <form className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 lg:hidden">
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Search job #"
              className={searchInputClass}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select name="status" defaultValue={filters.status} className={selectControlClass}>
                <option value="">All statuses</option>
                {JOB_STATUSES.map((status) => (
                  <option key={status} value={status}>{statusOptionLabel[status]}</option>
                ))}
              </select>
              <button className="btn-premium-secondary rounded-lg px-3 py-2 text-sm">Apply</button>
            </div>
            <div className="mt-2 flex justify-end">
              <Link href="/jobs" className="text-xs text-[var(--ink-muted)] underline-offset-2 hover:underline">Reset</Link>
            </div>
            <details className={advancedWrapClass}>
              <summary className="list-none">
                <div className="flex items-center justify-between rounded-md border border-[#D4AF37]/30 bg-[#D4AF37]/10 bg-white/70 px-2 py-1.5">
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--ink-muted)]">Advanced filters</p>
                  <span className="text-xs text-[#D4AF37]">Sort + Date</span>
                </div>
              </summary>
              <div className="mt-2 grid gap-2">
                <select name="sort" defaultValue={sort} className={selectControlClass}>
                  <option value="received_desc">Newest received</option>
                  <option value="job_number_desc">Job number desc</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" name="from" defaultValue={filters.from} className={selectControlClass} />
                  <input type="date" name="to" defaultValue={filters.to} className={selectControlClass} />
                </div>
              </div>
            </details>
          </form>
          <form className="panel-shadow hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 lg:block">
            <div className="grid grid-cols-12 gap-2">
              <input
                name="q"
                defaultValue={filters.q}
                placeholder="Search job #"
                className={`col-span-6 ${desktopControlClass}`}
              />
              <select name="status" defaultValue={filters.status} className={`col-span-3 ${desktopControlClass}`}>
                <option value="">All statuses</option>
                {JOB_STATUSES.map((status) => (
                  <option key={status} value={status}>{statusOptionLabel[status]}</option>
                ))}
              </select>
              <button className="btn-premium-secondary col-span-1 rounded-lg px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm">Apply</button>
              <Link href="/jobs" className="btn-premium-secondary col-span-2 rounded-lg px-3 py-1.5 text-center text-[13px] sm:py-2 sm:text-sm">Reset</Link>
            </div>
            <details className={advancedWrapClass}>
              <summary className="list-none">
                <div className="flex items-center justify-between rounded-md border border-[#D4AF37]/30 bg-[#D4AF37]/10 bg-white/70 px-2 py-1.5">
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--ink-muted)]">Advanced filters</p>
                  <span className="text-xs text-[#D4AF37]">Sort + Date</span>
                </div>
              </summary>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <select name="sort" defaultValue={sort} className={selectControlClass}>
                  <option value="received_desc">Newest received</option>
                  <option value="job_number_desc">Job number desc</option>
                </select>
                <input type="date" name="from" defaultValue={filters.from} className={selectControlClass} />
                <input type="date" name="to" defaultValue={filters.to} className={selectControlClass} />
              </div>
            </details>
          </form>
        </>
      ) : (
        <div className="space-y-2">
          <form className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 lg:hidden">
            <input
              name="q"
              defaultValue={filters.q}
              placeholder={lookupByPhone ? "Search job # or phone" : "Search job # or client"}
              className={searchInputClass}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select name="status" defaultValue={filters.status} className={selectControlClass}>
                <option value="">All statuses</option>
                {JOB_STATUSES.map((status) => (
                  <option key={status} value={status}>{statusOptionLabel[status]}</option>
                ))}
              </select>
              <button className="btn-premium-secondary rounded-lg px-3 py-2 text-sm">Apply</button>
            </div>
            <div className="mt-2 flex justify-end">
              <Link href="/jobs" className="text-xs text-[var(--ink-muted)] underline-offset-2 hover:underline">Reset</Link>
            </div>
            <details className={advancedWrapClass}>
              <summary className="list-none">
                <div className="flex items-center justify-between rounded-md border border-[#D4AF37]/30 bg-[#D4AF37]/10 bg-white/70 px-2 py-1.5">
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--ink-muted)]">Advanced filters</p>
                  <span className="text-xs text-[#D4AF37]">Device + Path + Date</span>
                </div>
              </summary>
              <div className="mt-2 grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <select name="deviceType" defaultValue={filters.deviceType} className={selectControlClass}>
                    <option value="">All devices</option>
                    <option value="PHONE_ANDROID">Android</option>
                    <option value="PHONE_IPHONE">iPhone</option>
                    <option value="TABLET">Tablet</option>
                    <option value="WINDOWS_PC">Windows PC</option>
                    <option value="MAC">Mac</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <select name="repairPath" defaultValue={filters.repairPath} className={selectControlClass}>
                    <option value="">All paths</option>
                    <option value="IN_HOUSE">In-house</option>
                    <option value="EXTERNAL">External</option>
                  </select>
                  {can.approveInvoices(user) ? (
                    <select name="pricing" defaultValue={pricingFilter} className={selectControlClass}>
                      <option value="">All pricing</option>
                      <option value="needs">Needs pricing</option>
                      <option value="priced">Priced</option>
                    </select>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" name="from" defaultValue={filters.from} className={selectControlClass} />
                  <input type="date" name="to" defaultValue={filters.to} className={selectControlClass} />
                </div>
                <select name="sort" defaultValue={sort} className={selectControlClass}>
                  <option value="received_desc">Newest received</option>
                  <option value="job_number_desc">Job number desc</option>
                </select>
              </div>
            </details>
          </form>
          <form className="panel-shadow hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 lg:block">
            <div className="grid grid-cols-12 gap-2">
              <input
                name="q"
                defaultValue={filters.q}
                placeholder={lookupByPhone ? "Search job # or phone" : "Search job # or client"}
                className={`col-span-6 ${desktopControlClass}`}
              />
              <select name="status" defaultValue={filters.status} className={`col-span-3 ${desktopControlClass}`}>
                <option value="">All statuses</option>
                {JOB_STATUSES.map((status) => (
                  <option key={status} value={status}>{statusOptionLabel[status]}</option>
                ))}
              </select>
              <button className="btn-premium-secondary col-span-1 rounded-lg px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm">Apply</button>
              <Link href="/jobs" className="btn-premium-secondary col-span-2 rounded-lg px-3 py-1.5 text-center text-[13px] sm:py-2 sm:text-sm">Reset</Link>
            </div>
            <details className={advancedWrapClass}>
              <summary className="list-none">
                <div className="flex items-center justify-between rounded-md border border-[#D4AF37]/30 bg-[#D4AF37]/10 bg-white/70 px-2 py-1.5">
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--ink-muted)]">Advanced filters</p>
                  <span className="text-xs text-[#D4AF37]">Device + Path + Date</span>
                </div>
              </summary>
              <div className={`mt-2 grid gap-2 ${can.approveInvoices(user) ? "grid-cols-6" : "grid-cols-5"}`}>
                <select name="deviceType" defaultValue={filters.deviceType} className={selectControlClass}>
                  <option value="">All devices</option>
                  <option value="PHONE_ANDROID">Phone Android</option>
                  <option value="PHONE_IPHONE">Phone iPhone</option>
                  <option value="TABLET">Tablet</option>
                  <option value="WINDOWS_PC">Windows PC</option>
                  <option value="MAC">Mac</option>
                  <option value="OTHER">Other</option>
                </select>
                <select name="repairPath" defaultValue={filters.repairPath} className={selectControlClass}>
                  <option value="">All paths</option>
                  <option value="IN_HOUSE">In-house</option>
                  <option value="EXTERNAL">External</option>
                </select>
                {can.approveInvoices(user) ? (
                  <select name="pricing" defaultValue={pricingFilter} className={selectControlClass}>
                    <option value="">All pricing</option>
                    <option value="needs">Needs pricing</option>
                    <option value="priced">Priced</option>
                  </select>
                ) : null}
                <select name="sort" defaultValue={sort} className={selectControlClass}>
                  <option value="received_desc">Newest received</option>
                  <option value="job_number_desc">Job number desc</option>
                </select>
                <input type="date" name="from" defaultValue={filters.from} className={selectControlClass} />
                <input type="date" name="to" defaultValue={filters.to} className={selectControlClass} />
              </div>
            </details>
          </form>
          <StatusFlowNotice message="Status flow: RECEIVED -> DIAGNOSING -> AWAITING_APPROVAL -> IN_REPAIR -> READY_FOR_PICKUP -> COMPLETED or CLOSED. Use job workflow notes for parts pending, specialist escalation, or closure reason." />
        </div>
      )}

      <div className="panel-shadow flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-sm text-[var(--ink-muted)]">
        <p>
          Showing <span className="font-semibold text-[var(--ink)]">{pageStart}-{pageEnd}</span> of <span className="font-semibold text-[var(--ink)]">{total}</span>
        </p>
        <div className="flex gap-2">
          <Link
            href={`?${new URLSearchParams({ ...preserved, page: String(prevPage) }).toString()}`}
            aria-disabled={isPrevDisabled}
            className={`btn-premium-secondary rounded-lg px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm ${isPrevDisabled ? "pointer-events-none opacity-50" : ""}`}
          >
            Prev
          </Link>
          <span className="inline-flex items-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-xs font-medium text-[var(--ink-muted)]">
            Page {page} / {totalPages}
          </span>
          <Link
            href={`?${new URLSearchParams({ ...preserved, page: String(nextPage) }).toString()}`}
            aria-disabled={isNextDisabled}
            className={`btn-premium-secondary rounded-lg px-3 py-1.5 text-[13px] sm:py-2 sm:text-sm ${isNextDisabled ? "pointer-events-none opacity-50" : ""}`}
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
          permissions={user.permissions}
          canDelete={user.role === "ADMIN"}
          deleteAction={deleteJobAction}
          returnTo={returnTo}
        />
      )}
    </div>
  );
}
