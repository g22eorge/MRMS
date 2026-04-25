import Link from "next/link";
import { redirect } from "next/navigation";

import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";
import { formatEATDate } from "@/lib/date-eat";

export default async function JobCardsPage() {
  const { user } = await getCurrentUserRole();
  if (!can.generateJobCards(user)) {
    redirect("/dashboard");
  }

  const jobs = await prisma.job.findMany({
    orderBy: { receivedAt: "desc" },
    take: 80,
    select: {
      id: true,
      jobNumber: true,
      status: true,
      brand: true,
      model: true,
      receivedAt: true,
      client: { select: { fullName: true } },
    },
  });

  return (
    <section className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Documents</p>
      <h1 className="mt-1 text-lg font-semibold text-[var(--ink)]">Job Cards</h1>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Intake records for received and active jobs. Generate printable PDFs directly from this queue.
      </p>
      <div className="panel-shadow mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2">
          <p className="text-[11px] text-[var(--ink-muted)]">
            <span className="font-bold text-[var(--ink)]">{jobs.length}</span> jobs
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--panel-strong)]/50 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">
              <tr>
                <th className="px-4 py-2.5 text-left">Job</th>
                <th className="px-4 py-2.5 text-left">Client</th>
                <th className="px-4 py-2.5 text-left">Device</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Received</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-[var(--line)] transition-colors hover:bg-[var(--panel-strong)]/40">
                  <td className="px-4 py-2.5 text-[var(--ink)]">
                    <Link className="mono text-[12px] font-semibold tracking-wide hover:underline" href={`/jobs/${job.id}`}>
                      {job.jobNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--ink-muted)]">{job.client.fullName}</td>
                  <td className="px-4 py-2.5 text-[var(--ink-muted)]">{job.brand} {job.model}</td>
                  <td className="px-4 py-2.5 text-[var(--ink-muted)]">{job.status.replaceAll("_", " ")}</td>
                  <td className="px-4 py-2.5 text-[var(--ink-muted)]">{formatEATDate(job.receivedAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <a
                      href={`/api/jobs/${job.id}/job-card`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-premium-secondary inline-flex rounded-md px-2.5 py-1.5 text-xs"
                    >
                      Generate
                    </a>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 ? (
                <tr className="border-t border-[var(--line)]">
                  <td className="px-4 py-8 text-sm text-[var(--ink-muted)]" colSpan={6}>
                    No jobs yet. Create a job first to generate its job card.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/jobs" className="btn-premium-secondary rounded-lg px-3 py-2 text-sm">Open Jobs</Link>
      </div>
    </section>
  );
}
