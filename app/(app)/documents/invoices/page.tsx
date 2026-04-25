import Link from "next/link";
import { redirect } from "next/navigation";

import { getClientBill } from "@/lib/billing";
import { canGenerateInvoiceForStatus } from "@/lib/documents";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

export default async function InvoicesPage() {
  const { user } = await getCurrentUserRole();
  if (!(["ADMIN", "OPS"].includes(user.role) || can.approveInvoices(user))) {
    redirect("/dashboard");
  }

  const jobs = await prisma.job.findMany({
    where: {
      OR: [
        { status: { in: ["READY_FOR_PICKUP", "COMPLETED", "CLOSED"] } },
        { invoiceIssuedAt: { not: null } },
        { invoiceNumber: { not: null } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      jobNumber: true,
      invoiceNumber: true,
      invoiceIssuedAt: true,
      clientPaid: true,
      status: true,
      clientBill: true,
      updatedAt: true,
      client: { select: { fullName: true } },
    },
  });

  return (
    <section className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">Documents</p>
      <h1 className="mt-1 text-lg font-semibold text-[var(--ink)]">Invoices</h1>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Track issued invoices, payment state, and generate final invoice PDFs.
      </p>
      <div className="panel-shadow mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2">
          <p className="text-[11px] text-[var(--ink-muted)]">
            <span className="font-bold text-[var(--ink)]">{jobs.length}</span> invoice jobs
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--panel-strong)]/50 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">
              <tr>
                <th className="px-4 py-2.5 text-left">Job</th>
                <th className="px-4 py-2.5 text-left">Client</th>
                <th className="px-4 py-2.5 text-left">Invoice #</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5 text-left">Paid</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const amount = getClientBill(job);
                return (
                  <tr key={job.id} className="border-t border-[var(--line)] transition-colors hover:bg-[var(--panel-strong)]/40">
                    <td className="px-4 py-2.5 text-[var(--ink)]">
                      <Link className="mono text-[12px] font-semibold tracking-wide hover:underline" href={`/jobs/${job.id}`}>
                        {job.jobNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--ink-muted)]">{job.client.fullName}</td>
                    <td className="px-4 py-2.5 text-[var(--ink-muted)]">{job.invoiceNumber ?? "-"}</td>
                    <td className="px-4 py-2.5 text-[var(--ink-muted)]">{job.status.replaceAll("_", " ")}</td>
                    <td className="px-4 py-2.5 text-right text-[var(--ink-muted)]">{typeof amount === "number" ? amount.toLocaleString() : "Pending"}</td>
                    <td className="px-4 py-2.5 text-[var(--ink-muted)]">{job.clientPaid ? "Paid" : "Unpaid"}</td>
                    <td className="px-4 py-2.5 text-right">
                      {canGenerateInvoiceForStatus(job.status) ? (
                        <a
                          href={`/api/jobs/${job.id}/invoice`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-premium-secondary inline-flex rounded-md px-2.5 py-1.5 text-xs"
                        >
                          Generate
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--ink-muted)]">Not ready</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {jobs.length === 0 ? (
                <tr className="border-t border-[var(--line)]">
                  <td className="px-4 py-8 text-sm text-[var(--ink-muted)]" colSpan={7}>
                    No invoice-ready jobs yet. Set job status to Ready for Pickup or Completed.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/jobs" className="btn-premium-secondary rounded-lg px-3 py-2 text-sm">
          Open Jobs
        </Link>
        <Link href="/payout-followups" className="btn-premium-secondary rounded-lg px-3 py-2 text-sm">
          Payment Follow-up
        </Link>
      </div>
    </section>
  );
}
