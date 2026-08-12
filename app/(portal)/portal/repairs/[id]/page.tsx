import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { requirePortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/currency";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { approveQuotationAction, postRepairMessageAction } from "./actions";

export const dynamic = "force-dynamic";

// Customer-facing repair steps (internal workshop sub-states are collapsed).
const STEPS = ["RECEIVED", "DIAGNOSING", "AWAITING_APPROVAL", "IN_REPAIR", "READY_FOR_PICKUP", "COMPLETED"] as const;
const STEP_LABEL: Record<string, string> = {
  RECEIVED: "Received",
  DIAGNOSING: "Diagnosis",
  AWAITING_APPROVAL: "Awaiting your approval",
  IN_REPAIR: "In repair",
  READY_FOR_PICKUP: "Ready for collection",
  COMPLETED: "Completed",
};
const STEP_INDEX: Record<string, number> = {
  RECEIVED: 0, INTAKE: 0,
  DIAGNOSING: 1, REFERRED: 1,
  AWAITING_APPROVAL: 2,
  IN_REPAIR: 3,
  READY_FOR_PICKUP: 4,
  COMPLETED: 5, CLOSED: 5, DELIVERED: 5,
};

function fmtDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function PortalRepairDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { portalUser, client, org, accessibleClients } = await requirePortalSession();

  // Isolation: the repair must belong to THIS customer + shop, or it doesn't exist.
  const job = await prisma.job.findFirst({
    where: { id, orgId: org.id, clientId: client.id },
    select: {
      id: true, jobNumber: true, status: true, statusNote: true,
      brand: true, model: true, deviceType: true, serialOrImei: true,
      receivedAt: true, completedAt: true,
      warrantyMonths: true, warrantyExpiresAt: true,
      quotations: {
        select: { id: true, quoteNumber: true, status: true, totalAmount: true, currency: true, validUntil: true, sentAt: true },
        orderBy: { createdAt: "desc" },
      },
      invoice: {
        select: {
          id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, currency: true, status: true,
          payments: { where: { kind: "PAYMENT" }, select: { id: true, amount: true, currency: true, method: true, receivedAt: true }, orderBy: { receivedAt: "desc" } },
        },
      },
      // Only photos staff have marked visible to the client.
      photos: {
        where: { visibility: "CLIENT" },
        select: { id: true, url: true, label: true, uploadedAt: true },
        orderBy: { uploadedAt: "desc" },
      },
    },
  });
  if (!job) notFound();

  // Assessment report — only customer-visible ones (INTERNAL drafts never show).
  const [reports, warranties, history, messages] = await Promise.all([
    prisma.diagnosisReport.findMany({
      where: { orgId: org.id, jobId: job.id, NOT: { visibility: "INTERNAL" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, summary: true, findings: true, recommendedWork: true, riskNotes: true, createdAt: true },
    }),
    prisma.warrantyClaim.findMany({
      where: { orgId: org.id, originalJobId: job.id },
      orderBy: { openedAt: "desc" },
      select: { id: true, status: true, reason: true, resolution: true, openedAt: true, closedAt: true },
    }),
    prisma.jobStatusHistory.findMany({
      where: { orgId: org.id, jobId: job.id },
      orderBy: { changedAt: "asc" },
      select: { toStatus: true, changedAt: true, reason: true },
    }),
    prisma.repairMessage.findMany({
      where: { orgId: org.id, jobId: job.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, authorType: true, authorName: true, body: true, createdAt: true },
    }),
  ]);

  const currentStep = STEP_INDEX[job.status] ?? 0;
  const companyName = client.organization || client.fullName;
  const device = [job.brand, job.model].filter(Boolean).join(" ") || "Device";

  const invoice = job.invoice;
  const outstanding = invoice ? Math.max(0, invoice.totalAmount - invoice.paidAmount) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <PortalHeader orgName={org.name} userName={portalUser.name} role={portalUser.role} company={companyName} active="repairs" accounts={accessibleClients} activeClientId={client.id} />

      <div className="flex items-center justify-between gap-2">
        <Link href="/portal/repairs" className="text-[0.8125rem] text-[var(--ink-muted)] hover:text-[var(--ink)]">← All repairs</Link>
        <Link href={`/portal/complaints?ref=${job.id}`} className="text-[0.8125rem] font-semibold text-red-500 hover:text-red-600 hover:underline">Report an issue</Link>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="mono text-lg font-black text-[var(--ink)]">{job.jobNumber}</p>
            <p className="text-[0.8125rem] text-[var(--ink-muted)]">{device}{job.serialOrImei ? ` · ${job.serialOrImei}` : ""}</p>
          </div>
          <span className="rounded-full bg-[var(--accent)]/15 px-3 py-1 text-[0.75rem] font-bold text-[var(--accent)]">
            {STEP_LABEL[job.status] ?? job.status.replaceAll("_", " ")}
          </span>
        </div>
        {job.statusNote ? <p className="mt-2 rounded-lg bg-[var(--panel-strong)]/50 px-3 py-2 text-[0.8125rem] text-[var(--ink)]">{job.statusNote}</p> : null}
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="mb-3 text-[0.75rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Progress</p>
        <ol className="space-y-2">
          {STEPS.map((step, i) => {
            const done = i < currentStep;
            const current = i === currentStep;
            return (
              <li key={step} className="flex items-center gap-3 text-[0.8125rem]">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold ${done ? "bg-emerald-500 text-white" : current ? "bg-[var(--accent)] text-black" : "bg-[var(--panel-strong)] text-[var(--ink-muted)]"}`}>
                  {done ? "✓" : i + 1}
                </span>
                <span className={current ? "font-semibold text-[var(--ink)]" : done ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"}>{STEP_LABEL[step]}</span>
              </li>
            );
          })}
        </ol>
        {history.length > 0 ? (
          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <p className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">History</p>
            <ul className="space-y-1">
              {history.map((h, i) => (
                <li key={i} className="flex justify-between text-[0.75rem] text-[var(--ink-muted)]">
                  <span>{STEP_LABEL[h.toStatus] ?? h.toStatus.replaceAll("_", " ")}</span>
                  <span>{fmtDate(h.changedAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Assessment report — clean summary + neat downloadable PDF */}
      {reports.length > 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[0.75rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Assessment Report</p>
            <a href={`/api/portal/assessment/${job.id}`} target="_blank" rel="noopener" className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem] font-semibold text-white">
              ↓ Download PDF
            </a>
          </div>
          <p className="text-[0.8125rem] text-[var(--ink)]">{reports[0].summary}</p>
          <p className="mt-1 text-[0.75rem] text-[var(--ink-muted)]">Download the PDF for the full findings, recommended work, cost and warranty details.</p>
        </div>
      ) : null}

      {/* Repair photos shared by the shop */}
      {job.photos.length > 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Repair Photos ({job.photos.length})</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {job.photos.map((ph) => (
              <a key={ph.id} href={`/api/photos/${ph.id}`} target="_blank" rel="noopener" className="group relative block overflow-hidden rounded-lg border border-[var(--line)]">
                <Image src={`/api/photos/${ph.id}`} alt={ph.label ?? "Repair photo"} width={300} height={200} unoptimized className="h-28 w-full object-cover transition group-hover:opacity-90" />
                {ph.label ? <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[0.625rem] font-semibold capitalize text-white">{ph.label}</span> : null}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {/* Quotation */}
      {job.quotations.length > 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Quotation</p>
          {job.quotations.map((q) => (
            <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)]/60 py-2 text-[0.8125rem] last:border-0">
              <div>
                <span className="mono font-semibold text-[var(--ink)]">{q.quoteNumber}</span>
                {q.validUntil ? <span className="ml-2 text-[0.75rem] text-[var(--ink-muted)]">valid until {fmtDate(q.validUntil)}</span> : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums text-[var(--ink)]">{formatMoney(q.totalAmount, q.currency)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${q.status === "ACCEPTED" ? "bg-emerald-500/15 text-emerald-600" : q.status === "REJECTED" ? "bg-red-500/15 text-red-500" : "bg-[var(--panel-strong)] text-[var(--ink-muted)]"}`}>{q.status}</span>
                <a href={`/api/portal/quotation/${job.id}`} target="_blank" rel="noopener" className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[0.75rem] font-semibold text-[var(--accent)] hover:bg-[var(--panel-strong)]">↓ PDF</a>
                {q.status === "SENT" ? (
                  <form action={approveQuotationAction}>
                    <input type="hidden" name="quotationId" value={q.id} />
                    <input type="hidden" name="jobId" value={job.id} />
                    <button type="submit" className="rounded-lg bg-emerald-600 px-3 py-1 text-[0.75rem] font-semibold text-white transition hover:bg-emerald-700">
                      Approve
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Financials */}
      {invoice ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[0.75rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Billing</p>
            <a href={`/api/portal/invoice/${job.id}`} target="_blank" rel="noopener" className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[0.75rem] font-semibold text-[var(--accent)] hover:bg-[var(--panel-strong)]">↓ Invoice</a>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-[0.9375rem] font-bold tabular-nums text-[var(--ink)]">{formatMoney(invoice.totalAmount, invoice.currency)}</p><p className="text-[0.6875rem] text-[var(--ink-muted)]">Total</p></div>
            <div><p className="text-[0.9375rem] font-bold tabular-nums text-emerald-600">{formatMoney(invoice.paidAmount, invoice.currency)}</p><p className="text-[0.6875rem] text-[var(--ink-muted)]">Paid</p></div>
            <div><p className={`text-[0.9375rem] font-bold tabular-nums ${outstanding > 0 ? "text-red-500" : "text-[var(--ink-muted)]"}`}>{formatMoney(outstanding, invoice.currency)}</p><p className="text-[0.6875rem] text-[var(--ink-muted)]">Outstanding</p></div>
          </div>
          {invoice.payments.length > 0 ? (
            <div className="mt-3 border-t border-[var(--line)] pt-3">
              <p className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Receipts</p>
              <ul className="space-y-1">
                {invoice.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-[0.75rem]">
                    <span className="text-[var(--ink-muted)]">{fmtDate(p.receivedAt)} · {formatMoney(p.amount, p.currency)}</span>
                    <a href={`/api/portal/receipt/${p.id}`} target="_blank" rel="noopener" className="font-semibold text-[var(--accent)] hover:underline">↓ Receipt</a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Messages / notes */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Messages</p>
        {messages.length === 0 ? (
          <p className="mb-3 text-[0.8125rem] text-[var(--ink-muted)]">No messages yet. Ask a question or leave a note for the team.</p>
        ) : (
          <ul className="mb-3 space-y-2">
            {messages.map((m) => {
              const mine = m.authorType === "CUSTOMER";
              return (
                <li key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[0.8125rem] ${mine ? "bg-[var(--accent)]/15 text-[var(--ink)]" : "bg-[var(--panel-strong)] text-[var(--ink)]"}`}>
                    {m.body}
                  </div>
                  <span className="mt-0.5 text-[0.6875rem] text-[var(--ink-muted)]">
                    {mine ? "You" : m.authorName} · {m.createdAt.toISOString().slice(0, 10)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <form action={postRepairMessageAction} className="flex gap-2">
          <input type="hidden" name="jobId" value={job.id} />
          <input
            name="body"
            required
            maxLength={4000}
            placeholder="Write a message…"
            className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50"
          />
          <button type="submit" className="btn-premium rounded-lg px-3 py-2 text-[0.8125rem] text-white">Send</button>
        </form>
      </div>

      {/* Warranty coverage */}
      {job.warrantyExpiresAt ? (
        (() => {
          const active = job.warrantyExpiresAt >= new Date();
          return (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <p className="mb-1 text-[0.75rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Warranty</p>
              <p className="text-[0.8125rem]">
                <span className={`mr-2 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${active ? "bg-emerald-500/15 text-emerald-600" : "bg-[var(--panel-strong)] text-[var(--ink-muted)]"}`}>
                  {active ? "Active" : "Expired"}
                </span>
                <span className="text-[var(--ink)]">
                  {job.warrantyMonths}-month warranty {active ? "covering this repair until" : "expired on"} {fmtDate(job.warrantyExpiresAt)}.
                </span>
              </p>
            </div>
          );
        })()
      ) : null}

      {/* Warranty claims */}
      {warranties.length > 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Warranty</p>
          {warranties.map((w) => (
            <div key={w.id} className="text-[0.8125rem]">
              <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${w.status === "OPEN" ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600"}`}>{w.status}</span>
              <span className="ml-2 text-[var(--ink)]">{w.reason}</span>
              {w.resolution ? <p className="mt-1 text-[0.75rem] text-[var(--ink-muted)]">{w.resolution}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
