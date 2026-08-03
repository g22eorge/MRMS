import { requirePortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/currency";
import { PortalHeader } from "@/components/portal/PortalHeader";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function PortalDocumentsPage() {
  const { portalUser, client, org, accessibleClients } = await requirePortalSession();

  // Every document is scoped to THIS client + shop, aggregated across all their
  // repairs into one place. Downloads reuse the per-repair portal PDF routes.
  const jobs = await prisma.job.findMany({
    where: { orgId: org.id, clientId: client.id },
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      jobNumber: true,
      invoice: {
        select: {
          id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, currency: true, status: true, issuedAt: true,
          payments: {
            where: { kind: "PAYMENT" },
            orderBy: { receivedAt: "desc" },
            select: { id: true, amount: true, currency: true, receivedAt: true, method: true },
          },
        },
      },
      quotations: {
        orderBy: { createdAt: "desc" },
        select: { id: true, quoteNumber: true, totalAmount: true, currency: true, status: true, validUntil: true },
      },
    },
  });

  const invoices = jobs
    .filter((j) => j.invoice)
    .map((j) => ({ ...j.invoice!, jobId: j.id, jobNumber: j.jobNumber }));
  const quotations = jobs.flatMap((j) => j.quotations.map((q) => ({ ...q, jobId: j.id, jobNumber: j.jobNumber })));
  const receipts = jobs.flatMap((j) =>
    (j.invoice?.payments ?? []).map((p) => ({ ...p, jobNumber: j.jobNumber, invoiceNumber: j.invoice!.invoiceNumber })),
  );

  const companyName = client.organization || client.fullName;
  const dlClass = "rounded-lg border border-[var(--line)] px-2.5 py-1 text-[12px] font-semibold text-[var(--accent)] hover:bg-[var(--panel-strong)]";
  const cardClass = "overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]";
  const headClass = "border-b border-[var(--line)] px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]";
  const emptyClass = "px-4 py-8 text-center text-[13px] text-[var(--ink-muted)]";
  const rowClass = "flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)]/60 px-4 py-2.5 text-[13px] last:border-0";

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <PortalHeader orgName={org.name} userName={portalUser.name} role={portalUser.role} company={companyName} active="documents" accounts={accessibleClients} activeClientId={client.id} />
      <div>
        <h1 className="text-xl font-black text-[var(--ink)]">Documents</h1>
        <p className="text-[13px] text-[var(--ink-muted)]">Every quotation, invoice and receipt on your account with {org.name}.</p>
      </div>

      {/* Quotations */}
      <section className={cardClass}>
        <p className={headClass}>Quotations ({quotations.length})</p>
        {quotations.length === 0 ? (
          <p className={emptyClass}>No quotations yet.</p>
        ) : (
          quotations.map((q) => (
            <div key={q.id} className={rowClass}>
              <div className="min-w-0">
                <span className="font-mono font-semibold text-[var(--ink)]">{q.quoteNumber}</span>
                <span className="ml-2 text-[var(--ink-muted)]">{q.jobNumber}{q.validUntil ? ` · valid until ${fmtDate(q.validUntil)}` : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums text-[var(--ink)]">{formatMoney(q.totalAmount, q.currency)}</span>
                <span className="rounded-full bg-[var(--panel-strong)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-muted)]">{q.status}</span>
                <a href={`/api/portal/quotation/${q.jobId}`} target="_blank" rel="noopener" className={dlClass}>↓ PDF</a>
              </div>
            </div>
          ))
        )}
      </section>

      {/* Invoices */}
      <section className={cardClass}>
        <p className={headClass}>Invoices ({invoices.length})</p>
        {invoices.length === 0 ? (
          <p className={emptyClass}>No invoices yet.</p>
        ) : (
          invoices.map((inv) => {
            const outstanding = Math.max(0, inv.totalAmount - inv.paidAmount);
            return (
              <div key={inv.id} className={rowClass}>
                <div className="min-w-0">
                  <span className="font-mono font-semibold text-[var(--ink)]">{inv.invoiceNumber}</span>
                  <span className="ml-2 text-[var(--ink-muted)]">{inv.jobNumber} · {fmtDate(inv.issuedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums text-[var(--ink)]">{formatMoney(inv.totalAmount, inv.currency)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${outstanding > 0 ? "bg-red-500/15 text-red-500" : "bg-emerald-500/15 text-emerald-600"}`}>
                    {outstanding > 0 ? `${formatMoney(outstanding, inv.currency)} due` : "Paid"}
                  </span>
                  <a href={`/api/portal/invoice/${inv.jobId}`} target="_blank" rel="noopener" className={dlClass}>↓ PDF</a>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Receipts */}
      <section className={cardClass}>
        <p className={headClass}>Receipts ({receipts.length})</p>
        {receipts.length === 0 ? (
          <p className={emptyClass}>No receipts yet.</p>
        ) : (
          receipts.map((r) => (
            <div key={r.id} className={rowClass}>
              <div className="min-w-0">
                <span className="text-[var(--ink)]">{fmtDate(r.receivedAt)}</span>
                <span className="ml-2 text-[var(--ink-muted)]">{r.invoiceNumber} · {r.method.replaceAll("_", " ")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums text-[var(--ink)]">{formatMoney(r.amount, r.currency)}</span>
                <a href={`/api/portal/receipt/${r.id}`} target="_blank" rel="noopener" className={dlClass}>↓ Receipt</a>
              </div>
            </div>
          ))
        )}
      </section>

      <p className="text-center text-[11px] text-[var(--ink-muted)]">
        Showing documents for {companyName} only.
      </p>
    </div>
  );
}
