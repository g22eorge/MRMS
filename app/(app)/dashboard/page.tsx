import { JobStatus } from "@prisma/client";
import Link from "next/link";

import { getClientBill } from "@/lib/billing";
import { formatMoney, getAppCurrency } from "@/lib/currency";
import { getJobPayoutsByIds } from "@/lib/payouts";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

export default async function DashboardPage() {
  const { session, user } = await getCurrentUserRole();

  if (user.role === "TECHNICIAN_EXTERNAL") {
    const jobs = await prisma.job.findMany({
      where: { assignedToId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        repairPath: true,
      },
    });

    const payouts = await getJobPayoutsByIds(jobs.map((job) => job.id));

    const currency = getAppCurrency();
    const openCount = jobs.filter((job) => ["RECEIVED", "DIAGNOSING", "REFERRED", "AWAITING_APPROVAL", "IN_REPAIR"].includes(job.status)).length;
    const completedCount = jobs.filter((job) => job.status === "COMPLETED").length;
    const paidTotal = jobs
      .filter((job) => payouts.get(job.id)?.externalPaid && typeof payouts.get(job.id)?.externalTechFee === "number")
      .reduce((sum, job) => sum + (payouts.get(job.id)?.externalTechFee ?? 0), 0);
    const outstandingTotal = jobs
      .filter(
        (job) =>
          job.status === "COMPLETED" &&
          !payouts.get(job.id)?.externalPaid &&
          typeof payouts.get(job.id)?.externalTechFee === "number",
      )
      .reduce((sum, job) => sum + (payouts.get(job.id)?.externalTechFee ?? 0), 0);

    return (
      <div className="space-y-5">
        <section className="panel-shadow rounded-2xl border border-[var(--line)] bg-[linear-gradient(120deg,#0f766e_0%,#115e59_52%,#164e63_100%)] p-5 text-white md:p-7">
          <p className="text-xs uppercase tracking-[0.2em] text-white/70">Technician Overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">My Work & Payouts</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/85">Track your assigned jobs and external payout status in one view.</p>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          <Link href="/technicians" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Assigned Jobs</p>
            <p className="mt-2 text-4xl font-semibold">{jobs.length}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Open queue →</p>
          </Link>
          <Link href="/technicians?ready=1" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Open Jobs</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--brand)]">{openCount}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Jobs needing action →</p>
          </Link>
          <Link href="/jobs?status=COMPLETED" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Completed</p>
            <p className="mt-2 text-4xl font-semibold text-emerald-700">{completedCount}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Completed jobs →</p>
          </Link>
          <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Payout Outstanding</p>
            <p className="mt-2 text-3xl font-semibold text-amber-700">{formatMoney(outstandingTotal, currency)}</p>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">Paid to date: {formatMoney(paidTotal, currency)}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">
              <Link href="/technicians/payouts">View payout breakdown →</Link>
            </p>
          </div>
        </div>

        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-sm font-semibold">Recent Assigned Jobs</p>
          {jobs.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No assigned jobs yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {jobs.slice(0, 6).map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{job.jobNumber}</p>
                    <p className="text-xs text-[var(--ink-muted)]">{job.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--ink-muted)]">Fee</p>
                    <p className="font-medium">{formatMoney(payouts.get(job.id)?.externalTechFee ?? 0, currency)}</p>
                    <p className={`text-xs ${payouts.get(job.id)?.externalPaid ? "text-emerald-700" : "text-amber-700"}`}>
                      {payouts.get(job.id)?.externalPaid ? "Paid" : "Unpaid"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (user.role === "TECHNICIAN_INTERNAL") {
    const assignedJobs = await prisma.job.findMany({
      where: { assignedToId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, jobNumber: true, status: true, brand: true, model: true },
    });

    const diagnosing = assignedJobs.filter((job) => job.status === "DIAGNOSING").length;
    const inRepair = assignedJobs.filter((job) => job.status === "IN_REPAIR").length;
    const completed = assignedJobs.filter((job) => job.status === "COMPLETED").length;

    return (
      <div className="space-y-5">
        <section className="panel-shadow rounded-2xl border border-[var(--line)] bg-[linear-gradient(120deg,#0f766e_0%,#115e59_52%,#164e63_100%)] p-5 text-white md:p-7">
          <p className="text-xs uppercase tracking-[0.2em] text-white/70">Technician Overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">My Repair Queue</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/85">Focus on jobs currently assigned to you.</p>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          <Link href="/jobs" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Assigned</p>
            <p className="mt-2 text-4xl font-semibold">{assignedJobs.length}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">View my jobs →</p>
          </Link>
          <Link href="/jobs?status=DIAGNOSING" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Diagnosing</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--brand)]">{diagnosing}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Needs diagnosis work →</p>
          </Link>
          <Link href="/jobs?status=IN_REPAIR" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">In Repair</p>
            <p className="mt-2 text-4xl font-semibold text-amber-700">{inRepair}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Active repairs →</p>
          </Link>
          <Link href="/jobs?status=COMPLETED" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Completed</p>
            <p className="mt-2 text-4xl font-semibold text-emerald-700">{completed}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Completed repairs →</p>
          </Link>
        </div>

        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-sm font-semibold">Recent Assigned Jobs</p>
          {assignedJobs.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No assigned jobs yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {assignedJobs.slice(0, 6).map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-2">
                  <p className="truncate font-medium">{job.jobNumber} - {job.brand} {job.model}</p>
                  <span className="text-xs text-[var(--ink-muted)]">{job.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (user.role === "ACCOUNTS") {
    const currency = getAppCurrency();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [completedThisMonth, pendingBilling, externalCompleted] = await Promise.all([
      prisma.job.findMany({
        where: { status: "COMPLETED", completedAt: { gte: monthStart, lte: monthEnd } },
        select: { id: true, jobNumber: true, completedAt: true },
      }),
      prisma.job.count({
        where: {
          status: { in: ["IN_REPAIR", "AWAITING_APPROVAL", "REFERRED"] },
        },
      }),
      prisma.job.findMany({
        where: { status: "COMPLETED", repairPath: "EXTERNAL" },
        select: { id: true },
      }),
    ]);

    const completedRows = await prisma.job.findMany({
      where: { id: { in: completedThisMonth.map((job) => job.id) } },
    });
    const monthRevenue = completedRows.reduce((sum, job) => sum + (getClientBill(job) ?? 0), 0);

    const payoutMap = await getJobPayoutsByIds(externalCompleted.map((job) => job.id));
    const payoutOutstanding = externalCompleted
      .map((job) => payoutMap.get(job.id))
      .filter((row) => row && !row.externalPaid)
      .reduce((sum, row) => sum + (row?.externalTechFee ?? 0), 0);

    return (
      <div className="space-y-5">
        <section className="panel-shadow rounded-2xl border border-[var(--line)] bg-[linear-gradient(120deg,#0f766e_0%,#115e59_52%,#164e63_100%)] p-5 text-white md:p-7">
          <p className="text-xs uppercase tracking-[0.2em] text-white/70">Accounts Overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Billing & Payout Control</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/85">Monitor client billing, completed jobs, and unpaid external payouts.</p>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          <Link href="/reports" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Revenue this month</p>
            <p className="mt-2 text-3xl font-semibold">{formatMoney(monthRevenue, currency)}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Open reports →</p>
          </Link>
          <Link href="/jobs?status=COMPLETED" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Completed this month</p>
            <p className="mt-2 text-4xl font-semibold text-emerald-700">{completedThisMonth.length}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Review completed jobs →</p>
          </Link>
          <Link href="/jobs?status=IN_REPAIR,AWAITING_APPROVAL,REFERRED" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Pending billing path</p>
            <p className="mt-2 text-4xl font-semibold text-amber-700">{pendingBilling}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Jobs before completion →</p>
          </Link>
          <Link href="/reports" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">External payouts due</p>
            <p className="mt-2 text-3xl font-semibold text-rose-700">{formatMoney(payoutOutstanding, currency)}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Track payouts →</p>
          </Link>
        </div>
      </div>
    );
  }

  if (user.role === "OPS") {
    const [awaitingApproval, referred, inRepair, recentApprovals] = await Promise.all([
      prisma.job.count({ where: { status: "AWAITING_APPROVAL" } }),
      prisma.job.count({ where: { status: "REFERRED" } }),
      prisma.job.count({ where: { status: "IN_REPAIR" } }),
      prisma.job.findMany({
        where: { status: { in: ["AWAITING_APPROVAL", "REFERRED"] } },
        include: { client: true },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
    ]);

    return (
      <div className="space-y-5">
        <section className="panel-shadow rounded-2xl border border-[var(--line)] bg-[linear-gradient(120deg,#0f766e_0%,#115e59_52%,#164e63_100%)] p-5 text-white md:p-7">
          <p className="text-xs uppercase tracking-[0.2em] text-white/70">Operations Overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Client Approval Pipeline</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/85">Manage referrals, approvals, and transitions into active repair.</p>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/jobs?status=AWAITING_APPROVAL" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Awaiting approval</p>
            <p className="mt-2 text-4xl font-semibold text-amber-700">{awaitingApproval}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Call/update clients →</p>
          </Link>
          <Link href="/jobs?status=REFERRED" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Referred</p>
            <p className="mt-2 text-4xl font-semibold">{referred}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">External estimates pending →</p>
          </Link>
          <Link href="/jobs?status=IN_REPAIR" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">In repair</p>
            <p className="mt-2 text-4xl font-semibold text-emerald-700">{inRepair}</p>
            <p className="mt-3 text-xs font-medium text-[var(--brand)]">Active jobs →</p>
          </Link>
        </div>

        <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-sm font-semibold">Recent Approval Queue</p>
          {recentApprovals.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No approval actions pending.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentApprovals.map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-2">
                  <p className="truncate font-medium">{job.jobNumber} - {job.client.fullName}</p>
                  <span className="text-xs text-[var(--ink-muted)]">{job.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  const [totalJobs, openJobs, completedJobs] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({ where: { status: { in: [JobStatus.RECEIVED, JobStatus.DIAGNOSING, JobStatus.IN_REPAIR, JobStatus.REFERRED, JobStatus.AWAITING_APPROVAL] } } }),
    prisma.job.count({ where: { status: JobStatus.COMPLETED } }),
  ]);

  return (
    <div className="space-y-5">
      <section className="panel-shadow rounded-2xl border border-[var(--line)] bg-[linear-gradient(120deg,#0f766e_0%,#115e59_52%,#164e63_100%)] p-5 text-white md:p-7">
        <p className="text-xs uppercase tracking-[0.2em] text-white/70">Operations Overview</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Repair Workbench</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85">
          Keep intake, diagnostics, approvals, and closure in one live queue with role-safe visibility.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/jobs" className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Total Jobs</p>
          <p className="mt-2 text-4xl font-semibold">{totalJobs}</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">All time recorded repairs</p>
          <p className="mt-3 text-xs font-medium text-[var(--brand)]">View all jobs →</p>
        </Link>
        <Link
          href="/jobs?status=RECEIVED,DIAGNOSING,REFERRED,AWAITING_APPROVAL,IN_REPAIR"
          className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Open Jobs</p>
          <p className="mt-2 text-4xl font-semibold text-[var(--brand)]">{openJobs}</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Awaiting active team action</p>
          <p className="mt-3 text-xs font-medium text-[var(--brand)]">View open queue →</p>
        </Link>
        <Link
          href="/jobs?status=COMPLETED"
          className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 transition hover:-translate-y-[2px]"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">Completed</p>
          <p className="mt-2 text-4xl font-semibold text-emerald-700">{completedJobs}</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">Delivered successfully</p>
          <p className="mt-3 text-xs font-medium text-[var(--brand)]">View completed jobs →</p>
        </Link>
      </div>
    </div>
  );
}
