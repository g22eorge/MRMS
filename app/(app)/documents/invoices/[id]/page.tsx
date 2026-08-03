// @ts-nocheck
import { prisma } from "@/lib/prisma";
import type { InvoiceType } from "@prisma/client";
import { syncInvoicePaymentState } from "@/lib/commercial/payment-sync";
import { getCurrentUserRole } from "@/lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { can } from "@/lib/permissions";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATDate } from "@/lib/date-eat";
import { DataTable } from "@/components/ui/DataTable";
import type { BadgeTone } from "@/components/ui/StatusBadge";
import Link from "next/link";
import { sanitizeText } from "@/lib/sanitize";
import { requireOrgSession } from "@/lib/org-context";
import { shareInvoiceDocument } from "@/lib/notifications/share-document";
import { DocumentActionBar } from "@/components/documents/DocumentActionBar";
import { DocumentSummaryRail } from "@/components/documents/DocumentSummaryRail";
import { CollectPaymentButton } from "@/components/documents/CollectPaymentButton";
import { InvoiceMoreMenu } from "@/components/documents/InvoiceMoreMenu";
import { InvoiceCreateDialog } from "../InvoiceCreateDialog";

const INVOICE_STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  ISSUED: "sky",
  PAID: "success",
  VOID: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  ISSUED: "Unpaid",
  PAID: "Paid",
  VOID: "Void",
};

const cardClass = "overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]";
const cardHeadClass = "border-b border-[var(--line)] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]";

