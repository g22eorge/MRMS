export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";
import { requireOrgSession } from "@/lib/org-context";
import { requireModule, OrgModule } from "@/lib/module-access";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATDate, formatEATTime } from "@/lib/date-eat";
import type { BadgeTone } from "@/components/ui/StatusBadge";
import Link from "next/link";
import { sanitizeText } from "@/lib/sanitize";
import { shareRefundDocument } from "@/lib/notifications/share-document";
import { DocumentActionBar } from "@/components/documents/DocumentActionBar";
import { DocumentSummaryRail } from "@/components/documents/DocumentSummaryRail";

const cardClass = "overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]";
const cardHeadClass = "border-b border-[var(--line)] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]";
const clientSelect = { fullName: true, phone: true, email: true, organization: true, address: true } as const;

export default async function RefundDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  await requireModule(OrgModule.INVOICING);
  const { user } = await getCurrentUserRole();
  if (!can.viewFinancials(user) && !["ADMIN", "OPS", "MANAGER", "FINANCE"].includes(user.role)) redirect("/dashboard");
  if (!user.orgId) redirect("/dashboard");
  const orgId = user.orgId;

  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const sent = typeof sp.sent === "string" ? sp.sent : undefined;

  const refund = await prisma.refund.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      amount: true,
      currency: true,
      method: true,
      reference: true,
      note: true,
      refundedAt: true,
      createdBy: { select: { name: true } },
      invoice: { select: { id: true, invoiceNumber: true, client: { select: clientSelect }, job: { select: { id: true, jobNumber: true, client: { select: clientSelect } } } } },
      sale: { select: { id: true, saleNumber: true, client: { select: clientSelect } } },
      creditNote: { select: { id: true, creditNoteNumber: true, sale: { select: { client: { select: clientSelect } } } } },
    },
  });
  if (!refund) redirect("/documents/refunds");

  const org = await prisma.organization.findFirst({ where: { id: orgId }, select: { baseCurrency: true } });
  const currency = normalizeCurrency(org?.baseCurrency, normalizeCurrency(refund.currency, "UGX"));
  const client = refund.invoice?.job?.client ?? refund.invoice?.client ?? refund.sale?.client ?? refund.creditNote?.sale?.client ?? null;
  const canSend = can.viewFinancials(user) || ["ADMIN", "OPS", "MANAGER", "FINANCE"].includes(user.role);
  const methodLabel = refund.method.replaceAll("_", " ");

  const source = refund.invoice
    ? { label: refund.invoice.invoiceNumber, href: `/documents/invoices/${refund.invoice.id}`, kind: "Invoice" }
    : refund.sale
      ? { label: refund.sale.saleNumber, href: `/pos/${refund.sale.id}`, kind: "Sale" }
      : refund.creditNote
        ? { label: refund.creditNote.creditNoteNumber, href: `/documents/credit-notes/${refund.creditNote.id}`, kind: "Credit note" }
        : null;

  async function sendRefundWhatsAppAction() {
    "use server";
    const { user: actor, orgId: actorOrg } = await requireOrgSession();
    if (!(can.viewFinancials(actor) || ["ADMIN", "OPS", "MANAGER", "FINANCE"].includes(actor.role))) return;
    const ok = await shareRefundDocument({ orgId: actorOrg, refundId: id, channel: "whatsapp" });
    redirect(`/documents/refunds/${id}?sent=${ok ? "whatsapp" : "failed"}`);
  }
  async function sendRefundEmailAction() {
    "use server";
    const { user: actor, orgId: actorOrg } = await requireOrgSession();
    if (!(can.viewFinancials(actor) || ["ADMIN", "OPS", "MANAGER", "FINANCE"].includes(actor.role))) return;
    const ok = await shareRefundDocument({ orgId: actorOrg, refundId: id, channel: "email" });
    redirect(`/documents/refunds/${id}?sent=${ok ? "email" : "failed"}`);
  }

  const status: { label: string; tone: BadgeTone } = { label: methodLabel, tone: "accent" };

  const secondary = (
    <>
      {canSend && client?.phone && (
        <form action={sendRefundWhatsAppAction} className="inline">
          <button type="submit" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">WhatsApp</button>
        </form>
      )}
      {canSend && client?.email && (
        <form action={sendRefundEmailAction} className="inline">
          <button type="submit" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">Email</button>
        </form>
      )}
      <Link href={`/api/refunds/${refund.id}`} className="btn-premium rounded-lg px-3 py-1.5 text-[12px] font-bold">PDF</Link>
    </>
  );

  const rows = [
    { label: "Refunded", value: formatEATDate(refund.refundedAt) },
    { label: "Method", value: methodLabel },
    ...(refund.reference ? [{ label: "Reference", value: refund.reference }] : []),
    ...(refund.createdBy?.name ? [{ label: "Issued by", value: refund.createdBy.name }] : []),
    ...(source ? [{ label: "Against", value: source.kind }] : []),
  ];

  const related = [
    ...(source ? [{ label: source.label, href: source.href, sub: source.kind }] : []),
    ...(refund.invoice?.job ? [{ label: refund.invoice.job.jobNumber, href: `/jobs/${refund.invoice.job.id}`, sub: "Job" }] : []),
  ];

  return (
    <section className="space-y-4 pb-20">
      <DocumentActionBar
        backHref="/documents/refunds"
        eyebrow="Documents · Refunds"
        title={source ? `Refund · ${source.label}` : "Refund"}
        status={status}
        secondary={secondary}
      />

      {sent && (
        <div className={`rounded-xl border px-4 py-3 text-[13px] font-medium ${sent === "failed" ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"}`}>
          {sent === "whatsapp" && "WhatsApp message queued — track delivery in the outbox."}
          {sent === "email" && "Email queued — track delivery in the outbox."}
          {sent === "failed" && "Could not send: no client phone or email on file for this refund."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className={cardClass}>
            <div className={cardHeadClass}>Refund</div>
            <div className="grid grid-cols-1 gap-4 p-4 min-[600px]:grid-cols-2">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Amount</p>
                <p className="mono text-[20px] font-black tabular-nums">{formatMoney(refund.amount, currency)}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Method</p>
                <p className="text-[13px] font-medium">{methodLabel}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Refunded on</p>
                <p className="text-[13px] font-medium">{formatEATDate(refund.refundedAt)} · {formatEATTime(refund.refundedAt)}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Reference</p>
                <p className="text-[13px] font-medium">{refund.reference || "—"}</p>
              </div>
              {refund.note && (
                <div className="min-[600px]:col-span-2">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Note</p>
                  <p className="whitespace-pre-wrap text-[13px] text-[var(--ink-muted)]">{sanitizeText(refund.note)}</p>
                </div>
              )}
            </div>
          </div>

          {source && (
            <div className={cardClass}>
              <div className={cardHeadClass}>Refund for</div>
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">{source.kind}</p>
                  <p className="mono text-[14px] font-semibold">{source.label}</p>
                </div>
                <Link href={source.href} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">Open {source.kind.toLowerCase()} →</Link>
              </div>
            </div>
          )}
        </div>

        <DocumentSummaryRail
          headline={{ label: "Refund amount", value: formatMoney(refund.amount, currency), tone: "ink" }}
          rows={rows}
          client={client}
          related={related}
          activity={[{ label: "Refund issued", at: formatEATDate(refund.refundedAt) }]}
        />
      </div>
    </section>
  );
}
