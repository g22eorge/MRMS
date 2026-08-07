import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, QuotationStatus } from "@prisma/client";

import { CopyButton } from "@/components/shared/CopyButton";
import { MenuActionButton, MenuActionLink, MenuSection, RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { QuotationStages } from "@/components/documents/QuotationStages";
import { RecordActionBar } from "@/components/record/RecordActionBar";
import { RecordSummaryRail } from "@/components/record/RecordSummaryRail";
import { ensureInvoiceFromQuotation } from "@/lib/commercial/document-workflow";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { formatEATDate, formatEATDateTime } from "@/lib/date-eat";
import { formatMoney } from "@/lib/currency";
import {
  addQuotationItem,
  deleteQuotation,
  removeQuotationItem,
  updateQuotationDetails,
  updateQuotationItem,
  updateQuotationStatus,
} from "../../actions";

 const QUOTATION_STATUS_TONES: Record<QuotationStatus, BadgeTone> = {
  DRAFT: "neutral",
  SENT: "info",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "neutral",
  VOID: "danger",
};

export default async function QuotationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editError?: string; edit?: string }>;
}) {
  const { id } = await params;
  const filters = await searchParams;
  const { user, orgId } = await requireOrgSession();

  if (!can.createQuotations(user) && !can.viewAllSales(user)) {
    redirect("/dashboard");
  }

  const quotationWhere: Prisma.QuotationWhereInput = {
    id,
    orgId,
    ...(!can.viewAllSales(user) ? { createdById: user.id } : {}),
  };

  const quotation = await prisma.quotation.findFirst({
    where: quotationWhere,
    include: {
      lead: { select: { id: true, fullName: true, phone: true, email: true, organization: true } },
      client: { select: { id: true, fullName: true, phone: true, email: true, organization: true, address: true } },
      job: { select: { id: true, jobNumber: true } },
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      items: { orderBy: { createdAt: "asc" } },
    },
  }).catch(() => null);

  if (!quotation) notFound();

  const currency = quotation.currency;
  const canSend = can.createQuotations(user) && quotation.status === "DRAFT";
  const canAccept = can.approveQuotations(user) && quotation.status === "SENT";
  const canReject = can.createQuotations(user) && quotation.status === "SENT";
  const canEditDraft = can.createQuotations(user) && quotation.status === "DRAFT" && !quotation.convertedToInvoiceId;
  const canConvert = can.createInvoices(user) && quotation.status === "ACCEPTED" && !quotation.convertedToInvoiceId;
  const canOverrideDiscount = can.overrideDiscount(user);
  const recipientName = quotation.client?.fullName ?? quotation.lead?.fullName ?? null;
  const recipientAddress = quotation.client?.address ?? null;
  const taxDisplayLabel = quotation.taxLabel ?? "Tax";
  const taxDisplayRate = quotation.taxRate ?? null;
  const isExpired = quotation.status !== "ACCEPTED" && quotation.validUntil != null && quotation.validUntil < new Date();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pdfHref = `/api/quotations/${quotation.id}`;
  const pdfUrl = `${appUrl}${pdfHref}`;
  const recipientPhone = (quotation.client?.phone ?? quotation.lead?.phone ?? "").replace(/\D/g, "");
  const whatsappPhone = recipientPhone.startsWith("0") ? `256${recipientPhone.slice(1)}` : recipientPhone;
  const emailTo = quotation.client?.email ?? quotation.lead?.email ?? "";
  const shareText = `Hi ${recipientName ?? "there"}, quotation ${quotation.quoteNumber} is ready.\n\nTotal: ${formatMoney(quotation.totalAmount, currency)}\nPDF: ${pdfUrl}`;
  const mailSubject = encodeURIComponent(`Quotation ${quotation.quoteNumber}`);
  const mailBody = encodeURIComponent(`${shareText}\n\nRegards,\n${user.name}`);
  const whatsappText = encodeURIComponent(shareText);

  async function sendAction() {
    "use server";
    try {
      await updateQuotationStatus(id, "SENT");
    } catch {
      redirect(`/sales/quotations/${id}`);
    }
    redirect(`/sales/quotations/${id}`);
  }

  async function acceptAction() {
    "use server";
    try {
      await updateQuotationStatus(id, "ACCEPTED");
    } catch {
      redirect(`/sales/quotations/${id}`);
    }
    redirect(`/sales/quotations/${id}`);
  }

  async function rejectAction() {
    "use server";
    try {
      await updateQuotationStatus(id, "REJECTED");
    } catch {
      redirect(`/sales/quotations/${id}`);
    }
    redirect(`/sales/quotations/${id}`);
  }

  async function updateDetailsAction(formData: FormData) {
    "use server";
    try {
      await updateQuotationDetails(id, {
        issueDate: String(formData.get("issueDate") ?? ""),
        validUntil: String(formData.get("validUntil") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update quotation";
      redirect(`/sales/quotations/${id}?editError=${encodeURIComponent(msg)}`);
    }
    redirect(`/sales/quotations/${id}`);
  }

  async function addItemAction(formData: FormData) {
    "use server";
    try {
      await addQuotationItem(id, {
        description: String(formData.get("description") ?? ""),
        quantity: Number(formData.get("quantity") ?? 1),
        unitPrice: Number(formData.get("unitPrice") ?? 0),
        discount: Number(formData.get("discount") ?? 0),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add item";
      redirect(`/sales/quotations/${id}?editError=${encodeURIComponent(msg)}`);
    }
    redirect(`/sales/quotations/${id}`);
  }

  async function updateItemAction(formData: FormData) {
    "use server";
    const itemId = String(formData.get("itemId") ?? "");
    try {
      await updateQuotationItem(itemId, {
        description: String(formData.get("description") ?? ""),
        quantity: Number(formData.get("quantity") ?? 1),
        unitPrice: Number(formData.get("unitPrice") ?? 0),
        discount: Number(formData.get("discount") ?? 0),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update item";
      redirect(`/sales/quotations/${id}?editError=${encodeURIComponent(msg)}`);
    }
    redirect(`/sales/quotations/${id}`);
  }

  async function removeItemAction(formData: FormData) {
    "use server";
    const itemId = String(formData.get("itemId") ?? "");
    try {
      await removeQuotationItem(itemId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to remove item";
      redirect(`/sales/quotations/${id}?editError=${encodeURIComponent(msg)}`);
    }
    redirect(`/sales/quotations/${id}`);
  }

  async function deleteAction() {
    "use server";
    try {
      await deleteQuotation(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete quotation";
      redirect(`/sales/quotations/${id}?editError=${encodeURIComponent(msg)}`);
    }
  }

  async function convertToInvoiceAction() {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!can.createInvoices(user)) redirect(`/sales/quotations/${id}`);

    const quotation = await prisma.quotation.findFirst({
      where: {
        id,
        orgId,
        status: "ACCEPTED",
        convertedToInvoiceId: null,
        ...(!can.viewAllSales(user) && !can.approveInvoices(user) ? { createdById: user.id } : {}),
      },
      select: { id: true },
    });
    if (!quotation) redirect(`/sales/quotations/${id}`);

    const invoice = await prisma.$transaction(async (tx) => (
      ensureInvoiceFromQuotation(tx, { orgId, quotationId: id, currency: org.baseCurrency })
    ));
    if (invoice) {
      await writeSystemAuditEvent({
        orgId,
        actorUserId: user.id,
        entityType: "Invoice",
        entityId: invoice.id,
        action: "QUOTATION_CONVERTED_TO_INVOICE",
        summary: `Quotation converted to ${invoice.invoiceNumber}`,
      });
      revalidatePath("/documents/invoices");
      revalidatePath("/documents/quotations");
      redirect(`/documents/invoices?pay=${invoice.id}`);
    }
    redirect(`/sales/quotations/${id}`);
  }
  const field =
    "w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none transition placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15";
  const cellInput =
    "w-full min-w-0 rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1 text-[13px] outline-none focus:border-[var(--accent)]/50";
  const cardLabel = "text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70";
  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]";
  const iconBtnDanger =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/20 text-[var(--ink-muted)]/40 transition hover:border-red-400/40 hover:text-red-500";
  const showEdit = canEditDraft && (filters.edit === "1" || Boolean(filters.editError));

  const timeline: Array<{ label: string; value: string; valueClass?: string }> = [
    { label: "Created", value: formatEATDateTime(quotation.createdAt) },
    ...(quotation.sentAt ? [{ label: "Sent", value: formatEATDateTime(quotation.sentAt) }] : []),
    ...(quotation.acceptedAt ? [{ label: "Accepted", value: formatEATDateTime(quotation.acceptedAt), valueClass: "text-emerald-600" }] : []),
    ...(quotation.rejectedAt ? [{ label: "Rejected", value: formatEATDateTime(quotation.rejectedAt), valueClass: "text-red-600" }] : []),
    ...(quotation.approvedBy ? [{ label: "Approved by", value: quotation.approvedBy.name }] : []),
    ...(recipientAddress ? [{ label: "Client address", value: recipientAddress }] : []),
  ];

  return (
    <div className="space-y-4 pb-24 lg:pb-8">
      <RecordActionBar
        backHref="/sales?tab=quotations"
        eyebrow="Quotation"
        title={quotation.quoteNumber}
        status={{ label: quotation.status, tone: toneFor(QUOTATION_STATUS_TONES, quotation.status) }}
        secondary={
          <>
            <Button href={pdfHref} external target="_blank" rel="noreferrer" variant="secondary" size="sm">PDF</Button>
            {canEditDraft ? (
              <Button
                href={showEdit ? `/sales/quotations/${quotation.id}` : `/sales/quotations/${quotation.id}?edit=1`}
                variant={showEdit ? "ghost" : "secondary"}
                size="sm"
              >
                {showEdit ? "Close" : "Edit"}
              </Button>
            ) : null}
          </>
        }
        overflow={
          <RowActionsMenu label={`Quotation actions for ${quotation.quoteNumber}`}>
              <div className="py-1 text-left">
                <MenuActionLink href={pdfHref} external icon="quote" tone="accent">
                  Download Quotation PDF
                </MenuActionLink>
                {quotation.job ? (
                  <MenuActionLink href={`/jobs/${quotation.job.id}`} icon="job">
                    Open Job
                  </MenuActionLink>
                ) : null}
              </div>
              <MenuSection label="Share" />
              <MenuActionLink href={`mailto:${emailTo}?subject=${mailSubject}&body=${mailBody}`} icon="open">
                Email quotation
              </MenuActionLink>
              {whatsappPhone ? (
                <MenuActionLink href={`https://wa.me/${whatsappPhone}?text=${whatsappText}`} external icon="whatsapp" tone="success">
                  Send via WhatsApp
                </MenuActionLink>
              ) : null}
              <div className="px-3 py-1.5">
                <CopyButton
                  text={pdfUrl}
                  label="Copy PDF link"
                  title="Copy quotation PDF link"
                  className="flex w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
                />
              </div>
              {canSend || canAccept || canReject ? <MenuSection label="Status" /> : null}
              {canSend ? (
                <div className="px-3 py-1.5">
                  <form action={sendAction}>
                    <MenuActionButton icon="save" tone="accent">Send to Client</MenuActionButton>
                  </form>
                </div>
              ) : null}
              {canAccept ? (
                <div className="px-3 py-1.5">
                  <form action={acceptAction}>
                    <MenuActionButton icon="save" tone="success">Mark Accepted</MenuActionButton>
                  </form>
                </div>
              ) : null}
              {canReject ? (
                <div className="px-3 py-1.5">
                  <form action={rejectAction}>
                    <MenuActionButton icon="close" tone="danger">Mark Rejected</MenuActionButton>
                  </form>
                </div>
              ) : null}
              {canConvert ? (
                <>
                  <MenuSection label="Convert" />
                  <div className="px-3 py-1.5">
                    <form action={convertToInvoiceAction}>
                      <MenuActionButton icon="invoice" tone="accent">Convert to Invoice</MenuActionButton>
                    </form>
                  </div>
                </>
              ) : quotation.convertedToInvoiceId ? (
                <>
                  <MenuSection label="Invoice" />
                  <MenuActionLink href="/documents/invoices" icon="invoice" tone="success">
                    Invoice Created
                  </MenuActionLink>
                </>
              ) : null}
            </RowActionsMenu>
        }
      />

      {filters.editError ? (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">{filters.editError}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
      <section className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <QuotationStages status={quotation.status} converted={!!quotation.convertedToInvoiceId} />
          {/* Contextual next step — the one action that moves this quote forward. */}
          {canSend ? (
            <form action={sendAction}><Button type="submit" size="sm" className="font-bold">Send to client →</Button></form>
          ) : canAccept ? (
            <div className="flex items-center gap-2">
              <form action={acceptAction}><Button type="submit" size="sm" className="font-bold">Mark accepted →</Button></form>
              {canReject ? <form action={rejectAction}><Button type="submit" variant="ghost" size="sm">Reject</Button></form> : null}
            </div>
          ) : canConvert ? (
            <form action={convertToInvoiceAction}><Button type="submit" size="sm" className="font-bold">Convert to invoice →</Button></form>
          ) : quotation.convertedToInvoiceId ? (
            <Button href="/documents/invoices" variant="secondary" size="sm">View invoice →</Button>
          ) : null}
        </div>
      </section>
      {/* -- Edit draft -- */}
      {showEdit ? (
        <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] px-4 py-2.5">
            <p className={cardLabel}>Edit Draft</p>
          </div>
          <form action={updateDetailsAction} className="grid gap-2 p-3 md:grid-cols-[minmax(0,150px)_minmax(0,150px)_minmax(0,1fr)_auto]">
            <input
              type="date"
              name="issueDate"
              aria-label="Issue date"
              defaultValue={(quotation.issueDate ?? quotation.createdAt).toISOString().slice(0, 10)}
              className={field}
            />
            <input
              type="date"
              name="validUntil"
              aria-label="Valid until"
              defaultValue={quotation.validUntil ? quotation.validUntil.toISOString().slice(0, 10) : ""}
              className={field}
            />
            <input name="notes" defaultValue={quotation.notes ?? ""} placeholder="Notes" aria-label="Notes" className={field} />
            <Button type="submit" variant="secondary" size="sm">Save</Button>
          </form>
          <form action={deleteAction} className="border-t border-[var(--line)] px-3 py-2.5">
            <Button type="submit" variant="danger" size="sm">Delete Draft</Button>
          </form>
        </section>
      ) : null}

      {/* -- Line items -- */}
      <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
          <p className={cardLabel}>Line Items</p>
          <p className="text-[12px] text-[var(--ink-muted)]">
            {quotation.items.length} {quotation.items.length === 1 ? "line" : "lines"} &middot; {formatMoney(quotation.totalAmount, currency)}
          </p>
        </div>

        {canEditDraft ? (
          <form action={addItemAction} className="grid gap-2 border-b border-[var(--line)] bg-[var(--panel-strong)]/40 p-3 md:grid-cols-[minmax(0,1fr)_72px_120px_80px_auto]">
            <input name="description" placeholder="New item description" className={field} />
            <input name="quantity" type="number" min="1" step="any" defaultValue="1" aria-label="Quantity" className={field} />
            <input name="unitPrice" type="number" min="0" step="any" defaultValue="0" aria-label="Unit price" className={field} />
            {canOverrideDiscount ? (
              <input name="discount" type="number" min="0" max="100" step="any" defaultValue="0" aria-label="Discount percent" className={field} />
            ) : <input type="hidden" name="discount" value="0" />}
            <Button type="submit" size="sm" className="px-4">Add</Button>
          </form>
        ) : null}

        <DataTable
          frameless
          dense
          rows={quotation.items}
          getRowKey={(item) => item.id}
          empty="No items yet."
          columns={[
            {
              key: "description",
              header: "Item",
              cell: (item) =>
                canEditDraft ? (
                  <input form={`quote-item-${item.id}`} name="description" defaultValue={item.description} aria-label="Description" className={cellInput} />
                ) : item.description,
            },
            {
              key: "qty",
              header: "Qty",
              className: "w-20 whitespace-nowrap tabular-nums",
              cell: (item) =>
                canEditDraft ? (
                  <input form={`quote-item-${item.id}`} name="quantity" type="number" min="1" step="any" defaultValue={item.quantity} aria-label="Quantity" className={cellInput} />
                ) : item.quantity,
            },
            {
              key: "unitPrice",
              header: "Price",
              className: "w-32 whitespace-nowrap tabular-nums",
              cell: (item) =>
                canEditDraft ? (
                  <input form={`quote-item-${item.id}`} name="unitPrice" type="number" min="0" step="any" defaultValue={item.unitPrice} aria-label="Unit price" className={cellInput} />
                ) : formatMoney(item.unitPrice, currency),
            },
            {
              key: "discount",
              header: "Disc",
              className: "w-20 whitespace-nowrap tabular-nums text-[var(--ink-muted)]",
              cell: (item) =>
                canEditDraft && canOverrideDiscount ? (
                  <input form={`quote-item-${item.id}`} name="discount" type="number" min="0" max="100" step="any" defaultValue={item.discount} aria-label="Discount percent" className={cellInput} />
                ) : item.discount > 0 ? `${item.discount}%` : <span className="opacity-30">&mdash;</span>,
            },
            {
              key: "total",
              header: "Total",
              className: "whitespace-nowrap font-semibold tabular-nums",
              cell: (item) => formatMoney(item.lineTotal, currency),
            },
          ]}
          actions={
            canEditDraft
              ? (item) => (
                  <div className="flex items-center justify-end gap-1.5">
                    <form id={`quote-item-${item.id}`} action={updateItemAction}>
                      <input type="hidden" name="itemId" value={item.id} />
                      {!canOverrideDiscount ? <input type="hidden" name="discount" value="0" /> : null}
                      <button type="submit" title="Save line" className={iconBtn}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                    </form>
                    <form action={removeItemAction}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <button type="submit" title="Remove line" className={iconBtnDanger}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                      </button>
                    </form>
                  </div>
                )
              : undefined
          }
        />

        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 border-t border-[var(--line)] bg-[var(--panel-strong)]/40 px-4 py-2.5 text-[12px] text-[var(--ink-muted)]">
          {quotation.discountAmount > 0 ? <span>Discount <span className="font-semibold text-red-600">-{formatMoney(quotation.discountAmount, currency)}</span></span> : null}
          {quotation.vatAmount > 0 ? (
            <span>
              {taxDisplayLabel}{taxDisplayRate !== null ? ` (${taxDisplayRate}%)` : ""}{" "}
              <span className="font-semibold text-[var(--ink)]">{formatMoney(quotation.vatAmount, currency)}</span>
            </span>
          ) : null}
          <span className="text-[13px]">Total <span className="font-bold tabular-nums text-[var(--ink)]">{formatMoney(quotation.totalAmount, currency)}</span></span>
        </div>
      </section>

        </div>

        <RecordSummaryRail
          headline={{ label: "Total", value: formatMoney(quotation.totalAmount, currency) }}
          rows={[
            ...(quotation.discountAmount > 0 ? [{ label: "Discount", value: `-${formatMoney(quotation.discountAmount, currency)}` }] : []),
            ...(quotation.vatAmount > 0 ? [{ label: `${taxDisplayLabel}${taxDisplayRate !== null ? ` (${taxDisplayRate}%)` : ""}`, value: formatMoney(quotation.vatAmount, currency) }] : []),
            { label: "Issue date", value: formatEATDate(quotation.issueDate ?? quotation.createdAt) },
            { label: "Valid Until", value: quotation.validUntil ? (isExpired ? `${formatEATDate(quotation.validUntil)} · expired` : formatEATDate(quotation.validUntil)) : "Open" },
            { label: "Created by", value: quotation.createdBy?.name ?? "unknown" },
          ]}
          party={{ title: "Recipient", name: recipientName ?? "No recipient", lines: [recipientAddress] }}
          related={[
            ...(quotation.lead ? [{ label: "Lead", href: `/sales/leads/${quotation.lead.id}`, sub: quotation.lead.fullName }] : []),
            ...(quotation.job ? [{ label: quotation.job.jobNumber, href: `/jobs/${quotation.job.id}`, sub: "Repair job" }] : []),
            ...(quotation.convertedToInvoiceId ? [{ label: "Invoice created", href: "/documents/invoices", tone: "success" as const }] : []),
          ]}
          activity={timeline.map((t) => ({ label: t.label, at: t.value }))}
        />
      </div>

      {quotation.notes ? (
        <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]/70">Notes</p>
          <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-[var(--ink)]">{quotation.notes}</p>
        </section>
      ) : null}
    </div>
  );
}
