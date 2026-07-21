// @ts-nocheck
import { orgDb } from "@/lib/db";
import { getCurrentUserRole } from "@/lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { can } from "@/lib/permissions";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATDate } from "@/lib/date-eat";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { StatStrip } from "@/components/ui/StatStrip";
import { canGenerateInvoiceForStatus } from "@/lib/documents";
import Link from "next/link";
import { sanitizeText } from "@/lib/sanitize";

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

  const { id } = await params;
  const db = orgDb(user.orgId);

  const invoice = await db.invoice.findFirst({
    where: { id, orgId: user.orgId },
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
    where: { id: user.orgId },
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

        <StatStrip
          variant="cards"
          columns={5}
          tiles={[
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
          ]}
        />

        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center gap-2 action-bar">
            {invoice.client?.phone && (
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
            {invoice.client?.email && (
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
                  rows={invoice.lines}
                  getRowKey={(l: any) => l.id}
                  dense
                  columns={[
                    {
                      key: "description",
                      header: "Description",
                      cell: (row: any) => (
                        <span className="text-[13px] font-medium">
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
                        <span className="text-[13px]">{row.quantity}</span>
                      ),
                    },
                    {
                      key: "unitPrice",
                      header: "Unit Price",
                      align: "right",
                      className: "w-[110px]",
                      cell: (row: any) => (
                        <span className="mono text-[13px]">
                          {formatMoney(row.unitPrice, currency)}
                        </span>
                      ),
                    },
                    {
                      key: "discount",
                      header: "Discount",
                      align: "right",
                      className: "w-[80px]",
                      cell: (row: any) => (
                        <span className="mono text-[13px] text-[var(--ink-muted)]">
                          {row.discountAmount > 0
                            ? formatMoney(row.discountAmount, currency)
                            : "—"}
                        </span>
                      ),
                    },
                    {
                      key: "tax",
                      header: "Tax",
                      align: "right",
                      className: "w-[80px]",
                      cell: (row: any) => (
                        <span className="mono text-[13px]">
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
                      className: "w-[110px]",
                      cell: (row: any) => (
                        <span className="mono text-[13px] font-bold">
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
            <div className="mt-6">
              <h3 className="text-sm font-bold text-[var(--ink-muted)] mb-2">
                Payment History
              </h3>
              <DataTable
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

          {invoice.deliveryNotes.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-[var(--ink-muted)] mb-2">
                Delivery Notes
              </h3>
              <DataTable
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
    </>
  );
}
