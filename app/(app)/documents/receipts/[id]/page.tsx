export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";
import { requireOrgSession } from "@/lib/org-context";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATDate, formatEATTime } from "@/lib/date-eat";
import type { BadgeTone } from "@/components/ui/StatusBadge";
import Link from "next/link";
import { sanitizeText } from "@/lib/sanitize";
import { shareReceiptDocument } from "@/lib/notifications/share-document";
import { DocumentActionBar } from "@/components/documents/DocumentActionBar";
import { DocumentSummaryRail } from "@/components/documents/DocumentSummaryRail";

const cardClass = "overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]";
const cardHeadClass = "border-b border-[var(--line)] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]";
const clientSelect = { fullName: true, phone: true, email: true, organization: true, address: true } as const;

export default async function ReceiptDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { user } = await getCurrentUserRole();
  if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) redirect("/dashboard");
  if (!user.orgId) redirect("/dashboard");
  const orgId = user.orgId;

  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const sent = typeof sp.sent === "string" ? sp.sent : undefined;

  // `[id]` is a Payment id — the receipt PDF and share actions are keyed by payment.
  const payment = await prisma.payment.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      amount: true,
      currency: true,
      method: true,
      reference: true,
      note: true,
      receivedAt: true,
      createdBy: { select: { name: true } },
      invoice: { select: { id: true, invoiceNumber: true, client: { select: clientSelect }, job: { select: { id: true, jobNumber: true, client: { select: clientSelect } } } } },
      sale: { select: { id: true, saleNumber: true, client: { select: clientSelect } } },
      receipts: { select: { receiptNumber: true, issuedAt: true, voidedAt: true, voidReason: true }, orderBy: { issuedAt: "desc" }, take: 1 },
    },
  });
  if (!payment) redirect("/documents/receipts");

  const org = await prisma.organization.findFirst({ where: { id: orgId }, select: { baseCurrency: true } });
  const currency = normalizeCurrency(org?.baseCurrency, normalizeCurrency(payment.currency, "UGX"));
  const receipt = payment.receipts[0] ?? null;
  const client = payment.invoice?.job?.client ?? payment.invoice?.client ?? payment.sale?.client ?? null;
  const isVoid = !!receipt?.voidedAt;
  const canSend = can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role);
  const methodLabel = payment.method.replaceAll("_", " ");

  const source = payment.invoice
    ? { label: payment.invoice.invoiceNumber, href: `/documents/invoices/${payment.invoice.id}`, kind: "Invoice" }
    : payment.sale
      ? { label: payment.sale.saleNumber, href: `/pos/${payment.sale.id}`, kind: "Sale" }
      : null;

  async function sendReceiptWhatsAppAction() {
    "use server";
    const { user: actor, orgId: actorOrg } = await requireOrgSession();
    if (!(can.viewFinancials(actor) || ["ADMIN", "OPS", "FRONT_DESK"].includes(actor.role))) return;
    const ok = await shareReceiptDocument({ orgId: actorOrg, paymentId: id, channel: "whatsapp" });
    redirect(`/documents/receipts/${id}?sent=${ok ? "whatsapp" : "failed"}`);
  }
  async function sendReceiptEmailAction() {
    "use server";
    const { user: actor, orgId: actorOrg } = await requireOrgSession();
    if (!(can.viewFinancials(actor) || ["ADMIN", "OPS", "FRONT_DESK"].includes(actor.role))) return;
    const ok = await shareReceiptDocument({ orgId: actorOrg, paymentId: id, channel: "email" });
    redirect(`/documents/receipts/${id}?sent=${ok ? "email" : "failed"}`);
  }

  const status: { label: string; tone: BadgeTone } = isVoid
    ? { label: "Void", tone: "danger" }
    : { label: methodLabel, tone: "accent" };

  const secondary = (
    <>
      {canSend && client?.phone && (
        <form action={sendReceiptWhatsAppAction} className="inline">
          <button type="submit" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">WhatsApp</button>
        </form>
      )}
      {canSend && client?.email && (
        <form action={sendReceiptEmailAction} className="inline">
          <button type="submit" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">Email</button>
        </form>
      )}
      <Link href={`/api/payments/${payment.id}/receipt`} className="btn-premium rounded-lg px-3 py-1.5 text-[12px] font-bold">PDF</Link>
    </>
  );

  const rows = [
    ...(receipt ? [{ label: "Receipt #", value: <span className="mono">{receipt.receiptNumber}</span> }] : []),
    { label: "Received", value: formatEATDate(payment.receivedAt) },
    { label: "Method", value: methodLabel },
    ...(payment.reference ? [{ label: "Reference", value: payment.reference }] : []),
    ...(payment.createdBy?.name ? [{ label: "Recorded by", value: payment.createdBy.name }] : []),
  ];

  const related = [
    ...(source ? [{ label: source.label, href: source.href, sub: source.kind }] : []),
    ...(payment.invoice?.job ? [{ label: payment.invoice.job.jobNumber, href: `/jobs/${payment.invoice.job.id}`, sub: "Job" }] : []),
  ];

  return (
    <section className="space-y-4 pb-20">
      <DocumentActionBar
        backHref="/documents/receipts"
        eyebrow="Documents · Receipts"
        title={receipt ? `Receipt ${receipt.receiptNumber}` : "Payment receipt"}
        status={status}
        secondary={secondary}
      />

      {sent && (
        <div className={`rounded-xl border px-4 py-3 text-[13px] font-medium ${sent === "failed" ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"}`}>
          {sent === "whatsapp" && "WhatsApp message queued — track delivery in the outbox."}
          {sent === "email" && "Email queued — track delivery in the outbox."}
          {sent === "failed" && "Could not send: no client phone or email on file for this receipt."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className={cardClass}>
            <div className={cardHeadClass}>Payment</div>
            <div className="grid grid-cols-1 gap-4 p-4 min-[600px]:grid-cols-2">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Amount</p>
                <p className="mono text-[20px] font-black tabular-nums">{formatMoney(payment.amount, currency)}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Method</p>
                <p className="text-[13px] font-medium">{methodLabel}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Received</p>
                <p className="text-[13px] font-medium">{formatEATDate(payment.receivedAt)} · {formatEATTime(payment.receivedAt)}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Reference</p>
                <p className="text-[13px] font-medium">{payment.reference || "—"}</p>
              </div>
              {payment.note && (
                <div className="min-[600px]:col-span-2">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Note</p>
                  <p className="whitespace-pre-wrap text-[13px] text-[var(--ink-muted)]">{sanitizeText(payment.note)}</p>
                </div>
              )}
            </div>
          </div>

          {source && (
            <div className={cardClass}>
              <div className={cardHeadClass}>Receipt for</div>
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">{source.kind}</p>
                  <p className="mono text-[14px] font-semibold">{source.label}</p>
                </div>
                <Link href={source.href} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">Open {source.kind.toLowerCase()} →</Link>
              </div>
            </div>
          )}

          {isVoid && receipt?.voidReason && (
            <div className={cardClass}>
              <div className={cardHeadClass}>Void reason</div>
              <div className="p-4 text-[13px] text-[var(--ink-muted)]">{sanitizeText(receipt.voidReason)}</div>
            </div>
          )}
        </div>

        <DocumentSummaryRail
          headline={{ label: "Amount", value: formatMoney(payment.amount, currency), tone: isVoid ? "crit" : "good" }}
          rows={rows}
          client={client}
          related={related}
          activity={[{ label: "Payment received", at: formatEATDate(payment.receivedAt) }, ...(isVoid && receipt?.voidedAt ? [{ label: "Voided", at: formatEATDate(receipt.voidedAt) }] : [])]}
        />
      </div>
    </section>
  );
}