/* Edit handled via ?edit=1 query param */
export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { user } = await getCurrentUserRole();
  if (
    !(
      can.viewFinancials(user) ||
      ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role)
    )
  ) {
    redirect("/dashboard");
  }
  if (!user.orgId) redirect("/dashboard");
  const orgId = user.orgId;

  const { id } = await params;
  // Every query below is explicitly scoped by orgId, so the fully-typed prisma
  // client (which preserves select inference) is used directly.
  const db = prisma;

  const invoice = await db.invoice.findFirst({
    where: { id, orgId: orgId },
    select: {
      id: true,
      invoiceNumber: true,
      invoiceType: true,
      status: true,
      currency: true,
      totalAmount: true,
      paidAmount: true,
      issuedAt: true,
      dueDate: true,
      subject: true,
      notes: true,
      client: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          organization: true,
          address: true,
        },
      },
      job: {
        select: {
          id: true,
          jobNumber: true,
          brand: true,
          model: true,
          status: true,
        },
      },
      lines: {
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          discountAmount: true,
          taxAmount: true,
          lineTotal: true,
        },
        orderBy: { createdAt: "asc" },
      },
      payments: {
        select: {
          id: true,
          amount: true,
          receivedAt: true,
          method: true,
          reference: true,
          createdBy: { select: { name: true } },
        },
        orderBy: { receivedAt: "desc" },
      },
      deliveryNotes: {
        select: {
          id: true,
          deliveryNoteNumber: true,
          deliveredAt: true,
          deliveryMethod: true,
          deliveredByName: true,
          receivedByName: true,
        },
      },
    },
  });

  if (!invoice) redirect("/documents/invoices");

  const org = await db.organization.findFirst({
    where: { id: orgId },
    select: { baseCurrency: true },
  });
  const currency = normalizeCurrency(
    org?.baseCurrency,
    normalizeCurrency(invoice.currency, "UGX")
  );
  const invoiceCurrency = normalizeCurrency(invoice.currency, "UGX");
  const baseCurrency = normalizeCurrency(org?.baseCurrency, "UGX");

  // When lines exist, they are the itemised truth shown on the PDF, so the total
  // comes from them (keeping the breakdown and the rail consistent). A totalled
  // invoice with no line rows falls back to the stored totalAmount. Lifecycle
  // respects the stored status so a zero/absent-line invoice never reads "Paid".
  const subtotal = invoice.lines.reduce((s, l) => s + l.lineTotal, 0);
  const taxTotal = invoice.lines.reduce((s, l) => s + (l.taxAmount ?? 0), 0);
  const total = invoice.lines.length ? subtotal + taxTotal : (invoice.totalAmount || 0);
  const paidAmount = invoice.paidAmount ?? 0;
  const balance = total - paidAmount;
  const isVoid = invoice.status === "VOID";
  const isPaid = invoice.status === "PAID" || (total > 0 && balance <= 0);
  const isOverdue = !isPaid && !isVoid && !!invoice.dueDate && new Date(invoice.dueDate) < new Date();
  const canSend = can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role);
  const canVoid = can.voidInvoices(user) || ["ADMIN", "OPS"].includes(user.role);

  // ---- Send actions (WhatsApp / email) — work for standalone AND job-linked
  // invoices, log to the outbox, and give the user feedback via ?sent=. ----
  async function sendInvoiceWhatsAppAction() {
    "use server";
    const { user: actor, orgId: actorOrg } = await requireOrgSession();
    if (!(can.viewFinancials(actor) || ["ADMIN", "OPS", "FRONT_DESK"].includes(actor.role))) return;
    const ok = await shareInvoiceDocument({ orgId: actorOrg, invoiceId: id, channel: "whatsapp" });
    redirect(`/documents/invoices/${id}?sent=${ok ? "whatsapp" : "failed"}`);
  }
  async function sendInvoiceEmailAction() {
    "use server";
    const { user: actor, orgId: actorOrg } = await requireOrgSession();
    if (!(can.viewFinancials(actor) || ["ADMIN", "OPS", "FRONT_DESK"].includes(actor.role))) return;
    const ok = await shareInvoiceDocument({ orgId: actorOrg, invoiceId: id, channel: "email" });
    redirect(`/documents/invoices/${id}?sent=${ok ? "email" : "failed"}`);
  }

  // ---- Edit dialog data (loaded only when ?edit=1) ----
  const sp = searchParams ? await searchParams : {};
  const isEdit = sp.edit === "1";
  const sent = typeof sp.sent === "string" ? sp.sent : undefined;
  const clients = isEdit ? await db.client.findMany({
    where: { orgId: orgId },
    select: { id: true, fullName: true, phone: true, email: true, organization: true, address: true },
    orderBy: { fullName: "asc" },
  }) : [];
  const leads = isEdit ? await db.lead.findMany({
    where: { orgId: orgId },
    select: { id: true, fullName: true, phone: true, email: true, organization: true, interest: true },
    orderBy: { fullName: "asc" },
  }) : [];
  const jobs = isEdit ? await db.job.findMany({
    where: { orgId: orgId },
    select: { id: true, jobNumber: true, brand: true, model: true, client: { select: { fullName: true, phone: true, address: true } } },
    orderBy: { receivedAt: "desc" },
  }) : [];
  const parts = isEdit ? await db.part.findMany({
    where: { orgId: orgId },
    select: { id: true, sku: true, name: true, unitCost: true, qtyOnHand: true },
    orderBy: { name: "asc" },
  }) : [];
  const taxRates = isEdit ? await db.taxRate.findMany({
    where: { orgId: orgId },
    select: { id: true, name: true, code: true, rate: true, isDefault: true },
  }) : [];
  const editInitialData = isEdit ? {
    clientId: invoice.client?.id ?? "",
    invoiceType: invoice.invoiceType ?? "SERVICE",
    subject: invoice.subject ?? "",
    dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : "",
    notes: invoice.notes ?? "",
    // Invoice has no taxRate/taxLabel columns — tax lives per line. Derive it.
    taxEnabled: taxTotal > 0,
    taxRate: subtotal > 0 ? Number(((taxTotal / subtotal) * 100).toFixed(2)) : 0,
    taxLabel: "VAT",
    lines: invoice.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discountAmount ?? 0,
    })),
  } : undefined;
  const canOverrideDiscountEdit = isEdit ? can.overrideDiscount(user) : false;
  // ---- End edit dialog data ----

  const status: { label: string; tone: BadgeTone } =
    isVoid ? { label: "Void", tone: "danger" }
      : isPaid ? { label: "Paid", tone: "success" }
        : paidAmount > 0 ? { label: "Partially paid", tone: "warning" }
          : isOverdue ? { label: "Overdue", tone: "danger" }
            : { label: STATUS_LABEL[invoice.status] ?? invoice.status, tone: INVOICE_STATUS_TONES[invoice.status] ?? "sky" };

  const primary = !isPaid && !isVoid ? (
    <CollectPaymentButton
      invoiceId={invoice.id}
      currency={invoiceCurrency}
      baseCurrency={baseCurrency}
      balance={balance}
    />
  ) : null;

  const secondary = (
    <>
      {canSend && invoice.client?.phone && (
        <form action={sendInvoiceWhatsAppAction} className="inline">
          <button type="submit" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">WhatsApp</button>
        </form>
      )}
      {canSend && invoice.client?.email && (
        <form action={sendInvoiceEmailAction} className="inline">
          <button type="submit" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">Email</button>
        </form>
      )}
      <Link href={`/api/invoices/${invoice.id}/pdf`} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">PDF</Link>
      <Link href={`/documents/invoices/${invoice.id}?edit=1`} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">Edit</Link>
    </>
  );

  const related = [
    ...(invoice.job ? [{ label: invoice.job.jobNumber, href: `/jobs/${invoice.job.id}`, sub: `${invoice.job.brand} ${invoice.job.model}`.trim() || "Job" }] : []),
    ...invoice.deliveryNotes.map((dn) => ({ label: dn.deliveryNoteNumber, sub: `Delivered ${formatEATDate(dn.deliveredAt)}` })),
  ];

  const activity = [
    { label: "Issued", at: formatEATDate(invoice.issuedAt) },
    ...[...invoice.payments].reverse().map((p) => ({ label: `Payment ${formatMoney(p.amount, currency)}`, at: formatEATDate(p.receivedAt) })),
    ...(isVoid ? [{ label: "Voided", at: "—" }] : []),
  ];

  const rows = [
    { label: "Issued", value: formatEATDate(invoice.issuedAt) },
    { label: "Due", value: invoice.dueDate ? formatEATDate(invoice.dueDate) : "—" },
    { label: "Type", value: invoice.invoiceType ?? "—" },
    { label: "Total", value: formatMoney(total, currency) },
    ...(paidAmount > 0 ? [{ label: "Paid", value: formatMoney(paidAmount, currency) }] : []),
  ];

  const headline: { label: string; value: string; tone: "ink" | "good" | "warn" | "crit" } = isPaid
    ? { label: "Paid in full", value: formatMoney(total, currency), tone: "good" }
    : { label: "Balance due", value: formatMoney(balance, currency), tone: isOverdue ? "crit" : "warn" };

  return (
    <>
      <section className="space-y-4 pb-20">
        <DocumentActionBar
          backHref="/documents/invoices"
          eyebrow="Documents · Invoices"
          title={`Invoice ${invoice.invoiceNumber}`}
          status={status}
          primary={primary}
          secondary={secondary}
          overflow={<InvoiceMoreMenu invoiceId={invoice.id} canVoid={canVoid} isVoid={isVoid} />}
        />

        {sent && (
          <div
            className={`rounded-xl border px-4 py-3 text-[13px] font-medium ${
              sent === "failed"
                ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            }`}
          >
            {sent === "whatsapp" && "WhatsApp message queued — track delivery in the job Messages tab / outbox."}
            {sent === "email" && "Email queued — track delivery in the outbox."}
            {sent === "failed" && "Could not send: this invoice has no client phone or email on file."}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Main column */}
          <div className="flex min-w-0 flex-col gap-4">
            <div className={cardClass}>
              <div className={cardHeadClass}>Line Items</div>
              {invoice.lines.length ? (
                <>
                  <DataTable
                    frameless
                    rows={invoice.lines}
                    getRowKey={(l) => l.id}
                    dense
                    columns={[
                      {
                        key: "description",
                        header: "Description",
                        cell: (row) => <span className="font-medium">{row.description}</span>,
                      },
                      {
                        key: "quantity",
                        header: "Qty",
                        align: "center",
                        className: "w-[60px]",
                        cell: (row) => <span>{row.quantity}</span>,
                      },
                      {
                        key: "unitPrice",
                        header: "Unit Price",
                        align: "right",
                        className: "min-w-[110px] whitespace-nowrap",
                        cell: (row) => <span className="mono tabular-nums">{formatMoney(row.unitPrice, currency)}</span>,
                      },
                      {
                        key: "tax",
                        header: "Tax",
                        align: "right",
                        className: "min-w-[100px] whitespace-nowrap",
                        cell: (row) => (
                          <span className="mono tabular-nums">
                            {row.taxAmount ? formatMoney(row.taxAmount, currency) : "—"}
                          </span>
                        ),
                      },
                      {
                        key: "total",
                        header: "Total",
                        align: "right",
                        className: "min-w-[100px] whitespace-nowrap",
                        cell: (row) => <span className="mono font-bold tabular-nums">{formatMoney(row.lineTotal, currency)}</span>,
                      },
                    ]}
                  />
                  <div className="flex flex-col items-end gap-1 border-t border-[var(--line)] px-4 py-3">
                    <div className="flex w-full max-w-xs justify-between text-[13px]">
                      <span className="text-[var(--ink-muted)]">Subtotal</span>
                      <span className="mono font-medium">{formatMoney(subtotal, currency)}</span>
                    </div>
                    <div className="flex w-full max-w-xs justify-between text-[13px]">
                      <span className="text-[var(--ink-muted)]">Tax</span>
                      <span className="mono font-medium">{formatMoney(taxTotal, currency)}</span>
                    </div>
                    <div className="flex w-full max-w-xs justify-between border-t border-[var(--line)] pt-1 text-[14px]">
                      <span className="font-bold">Total</span>
                      <span className="mono font-black">{formatMoney(subtotal + taxTotal, currency)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4 text-[13px] text-[var(--ink-muted)]">No items.</div>
              )}
            </div>

            {invoice.notes && (
              <div className={cardClass}>
                <div className={cardHeadClass}>Notes</div>
                <div className="whitespace-pre-wrap p-4 text-[13px] text-[var(--ink-muted)]">{sanitizeText(invoice.notes)}</div>
              </div>
            )}

            {invoice.payments.length > 0 && (
              <div className={cardClass}>
                <div className={cardHeadClass}>Payment History</div>
                <DataTable
                  frameless
                  rows={invoice.payments}
                  getRowKey={(p) => p.id}
                  empty="No payments."
                  columns={[
                    { key: "date", header: "Date", cell: (row) => formatEATDate(row.receivedAt) },
                    { key: "amount", header: "Amount", align: "right", cell: (row) => formatMoney(row.amount, currency) },
                    { key: "method", header: "Method", cell: (row) => row.method },
                    { key: "reference", header: "Reference", cell: (row) => row.reference ?? "—" },
                    { key: "by", header: "Recorded by", cell: (row) => row.createdBy?.name ?? "—" },
                  ]}
                />
              </div>
            )}

            {invoice.deliveryNotes.length > 0 && (
              <div className={cardClass}>
                <div className={cardHeadClass}>Delivery Notes</div>
                <DataTable
                  frameless
                  rows={invoice.deliveryNotes}
                  getRowKey={(dn) => dn.id}
                  empty="No delivery notes."
                  columns={[
                    { key: "number", header: "DN #", cell: (row) => row.deliveryNoteNumber },
                    { key: "date", header: "Delivered", cell: (row) => formatEATDate(row.deliveredAt) },
                    { key: "method", header: "Method", cell: (row) => row.deliveryMethod },
                    { key: "by", header: "Delivered by", cell: (row) => row.deliveredByName },
                    { key: "receivedBy", header: "Received by", cell: (row) => row.receivedByName },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Summary rail */}
          <DocumentSummaryRail
            headline={headline}
            rows={rows}
            client={invoice.client}
            related={related}
            activity={activity}
          />
        </div>
      </section>

      {isEdit && (
        <InvoiceCreateDialog
          currency={currency}
          canOverrideDiscount={canOverrideDiscountEdit}
          clients={clients}
          leads={leads}
          jobs={jobs}
          parts={parts}
          taxRates={taxRates}
          defaultTaxApplicable={taxTotal > 0}
          defaultTaxRate={subtotal > 0 ? Number(((taxTotal / subtotal) * 100).toFixed(2)) : 0}
          defaultTaxLabel="VAT"
          action={async (fd: FormData) => {
            "use server";
            const fdId = String(fd.get("invoiceId") ?? "").trim();
            if (!fdId) return;

            // Tenant + status guard: only edit this org's non-finalized invoices.
            const target = await prisma.invoice.findFirst({
              where: { id: fdId, orgId: orgId },
              select: { id: true, status: true, currency: true },
            });
            if (!target || target.status === "VOID" || target.status === "PAID") return;

            const taxApplicable = String(fd.get("taxApplicable") ?? "") === "1";
            const requestedTaxRate = Number(String(fd.get("taxRate") ?? "0").trim());
            const taxRate = taxApplicable ? Math.min(Math.max(Number.isFinite(requestedTaxRate) ? requestedTaxRate : 0, 0), 100) : 0;
            const canDisc = can.overrideDiscount(user);

            let rawItems: Array<{ partId?: string | null; description?: string; quantity?: number; unitPrice?: number; discount?: number }> = [];
            try { const p = JSON.parse(String(fd.get("items") ?? "[]")); if (Array.isArray(p)) rawItems = p; } catch {}
            const items = rawItems
              .map((item) => {
                const description = sanitizeText(String(item.description ?? ""));
                const quantity = Number(item.quantity);
                const unitPrice = Number(item.unitPrice);
                const gross = (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0);
                const discountPercent = canDisc ? Math.min(Math.max(Number(item.discount) || 0, 0), 100) : 0;
                const discountAmount = gross * (discountPercent / 100);
                return { partId: item.partId || null, description, quantity, unitPrice, discountAmount, lineTotal: gross - discountAmount };
              })
              .filter((i) => i.description && Number.isFinite(i.quantity) && i.quantity > 0 && Number.isFinite(i.unitPrice) && i.unitPrice >= 0);
            if (!items.length) return;

            const newSubtotal = items.reduce((s, i) => s + i.lineTotal, 0);
            const newTax = taxRate > 0 ? newSubtotal * (taxRate / 100) : 0;
            const totalAmount = newSubtotal + newTax;
            // Only re-point the invoice at a client that belongs to this org — a
            // forged clientId must not surface another tenant's name/phone on the PDF.
            const requestedClientId = String(fd.get("clientId") ?? "").trim() || null;
            const clientId = requestedClientId
              ? (await prisma.client.findFirst({ where: { id: requestedClientId, orgId }, select: { id: true } }))?.id ?? null
              : null;

            await prisma.$transaction(async (tx) => {
              await tx.invoiceLine.deleteMany({ where: { invoiceId: fdId, orgId: orgId } });
              await tx.invoice.update({
                where: { id: fdId },
                data: {
                  subject: String(fd.get("subject") ?? "").trim() || null,
                  notes: String(fd.get("notes") ?? "").trim() || null,
                  dueDate: fd.get("dueDate") ? new Date(String(fd.get("dueDate"))) : null,
                  invoiceType: ((): InvoiceType => {
                    const t = String(fd.get("invoiceType") ?? "SERVICE").trim();
                    return (["REPAIR", "SERVICE", "MERCHANDISE", "CONTRACT", "OTHER"] as const).includes(t as InvoiceType) ? (t as InvoiceType) : "SERVICE";
                  })(),
                  ...(clientId ? { clientId } : {}),
                  totalAmount,
                  lines: {
                    create: items.map((item) => ({
                      orgId: orgId,
                      sourceType: item.partId ? "Part" : "Custom",
                      sourceId: item.partId,
                      description: item.description,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      discountAmount: item.discountAmount,
                      taxAmount: newTax > 0 && newSubtotal > 0 ? newTax * (item.lineTotal / newSubtotal) : 0,
                      lineTotal: item.lineTotal,
                    })),
                  },
                },
              });
              await syncInvoicePaymentState(tx, { orgId: orgId, invoiceId: fdId, baseCurrency: currency, actorUserId: user.id });
            });

            revalidatePath("/documents/invoices/" + fdId);
            revalidatePath("/documents/invoices");
          }}
          editInvoiceId={invoice.id}
          editInitialData={editInitialData}
        />
      )}
    </>
  );
}
