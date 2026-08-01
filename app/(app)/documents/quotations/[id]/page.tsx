// @ts-nocheck
export const dynamic = "force-dynamic";

/* Edit handled via ?edit=1 inline form */

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
import { StatCards } from "@/components/ui/StatCards";
import Link from "next/link";
import { sanitizeText } from "@/lib/sanitize";

const QUOTATION_STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  SENT: "sky",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "slate",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Pending",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

export default async function QuotationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { user } = await getCurrentUserRole();
  if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) redirect("/dashboard");

  const { id } = await params;
  const sp = await searchParams;

  const db = orgDb(user.orgId);

  const quotation = await db.quotation.findFirst({
    where: { id, orgId: user.orgId },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      currency: true,
      totalAmount: true,
      validUntil: true,
      notes: true,
      discountAmount: true,
  vatAmount: true,
  taxRate: true,
  taxLabel: true,
  createdAt: true,
      client: { select: { id: true, fullName: true, phone: true, email: true, organization: true, address: true } },
      job: { select: { id: true, jobNumber: true, brand: true, model: true, serialOrImei: true } },
      items: { select: { id: true, description: true, quantity: true, unitPrice: true, discount: true, lineTotal: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!quotation) redirect("/documents/quotations");

  const org = await db.organization.findFirst({ where: { id: user.orgId! }, select: { baseCurrency: true } });
  const currency = normalizeCurrency(org?.baseCurrency ?? "UGX", normalizeCurrency(quotation.currency, "UGX"));
  const subtotal = quotation.items.reduce((sum, item) => sum + item.lineTotal, 0);
  const canDelete = ["ADMIN", "OPS"].includes(user.role);
  const isEdit = sp?.edit === "1";
  const isVoid = quotation.status === "VOID";
  const publicLink = `/view/quote/${quotation.id}`;
  const canSend = can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role);

  async function deleteQuotationAction(formData: FormData) {
    "use server";
    const { user } = await getCurrentUserRole();
    if (!canDelete) redirect("/dashboard");
    const db = orgDb(user.orgId);
    await db.quotation.delete({ where: { id } });
    revalidatePath("/documents/quotations");
    redirect("/documents/quotations");
  }

  async function editQuotationAction(formData: FormData) {
    "use server";
    const { user } = await getCurrentUserRole();
    if (!can.createQuotations(user)) redirect("/dashboard");
    const db = orgDb(user.orgId);
    const quotationId = String(formData.get("id") ?? "").trim();
    if (!quotationId) return;
    const validUntilRaw = String(formData.get("validUntil") ?? "").trim();
    const notes = sanitizeText(String(formData.get("notes") ?? "")).trim();
    await db.quotation.updateMany({
      where: { id: quotationId },
      data: {
        validUntil: validUntilRaw ? new Date(validUntilRaw) : null,
        notes: notes || null,
      },
    });
    revalidatePath(`/documents/quotations/${quotationId}`);
    revalidatePath("/documents/quotations");
    redirect(`/documents/quotations/${quotationId}`);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `/* print styles injected at runtime */` }} />
      <section className="space-y-4 pb-20" id="print-area">
        <PageHeader
          title={`Quotation ${(quotation as any).quoteNumber}`}
          eyebrow="Documents · Quotations"
          description={sanitizeText(quotation.notes ?? "Quotation")}
          actions={
            <div className="flex flex-wrap items-center gap-2 action-bar">
              <Link href="/documents/quotations" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">← Back</Link>
        <Link href={`/documents/quotations/${quotation.id}?edit=1`} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">Edit</Link>
                      <Link href={`/api/quotations/${quotation.id}/pdf`} className="btn-premium rounded-lg px-3 py-1.5 text-[12px] font-bold">PDF</Link>
            </div>
          }
        />
        <StatCards columns={5} cards={[
            { label: "Quote #", value: (quotation as any).quoteNumber },
            { label: "Date", value: formatEATDate(quotation.createdAt) },
            { label: "Valid Until", value: ((quotation as any).validUntil) ? formatEATDate((quotation as any).validUntil) : "—" },
            { label: "Status", value: <StatusBadge tone={QUOTATION_STATUS_TONES[quotation.status] ?? "neutral"}>{STATUS_LABEL[quotation.status] ?? quotation.status}</StatusBadge> },
            { label: "Total", value: formatMoney(quotation.totalAmount, currency) },
        ]} />
      <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 action-bar">
          {canSend && quotation.client?.phone && (
            <form action={`/api/quotations/${quotation.id}/whatsapp`} method="POST" className="inline">
              <input type="hidden" name="toPhone" value={quotation.client.phone} />
              <button type="submit" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">WhatsApp</button>
            </form>
          )}
          {canSend && quotation.client?.email && (
            <form action={`/api/quotations/${quotation.id}/send`} method="POST" className="inline">
              <input type="hidden" name="toEmail" value={quotation.client.email} />
              <button type="submit" className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">Email</button>
            </form>
          )}
          {canDelete && (
            <form action={deleteQuotationAction} className="inline">
              <input type="hidden" name="id" value={quotation.id} />
              <button type="submit" className="btn-premium-destructive rounded-lg px-3 py-1.5 text-[12px] font-medium">Delete</button>
            </form>
        )}
      </div>

        {quotation.client && (
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="border-b border-[var(--line)] px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Client</p></div>
            <div className="p-4 grid grid-cols-1 min-[600px]:grid-cols-2 gap-3">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">Name</p><p className="text-[13px] font-medium">{quotation.client.fullName}</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">Phone</p><p className="text-[13px] font-medium">{quotation.client.phone ?? "—"}</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">Email</p><p className="text-[13px] font-medium">{quotation.client.email ?? "—"}</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">Organization</p><p className="text-[13px] font-medium">{quotation.client.organization ?? "—"}</p></div>
              <div className="min-[600px]:col-span-2"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">Address</p><p className="text-[13px] font-medium whitespace-pre-wrap">{quotation.client.address ?? "—"}</p></div>
            </div>
          </div>
        )}

        {quotation.job && (
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="border-b border-[var(--line)] px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Job</p></div>
            <div className="p-4 grid grid-cols-1 min-[600px]:grid-cols-2 gap-3">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">Job #</p><p className="text-[13px] font-medium">{quotation.job.jobNumber}</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">Device</p><p className="text-[13px] font-medium">{quotation.job.brand} {quotation.job.model}</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">Serial / IMEI</p><p className="text-[13px] font-medium">{quotation.job.serialOrImei ?? "—"}</p></div>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Line Items</p></div>
          {quotation.items.length ? (
            <>
              <DataTable frameless rows={quotation.items} getRowKey={(l: any) => l.id} dense columns={[
                { key: "description", header: "Description", cell: (row: any) => <span className="font-medium">{row.description}</span> },
                { key: "quantity", header: "Qty", align: "center", className: "w-[60px]", cell: (row: any) => <span className="">{row.quantity}</span> },
{ key: "unitPrice", header: "Unit Price", align: "right", className: "min-w-[100px] whitespace-nowrap", cell: (row: any) => <span className="mono tabular-nums">{formatMoney(row.unitPrice, currency)}</span> },
{ key: "total", header: "Total", align: "right", className: "min-w-[100px] whitespace-nowrap", cell: (row: any) => <span className="mono font-bold tabular-nums">{formatMoney(row.lineTotal, currency)}</span> },
              ]} />
              <div className="flex flex-col items-end gap-1 border-t border-[var(--line)] px-4 py-3">
                <div className="flex w-full max-w-xs justify-between text-[13px]"><span className="text-[var(--ink-muted)]">Subtotal</span><span className="mono font-medium">{formatMoney(subtotal, currency)}</span></div>
                {quotation.discountAmount > 0 && <div className="flex w-full max-w-xs justify-between text-[13px]"><span className="text-[var(--ink-muted)]">Discount</span><span className="mono text-red-500">{formatMoney(quotation.discountAmount, currency)}</span></div>}
                {quotation.vatAmount > 0 && <div className="flex w-full max-w-xs justify-between text-[13px]"><span className="text-[var(--ink-muted)]">Tax (VAT)</span><span className="mono font-medium">{formatMoney(quotation.vatAmount, currency)}</span></div>}
                <div className="flex w-full max-w-xs justify-between text-[14px] border-t border-[var(--line)] pt-1"><span className="font-bold">Total</span><span className="mono font-black">{formatMoney(quotation.totalAmount, currency)}</span></div>
              </div>
            </>
          ) : <div className="p-4 text-[13px] text-[var(--ink-muted)]">No items.</div>}
        </div>

        {(quotation.taxRate || quotation.taxLabel) && (
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="border-b border-[var(--line)] px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Tax</p></div>
            <div className="p-4 grid grid-cols-1 min-[600px]:grid-cols-2 gap-3">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">Rate</p><p className="text-[13px] font-medium">{typeof quotation.taxRate === "number" ? `${quotation.taxRate}%` : "—"}</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">Label</p><p className="text-[13px] font-medium">{quotation.taxLabel ?? "—"}</p></div>
            </div>
          </div>
        )}

    {quotation.notes && (
          <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="border-b border-[var(--line)] px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Notes</p></div>
            <div className="p-4 text-[13px] whitespace-pre-wrap text-[var(--ink-muted)]">{quotation.notes}</div>
          </div>
        )}
        </div>
    </section>
      {isEdit ? (
      <section className="space-y-4 pb-20">
        <PageHeader
          title={`Edit Quotation ${(quotation as any).quoteNumber}`}
          eyebrow="Documents · Quotations"
          description="Edit header fields"
          actions={
            <div className="flex flex-wrap items-center gap-2 action-bar">
              <Link href={`/documents/quotations/${quotation.id}`} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">← Back to view</Link>
            </div>
          }
        />
        <form
          action={async (fd: FormData) => {
            "use server";
            const { user } = await getCurrentUserRole();
            if (!(can.viewFinancials(user) || ["ADMIN", "OPS"].includes(user.role))) redirect("/dashboard");
            const db = orgDb(user.orgId);
            const validUntilRaw = String(fd.get("validUntil") ?? "").trim();
            await db.quotation.updateMany({
              where: { id, orgId: user.orgId },
              data: {
                validUntil: validUntilRaw ? new Date(validUntilRaw) : null,
                notes: String(fd.get("notes") ?? "").trim() || null,
              },
            });
            revalidatePath(`/documents/quotations/${id}`);
            revalidatePath("/documents/quotations");
            redirect(`/documents/quotations/${id}`);
          }}
          className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]"
        >
          <input type="hidden" name="id" value={quotation.id} />
          <div className="border-b border-[var(--line)] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Edit Quotation</p>
          </div>
          <div className="p-4 grid grid-cols-1 min-[600px]:grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">Valid Until</p>
              <input name="validUntil" type="date" defaultValue={((quotation as any).validUntil) ? new Date((quotation as any).validUntil).toISOString().slice(0, 10) : ""} className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
            </div>
          </div>
          <div className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)] mb-1">Notes</p>
            <textarea name="notes" defaultValue={(quotation as any).notes ?? ""} rows={4} className="w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]/50 resize-y" />
          </div>
          <div className="border-t border-[var(--line)] px-4 py-3 flex items-center gap-2">
            <button type="submit" className="btn-premium rounded-lg px-4 py-2 text-[13px] font-bold">Save Changes</button>
            <Link href={`/documents/quotations/${quotation.id}`} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[12px] font-medium">Cancel</Link>
          </div>
        </form>
      </section>
    ) : null}
    </>
  );
}
