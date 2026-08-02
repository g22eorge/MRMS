import { prisma } from "@/lib/prisma";
import type { InvoiceType } from "@prisma/client";
import { syncInvoicePaymentState } from "@/lib/commercial/payment-sync";
import { getCurrentUserRole } from "@/lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { can } from "@/lib/permissions";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATDate } from "@/lib/date-eat";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { StatCards } from "@/components/ui/StatCards";
import { canGenerateInvoiceForStatus } from "@/lib/documents";
import Link from "next/link";
import { sanitizeText } from "@/lib/sanitize";
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

  const subtotal = invoice.lines.reduce((s, l) => s + l.lineTotal, 0);
  const taxTotal = invoice.lines.reduce((s, l) => s + (l.taxAmount ?? 0), 0);
  const total = subtotal + taxTotal;
  const paidAmount = invoice.paidAmount ?? 0;
  const balance = total - paidAmount;
  const isPaid = balance <= 0;
  const isVoid = invoice.status === "VOID";
  const canDelete = ["ADMIN", "OPS"].includes(user.role);
  const canSend = can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role);

  // ---- Edit dialog data ----
  const sp = searchParams ? await searchParams : {};
  const isEdit = sp.edit === "1";
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
    lines: invoice.lines.map((l: any) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discountAmount ?? 0,
    })),
  } : undefined;
  const canOverrideDiscountEdit = isEdit ? can.overrideDiscount(user) : false;
  // ---- End edit dialog data ----


  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `/* print styles injected at runtime */`,
        }}
      />
      <section className="space-y-4 pb-20" id="print-area">
        <PageHeader
          title={`Invoice ${invoice.invoiceNumber}`}
          eyebrow="Documents · Invoices"
          description={sanitizeText(
            invoice.subject ?? invoice.invoiceType ?? ""
          )}
          actions={
            <div className="flex flex-wrap items-center gap-2 action-bar">
              <Link
                href="/documents/invoices"
                className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium"
              >
                ← Back
              </Link>
              <Link
                href={`/documents/invoices/${invoice.id}?edit=1`}
                className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium"
              >
                Edit
              </Link>
              <Link
                href={`/api/invoices/${invoice.id}/pdf`}
                className="btn-premium rounded-lg px-3 py-1.5 text-[12px] font-bold"
              >
                PDF
              </Link>
            </div>
          }
        />

        <StatCards columns={5} cards={[
            { label: "Invoice #", value: invoice.invoiceNumber },
            { label: "Date", value: formatEATDate(invoice.issuedAt) },
            {
              label: "Due",
              value: invoice.dueDate ? formatEATDate(invoice.dueDate) : "—",
            },
            {
              label: "Status",
              value: (
                <StatusBadge tone={INVOICE_STATUS_TONES[invoice.status] ?? "neutral"}>
                  {STATUS_LABEL[invoice.status] ?? invoice.status}
                </StatusBadge>
              ),
            },
            {
              label: "Total",
              value: formatMoney(total, currency),
              valueClass: "text-[var(--ink)]",
            },
          ]} />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 action-bar">
            {canSend && invoice.client?.phone && (
              <form
                action={`/api/invoices/${invoice.id}/send`}
                method="POST"
                className="inline"
              >
                <input
                  type="hidden"
                  name="toPhone"
                  value={invoice.client.phone}
                />
                <button
                  type="submit"
                  className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium"
                >
                  WhatsApp
                </button>
              </form>
            )}
            {canSend && invoice.client?.email && (
              <form
                action={`/api/invoices/${invoice.id}/send`}
                method="POST"
                className="inline"
              >
                <input
                  type="hidden"
                  name="toEmail"
                  value={invoice.client.email}
                />
                <button
                  type="submit"
                  className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium"
                >
                  Email
                </button>
              </form>
            )}
            {!isPaid && !isVoid && (
              <Link
                href={`/documents/invoices/${invoice.id}?pay=1`}
                className="btn-premium rounded-lg px-3 py-1.5 text-[12px] font-bold"
              >
                Collect Payment
              </Link>
            )}
            {isVoid && (
              <span className="text-[12px] font-bold text-red-700">
                Voided
              </span>
            )}
          </div>

          {invoice.client && (
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
              <div className="border-b border-[var(--line)] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                  Client
                </p>
              </div>
              <div className="p-4 grid grid-cols-1 min-[600px]:grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">
                    Name
                  </p>
                  <p className="text-[13px] font-medium">
                    {invoice.client.fullName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">
                    Phone
                  </p>
                  <p className="text-[13px] font-medium">
                    {invoice.client.phone ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">
                    Email
                  </p>
                  <p className="text-[13px] font-medium">
                    {invoice.client.email ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">
                    Organization
                  </p>
                  <p className="text-[13px] font-medium">
                    {invoice.client.organization ?? "—"}
                  </p>
                </div>
                <div className="min-[600px]:col-span-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">
                    Address
                  </p>
                  <p className="text-[13px] font-medium whitespace-pre-wrap">
                    {invoice.client.address ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {invoice.job && (
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
              <div className="border-b border-[var(--line)] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                  Job
                </p>
              </div>
              <div className="p-4 grid grid-cols-1 min-[600px]:grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">
                    Job #
                  </p>
                  <p className="text-[13px] font-medium">
                    {invoice.job.jobNumber}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">
                    Device
                  </p>
                  <p className="text-[13px] font-medium">
                    {invoice.job.brand} {invoice.job.model}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="border-b border-[var(--line)] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                Line Items
              </p>
            </div>
            {invoice.lines.length ? (
              <>
                <DataTable
                  frameless
                  rows={invoice.lines}
                  getRowKey={(l: any) => l.id}
                  dense
                  columns={[
                    {
                      key: "description",
                      header: "Description",
                      cell: (row: any) => (
                        <span className="font-medium">
                          {row.description}
                        </span>
                      ),
                    },
                    {
                      key: "quantity",
                      header: "Qty",
                      align: "center",
                      className: "w-[60px]",
                      cell: (row: any) => (
                        <span className="">{row.quantity}</span>
                      ),
                    },
                    {
                      key: "unitPrice",
                      header: "Unit Price",
                      align: "right",
                      className: "min-w-[110px] whitespace-nowrap",
                      cell: (row: any) => (
                        <span className="mono tabular-nums">
                          {formatMoney(row.unitPrice, currency)}
                        </span>
                      ),
                    },
{                       key: "tax",
                      header: "Tax",
                      align: "right",
 className: "min-w-[100px] whitespace-nowrap",
      cell: (row: any) => (
        <span className="mono tabular-nums">
          {row.taxAmount
            ? formatMoney(row.taxAmount, currency)
            : "—"}
                        </span>
                      ),
                    },
                    {
                      key: "total",
                      header: "Total",
                      align: "right",
 className: "min-w-[100px] whitespace-nowrap",
      cell: (row: any) => (
        <span className="mono font-bold tabular-nums">
          {formatMoney(row.lineTotal, currency)}
                        </span>
                      ),
                    },
                  ]}
                />
                <div className="flex flex-col items-end gap-1 border-t border-[var(--line)] px-4 py-3">
                  <div className="flex w-full max-w-xs justify-between text-[13px]">
                    <span className="text-[var(--ink-muted)]">Subtotal</span>
                    <span className="mono font-medium">
                      {formatMoney(subtotal, currency)}
                    </span>
                  </div>
                  <div className="flex w-full max-w-xs justify-between text-[13px]">
                    <span className="text-[var(--ink-muted)]">Tax</span>
                    <span className="mono font-medium">
                      {formatMoney(taxTotal, currency)}
                    </span>
                  </div>
                  <div className="flex w-full max-w-xs justify-between text-[14px] border-t border-[var(--line)] pt-1">
                    <span className="font-bold">Total</span>
                    <span className="mono font-black">
                      {formatMoney(total, currency)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4 text-[13px] text-[var(--ink-muted)]">
                No items.
              </div>
            )}
          </div>

          {invoice.notes && (
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
              <div className="border-b border-[var(--line)] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                  Notes
                </p>
              </div>
              <div className="p-4 text-[13px] whitespace-pre-wrap text-[var(--ink-muted)]">
                {sanitizeText(invoice.notes)}
              </div>
            </div>
          )}

          {invoice.payments.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
              <div className="border-b border-[var(--line)] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Payment History</p>
              </div>
              <DataTable
                frameless
                rows={invoice.payments}
                getRowKey={(p) => p.id}
                empty="No payments."
                columns={[
                  {
                    key: "date",
                    header: "Date",
                    cell: (row: any) => formatEATDate(row.receivedAt),
                  },
                  {
                    key: "amount",
                    header: "Amount",
                    align: "right",
                    cell: (row: any) => formatMoney(row.amount, currency),
                  },
                  {
                    key: "method",
                    header: "Method",
                    cell: (row: any) => row.method,
                  },
                  {
                    key: "reference",
                    header: "Reference",
                    cell: (row: any) => row.reference ?? "—",
                  },
                  {
                    key: "by",
                    header: "Recorded by",
                    cell: (row: any) => row.createdBy?.name ?? "—",
                  },
                ]}
              />
            </div>
          )}

          {taxTotal > 0 && (
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Tax</p>
        </div>
        <div className="p-4 grid grid-cols-1 min-[600px]:grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">Rate</p>
            <p className="text-[13px] font-medium">
              {subtotal > 0 ? `${Number(((taxTotal / subtotal) * 100).toFixed(2))}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">Amount</p>
            <p className="text-[13px] font-medium">{formatMoney(taxTotal, currency)}</p>
          </div>
        </div>
      </div>
    )}

    {invoice.deliveryNotes.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
              <div className="border-b border-[var(--line)] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Delivery Notes</p>
              </div>
              <DataTable
                frameless
                rows={invoice.deliveryNotes}
                getRowKey={(dn) => dn.id}
                empty="No delivery notes."
                columns={[
                  {
                    key: "number",
                    header: "DN #",
                    cell: (row: any) => row.deliveryNoteNumber,
                  },
                  {
                    key: "date",
                    header: "Delivered",
                    cell: (row: any) => formatEATDate(row.deliveredAt),
                  },
                  {
                    key: "method",
                    header: "Method",
                    cell: (row: any) => row.deliveryMethod,
                  },
                  {
                    key: "by",
                    header: "Delivered by",
                    cell: (row: any) => row.deliveredByName,
                  },
                  {
                    key: "receivedBy",
                    header: "Received by",
                    cell: (row: any) => row.receivedByName,
                  },
                ]}
              />
            </div>
          )}
        </div>
      </section>
{isEdit && (
  <InvoiceCreateDialog
    currency={currency}
    canOverrideDiscount={canOverrideDiscountEdit}
    clients={clients as any[]}
    leads={leads as any[]}
    jobs={jobs as any[]}
    parts={parts as any[]}
    taxRates={taxRates as any[]}
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
      const clientId = String(fd.get("clientId") ?? "").trim() || null;

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