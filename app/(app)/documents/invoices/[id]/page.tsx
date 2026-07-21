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
          createdBy: { select: { fullName: true } },
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
                href={`/api/invoices/${invoice.id}/pdf`}
                className="btn-premium rounded-lg px-3 py-1.5 text-[12px] font-bold"
              >
                ⬇ PDF
              </Link>
            </div>
          }
        />

        <div className="max-w-6xl mx-auto">
          {invoice.job && (
            <div className="mb-4">
              <Link
                href={`/jobs/${invoice.job.id}`}
                className="text-[13px] text-[var(--accent)] hover:underline"
              >
                Related job: {invoice.job.jobNumber} — {invoice.job.brand}{" "}
                {invoice.job.model}
              </Link>
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="text-[12px] font-bold text-[var(--ink-muted)]">Status</p>
              <p className="mt-1">
                <StatusBadge tone={INVOICE_STATUS_TONES[invoice.status] ?? "neutral"}>
                  {STATUS_LABEL[invoice.status] ?? invoice.status}
                </StatusBadge>
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="text-[12px] font-bold text-[var(--ink-muted)]">Date</p>
              <p className="mt-1 text-[13px] font-medium">
                {formatEATDate(invoice.issuedAt)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="text-[12px] font-bold text-[var(--ink-muted)]">Due</p>
              <p className="mt-1 text-[13px] font-medium">
                {invoice.dueDate ? formatEATDate(invoice.dueDate) : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="text-[12px] font-bold text-[var(--ink-muted)]">Balance</p>
              <p
                className={`mt-1 text-[13px] font-bold ${
                  isPaid
                    ? "text-emerald-700"
                    : isVoid
                    ? "text-red-700"
                    : "text-amber-700"
                }`}
              >
                {isPaid
                  ? "Cleared"
                  : isVoid
                  ? "Voided"
                  : formatMoney(balance, currency)}
              </p>
            </div>
          </div>

          <h3 className="text-sm font-bold text-[var(--ink-muted)] mb-2">
            Line Items
          </h3>
          <DataTable
            rows={invoice.lines}
            getRowKey={(line) => line.id}
            empty="No line items."
            columns={[
              {
                key: "description",
                header: "Description",
                cell: (row: any) => (
                  <span className="font-medium">{row.description}</span>
                ),
              },
              {
                key: "quantity",
                header: "Qty",
                align: "right",
                cell: (row: any) => row.quantity,
              },
              {
                key: "unitPrice",
                header: "Unit Price",
                align: "right",
                cell: (row: any) => formatMoney(row.unitPrice, currency),
              },
              {
                key: "discount",
                header: "Discount",
                align: "right",
                cell: (row: any) =>
                  row.discountAmount ? (
                    <span className="text-red-600">
                      -{formatMoney(row.discountAmount, currency)}
                    </span>
                  ) : (
                    "—"
                  ),
              },
              {
                key: "tax",
                header: "Tax",
                align: "right",
                cell: (row: any) =>
                  row.taxAmount ? (
                    formatMoney(row.taxAmount, currency)
                  ) : (
                    "—"
                  ),
              },
              {
                key: "total",
                header: "Total",
                align: "right",
                cell: (row: any) => (
                  <span className="font-bold">
                    {formatMoney(row.lineTotal, currency)}
                  </span>
                ),
              },
            ]}
          />

          {invoice.notes && (
            <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <h4 className="text-sm font-bold text-[var(--ink)] mb-1">
                Notes
              </h4>
              <p className="text-[13px] text-[var(--ink-muted)] whitespace-pre-wrap">
                {sanitizeText(invoice.notes)}
              </p>
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
                    cell: (row: any) => row.createdBy?.fullName ?? "—",
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
