export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";
import { requireOrgSession } from "@/lib/org-context";
import { requireModule, OrgModule } from "@/lib/module-access";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATDate } from "@/lib/date-eat";
import type { BadgeTone } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import Link from "next/link";
import { sanitizeText } from "@/lib/sanitize";
import { shareCreditNoteDocument } from "@/lib/notifications/share-document";
import { DocumentActionBar } from "@/components/documents/DocumentActionBar";
import { DocumentSummaryRail } from "@/components/documents/DocumentSummaryRail";

const cardClass = "overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]";
const cardHeadClass = "border-b border-[var(--line)] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]";
const clientSelect = { fullName: true, phone: true, email: true, organization: true, address: true } as const;

export default async function CreditNoteDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  await requireModule(OrgModule.INVOICING);
  const { user } = await getCurrentUserRole();
  if (!can.viewFinancials(user) && !["ADMIN", "OPS", "MANAGER"].includes(user.role)) redirect("/dashboard");
  if (!user.orgId) redirect("/dashboard");
  const orgId = user.orgId;

  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const sent = typeof sp.sent === "string" ? sp.sent : undefined;

  const creditNote = await prisma.creditNote.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      creditNoteNumber: true,
      currency: true,
      totalAmount: true,
      issuedAt: true,
      reason: true,
      itemsReceivedBackAt: true,
      itemsReceivedBackNote: true,
      itemsReceivedBackBy: { select: { name: true } },
      createdBy: { select: { name: true } },
      sale: { select: { id: true, saleNumber: true, client: { select: clientSelect } } },
      items: { select: { id: true, description: true, quantity: true, unitPrice: true, lineTotal: true }, orderBy: { createdAt: "asc" } },
      refunds: { select: { id: true, amount: true, method: true, refundedAt: true }, orderBy: { refundedAt: "desc" } },
    },
  });
  if (!creditNote) redirect("/documents/credit-notes");

  const org = await prisma.organization.findFirst({ where: { id: orgId }, select: { baseCurrency: true } });
  const currency = normalizeCurrency(org?.baseCurrency, normalizeCurrency(creditNote.currency, "UGX"));
  const total = creditNote.totalAmount;
  const refundedTotal = creditNote.refunds.reduce((s, r) => s + r.amount, 0);
  const outstanding = Math.max(0, total - refundedTotal);
  const received = !!creditNote.itemsReceivedBackAt;
  const client = creditNote.sale?.client ?? null;
  const canSend = can.viewFinancials(user) || ["ADMIN", "OPS", "MANAGER"].includes(user.role);

  async function sendCreditNoteWhatsAppAction() {
    "use server";
    const { user: actor, orgId: actorOrg } = await requireOrgSession();
    if (!(can.viewFinancials(actor) || ["ADMIN", "OPS", "MANAGER"].includes(actor.role))) return;
    const ok = await shareCreditNoteDocument({ orgId: actorOrg, creditNoteId: id, channel: "whatsapp" });
    redirect(`/documents/credit-notes/${id}?sent=${ok ? "whatsapp" : "failed"}`);
  }
  async function sendCreditNoteEmailAction() {
    "use server";
    const { user: actor, orgId: actorOrg } = await requireOrgSession();
    if (!(can.viewFinancials(actor) || ["ADMIN", "OPS", "MANAGER"].includes(actor.role))) return;
    const ok = await shareCreditNoteDocument({ orgId: actorOrg, creditNoteId: id, channel: "email" });
    redirect(`/documents/credit-notes/${id}?sent=${ok ? "email" : "failed"}`);
  }

  const status: { label: string; tone: BadgeTone } = received
    ? { label: "Items received", tone: "success" }
    : { label: "Awaiting return", tone: "warning" };

  const secondary = (
    <>
      {canSend && client?.phone && (
        <form action={sendCreditNoteWhatsAppAction} className="inline">
          <button type="submit" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">WhatsApp</button>
        </form>
      )}
      {canSend && client?.email && (
        <form action={sendCreditNoteEmailAction} className="inline">
          <button type="submit" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">Email</button>
        </form>
      )}
      <Link href={`/api/credit-notes/${creditNote.id}`} className="btn-premium rounded-lg px-3 py-1.5 text-[12px] font-bold">PDF</Link>
    </>
  );

  const rows = [
    { label: "Issued", value: formatEATDate(creditNote.issuedAt) },
    { label: "Credit total", value: formatMoney(total, currency) },
    ...(refundedTotal > 0 ? [{ label: "Refunded", value: formatMoney(refundedTotal, currency) }] : []),
    { label: "Outstanding", value: formatMoney(outstanding, currency) },
    ...(creditNote.createdBy?.name ? [{ label: "Issued by", value: creditNote.createdBy.name }] : []),
  ];

  const related = [
    ...(creditNote.sale ? [{ label: creditNote.sale.saleNumber, href: `/pos/${creditNote.sale.id}`, sub: "Sale" }] : []),
    ...creditNote.refunds.map((r) => ({ label: formatMoney(r.amount, currency), href: `/documents/refunds/${r.id}`, sub: `Refund · ${r.method.replaceAll("_", " ")}` })),
  ];

  return (
    <section className="space-y-4 pb-20">
      <DocumentActionBar
        backHref="/documents/credit-notes"
        eyebrow="Documents · Credit Notes"
        title={`Credit note ${creditNote.creditNoteNumber}`}
        status={status}
        secondary={secondary}
      />

      {sent && (
        <div className={`rounded-xl border px-4 py-3 text-[13px] font-medium ${sent === "failed" ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"}`}>
          {sent === "whatsapp" && "WhatsApp message queued — track delivery in the outbox."}
          {sent === "email" && "Email queued — track delivery in the outbox."}
          {sent === "failed" && "Could not send: no client phone or email on file for this credit note."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className={cardClass}>
            <div className={cardHeadClass}>Credited Items</div>
            {creditNote.items.length ? (
              <>
                <DataTable
                  frameless
                  rows={creditNote.items}
                  getRowKey={(l) => l.id}
                  dense
                  columns={[
                    { key: "description", header: "Description", cell: (row) => <span className="font-medium">{row.description}</span> },
                    { key: "quantity", header: "Qty", align: "center", className: "w-[60px]", cell: (row) => <span>{row.quantity}</span> },
                    { key: "unitPrice", header: "Unit Price", align: "right", className: "min-w-[100px] whitespace-nowrap", cell: (row) => <span className="mono tabular-nums">{formatMoney(row.unitPrice, currency)}</span> },
                    { key: "total", header: "Total", align: "right", className: "min-w-[100px] whitespace-nowrap", cell: (row) => <span className="mono font-bold tabular-nums">{formatMoney(row.lineTotal, currency)}</span> },
                  ]}
                />
                <div className="flex flex-col items-end gap-1 border-t border-[var(--line)] px-4 py-3">
                  <div className="flex w-full max-w-xs justify-between border-t border-[var(--line)] pt-1 text-[14px]"><span className="font-bold">Credit total</span><span className="mono font-black">{formatMoney(total, currency)}</span></div>
                </div>
              </>
            ) : <div className="p-4 text-[13px] text-[var(--ink-muted)]">No itemised lines.</div>}
          </div>

          {creditNote.reason && (
            <div className={cardClass}>
              <div className={cardHeadClass}>Reason</div>
              <div className="whitespace-pre-wrap p-4 text-[13px] text-[var(--ink-muted)]">{sanitizeText(creditNote.reason)}</div>
            </div>
          )}

          {creditNote.refunds.length > 0 && (
            <div className={cardClass}>
              <div className={cardHeadClass}>Refunds against this credit note</div>
              <DataTable
                frameless
                rows={creditNote.refunds}
                getRowKey={(r) => r.id}
                columns={[
                  { key: "date", header: "Date", cell: (row) => formatEATDate(row.refundedAt) },
                  { key: "amount", header: "Amount", align: "right", cell: (row) => formatMoney(row.amount, currency) },
                  { key: "method", header: "Method", cell: (row) => row.method.replaceAll("_", " ") },
                  { key: "view", header: "", align: "right", cell: (row) => <Link href={`/documents/refunds/${row.id}`} className="text-[var(--accent)] hover:underline">View →</Link> },
                ]}
              />
            </div>
          )}

          {received && (
            <div className={cardClass}>
              <div className={cardHeadClass}>Items received back</div>
              <div className="p-4 text-[13px]">
                <p className="font-medium">{creditNote.itemsReceivedBackAt ? formatEATDate(creditNote.itemsReceivedBackAt) : "—"}{creditNote.itemsReceivedBackBy?.name ? ` · ${creditNote.itemsReceivedBackBy.name}` : ""}</p>
                {creditNote.itemsReceivedBackNote && <p className="mt-1 whitespace-pre-wrap text-[var(--ink-muted)]">{sanitizeText(creditNote.itemsReceivedBackNote)}</p>}
              </div>
            </div>
          )}
        </div>

        <DocumentSummaryRail
          headline={{ label: "Credit total", value: formatMoney(total, currency), tone: "ink" }}
          rows={rows}
          client={client}
          related={related}
          activity={[
            { label: "Issued", at: formatEATDate(creditNote.issuedAt) },
            ...(received && creditNote.itemsReceivedBackAt ? [{ label: "Items received", at: formatEATDate(creditNote.itemsReceivedBackAt) }] : []),
          ]}
        />
      </div>
    </section>
  );
}
