export const dynamic = "force-dynamic";

/* Edit handled via ?edit=1 inline form */

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { can } from "@/lib/permissions";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { formatEATDate } from "@/lib/date-eat";
import type { BadgeTone } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import Link from "next/link";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { sanitizeText } from "@/lib/sanitize";
import { addQuotationItem, updateQuotationItem, removeQuotationItem } from "@/app/(app)/sales/actions";
import { QuotationStages } from "@/components/documents/QuotationStages";
import { shareQuotationDocument } from "@/lib/notifications/share-document";
import { ensureInvoiceFromQuotation } from "@/lib/commercial/document-workflow";
import { DocumentActionBar } from "@/components/documents/DocumentActionBar";
import { DocumentSummaryRail } from "@/components/documents/DocumentSummaryRail";
import { RowActionsMenu, MenuDestructiveRow } from "@/components/shared/RowActionsMenu";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";

import { flash } from "@/lib/flash";
import { PartPickerField } from "@/components/forms/PartPickerField";
const QUOTATION_STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  SENT: "sky",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "slate",
  VOID: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Pending",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  VOID: "Void",
};

const cardClass = "overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]";
const cardHeadClass = "border-b border-[var(--line)] px-4 py-3 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]";

/** Ties the line-item inputs to the "Save changes" form they submit with. */
const EDIT_FORM_ID = "quotation-edit-form";

export default async function QuotationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { user } = await getCurrentUserRole();
  if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) redirect("/dashboard");
  if (!user.orgId) redirect("/dashboard");
  const orgId = user.orgId;

  const { id } = await params;
  const sp = await searchParams;

  const quotation = await prisma.quotation.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      currency: true,
      totalAmount: true,
      issueDate: true,
      validUntil: true,
      notes: true,
      discountAmount: true,
      vatAmount: true,
      taxRate: true,
      taxLabel: true,
      createdAt: true,
      convertedToInvoiceId: true,
      client: { select: { id: true, fullName: true, phone: true, email: true, organization: true, address: true } },
      job: { select: { id: true, jobNumber: true, brand: true, model: true, serialOrImei: true } },
      items: { select: { id: true, partId: true, description: true, quantity: true, unitPrice: true, discount: true, lineTotal: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!quotation) redirect("/documents/quotations");

  const org = await prisma.organization.findFirst({ where: { id: orgId }, select: { baseCurrency: true } });
  const currency = normalizeCurrency(org?.baseCurrency, normalizeCurrency(quotation.currency, "UGX"));
  const subtotal = quotation.items.reduce((sum, item) => sum + item.lineTotal, 0);
  const total = quotation.totalAmount || subtotal;

  // The convert target may be stored as an invoice id (canonical) or, from older
  // rows, an invoice number — resolve either so the related link is reliable.
  const convertedInvoice = quotation.convertedToInvoiceId
    ? await prisma.invoice.findFirst({
        where: { orgId, OR: [{ id: quotation.convertedToInvoiceId }, { invoiceNumber: quotation.convertedToInvoiceId }] },
        select: { id: true, invoiceNumber: true },
      })
    : null;

  const isVoid = quotation.status === "VOID";
  // Governance: a quotation is only editable while it is still a DRAFT and has
  // not been converted to an invoice. Once sent/accepted/converted it is locked.
  const canEdit = quotation.status === "DRAFT" && !quotation.convertedToInvoiceId;
  const isEdit = sp?.edit === "1" && canEdit;
  // Only needed while editing, and only active stock is offerable.
  const parts = isEdit
    ? await prisma.part.findMany({
        where: { orgId, isActive: true },
        orderBy: { name: "asc" },
        take: 500,
        select: { id: true, sku: true, name: true, sellingPrice: true, unitCost: true, qtyOnHand: true },
      })
    : [];
  const sent = typeof sp?.sent === "string" ? sp.sent : undefined;
  const canDelete = ["ADMIN", "OPS"].includes(user.role);
  const canSend = can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role);
  const canConvert = can.createInvoices(user) && !convertedInvoice && !isVoid && ["DRAFT", "SENT", "ACCEPTED"].includes(quotation.status);

  async function sendQuotationWhatsAppAction() {
    "use server";
    const { user: actor, orgId: actorOrg } = await requireOrgSession();
    if (!(can.viewFinancials(actor) || ["ADMIN", "OPS", "FRONT_DESK"].includes(actor.role))) return;
    const ok = await shareQuotationDocument({ orgId: actorOrg, quotationId: id, channel: "whatsapp" });
    redirect(`/documents/quotations/${id}?sent=${ok ? "whatsapp" : "failed"}`);
  }
  async function sendQuotationEmailAction() {
    "use server";
    const { user: actor, orgId: actorOrg } = await requireOrgSession();
    if (!(can.viewFinancials(actor) || ["ADMIN", "OPS", "FRONT_DESK"].includes(actor.role))) return;
    const ok = await shareQuotationDocument({ orgId: actorOrg, quotationId: id, channel: "email" });
    redirect(`/documents/quotations/${id}?sent=${ok ? "email" : "failed"}`);
  }

  async function convertToInvoiceAction() {
    "use server";
    const { user: actor, orgId: actorOrg, org: actorOrgRec } = await requireOrgSession();
    if (!can.createInvoices(actor)) redirect("/dashboard");
    // Creating an invoice must stop for a read-only user and for a suspended
    // workspace. can.createInvoices covers neither.
    assertOrgCanMutate({ access: actorOrgRec.access, userRole: actor.role, userAccessMode: actor.accessMode, kind: "GENERAL" });
    const orgRec = await prisma.organization.findUnique({ where: { id: actorOrg }, select: { baseCurrency: true } });
    const cur = normalizeCurrency(orgRec?.baseCurrency, "UGX");
    const invoice = await prisma.$transaction((tx) => ensureInvoiceFromQuotation(tx, { orgId: actorOrg, quotationId: id, currency: cur }));
    revalidatePath("/documents/quotations");
    if (invoice) {
      revalidatePath("/documents/invoices");
      redirect(flash(`/documents/invoices/${invoice.id}`, "Quotation converted to invoice"));
    }
    redirect(`/documents/quotations/${id}`);
  }

  async function deleteQuotationAction() {
    "use server";
    const { user: actor, orgId: actorOrg, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: actor.role, userAccessMode: actor.accessMode, kind: "GENERAL" });
    if (!["ADMIN", "OPS"].includes(actor.role)) redirect("/dashboard");
    await prisma.quotation.deleteMany({ where: { id, orgId: actorOrg } });
    revalidatePath("/documents/quotations");
    redirect(flash("/documents/quotations", "Quotation deleted"));
  }

  const status: { label: string; tone: BadgeTone } = {
    label: STATUS_LABEL[quotation.status] ?? quotation.status,
    tone: QUOTATION_STATUS_TONES[quotation.status] ?? "neutral",
  };

  const primary = canConvert ? (
    <form action={convertToInvoiceAction} className="inline">
      <SubmitButton size="sm" pendingLabel="Converting…" className="font-bold">Convert to invoice</SubmitButton>
    </form>
  ) : null;

  const secondary = (
    <>
      {canSend && quotation.client?.phone && (
        <form action={sendQuotationWhatsAppAction} className="inline">
          <SubmitButton bare className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[0.75rem] font-medium">WhatsApp</SubmitButton>
        </form>
      )}
      {canSend && quotation.client?.email && (
        <form action={sendQuotationEmailAction} className="inline">
          <SubmitButton bare className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[0.75rem] font-medium">Email</SubmitButton>
        </form>
      )}
      {/* Quotation PDF is served by the [id] route's GET — there is no /pdf subroute. */}
      <Link href={`/api/quotations/${quotation.id}`} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[0.75rem] font-medium">PDF</Link>
      {canEdit ? <Link href={`/documents/quotations/${quotation.id}?edit=1`} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[0.75rem] font-medium">Edit</Link> : null}
    </>
  );

  const overflow = canDelete ? (
    <RowActionsMenu label="More actions">
      <MenuDestructiveRow>
        <form action={deleteQuotationAction}>
          <ConfirmSubmitButton
            message="Delete this quotation? This cannot be undone."
            confirmLabel="Delete"
            className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm font-semibold text-red-600 dark:text-red-400"
          >
            Delete quotation
          </ConfirmSubmitButton>
        </form>
      </MenuDestructiveRow>
    </RowActionsMenu>
  ) : null;

  const rows = [
    { label: "Issue date", value: formatEATDate(quotation.issueDate ?? quotation.createdAt) },
    { label: "Valid until", value: quotation.validUntil ? formatEATDate(quotation.validUntil) : "—" },
    { label: "Subtotal", value: formatMoney(subtotal, currency) },
    ...(quotation.discountAmount > 0 ? [{ label: "Discount", value: `− ${formatMoney(quotation.discountAmount, currency)}` }] : []),
    ...(quotation.vatAmount > 0 ? [{ label: quotation.taxLabel ?? "Tax", value: formatMoney(quotation.vatAmount, currency) }] : []),
  ];

  const related = [
    ...(quotation.job ? [{ label: quotation.job.jobNumber, href: `/jobs/${quotation.job.id}`, sub: `${quotation.job.brand} ${quotation.job.model}`.trim() || "Job" }] : []),
    ...(convertedInvoice ? [{ label: convertedInvoice.invoiceNumber, href: `/documents/invoices/${convertedInvoice.id}`, sub: "Converted invoice" }] : []),
  ];

  const activity = [{ label: "Created", at: formatEATDate(quotation.createdAt) }];

  return (
    <>
      <section className="space-y-4 pb-20">
        <DocumentActionBar
          backHref="/documents/quotations"
          eyebrow="Documents · Quotations"
          title={`Quotation ${quotation.quoteNumber}`}
          status={status}
          primary={primary}
          secondary={secondary}
          overflow={overflow}
        />

        {sent && (
          <div
            className={`rounded-xl border px-4 py-3 text-[0.8125rem] font-medium ${
              sent === "failed"
                ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            }`}
          >
            {sent === "whatsapp" && "WhatsApp message queued — track delivery in the outbox."}
            {sent === "email" && "Email queued — track delivery in the outbox."}
            {sent === "failed" && "Could not send: this quotation has no client phone or email on file."}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className={`${cardClass} px-4 py-3`}>
              <QuotationStages status={quotation.status} converted={!!quotation.convertedToInvoiceId} />
            </div>
            <div className={cardClass}>
              <div className={cardHeadClass}>Line Items{isEdit && quotation.status === "DRAFT" ? " · editing" : ""}</div>
              {isEdit && quotation.status === "DRAFT" ? (
                <>
                  <div className="divide-y divide-[var(--line)]">
                    {quotation.items.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-end gap-2 p-3">
                        {/* These inputs belong to the "Save changes" form at the
                            bottom of the page, joined to it by id rather than by
                            nesting — a form cannot contain the Remove form that
                            sits alongside them. Every row therefore saves with
                            the one Save button, which is what the button says. */}
                        <div className="flex flex-1 flex-wrap items-end gap-2">
                          <label className="min-w-[150px] flex-1 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Description
                            <PartPickerField
                              parts={parts}
                              formId={EDIT_FORM_ID}
                              name={`desc__${item.id}`}
                              partIdName={`part__${item.id}`}
                              priceFieldName={`price__${item.id}`}
                              defaultValue={item.description}
                              defaultPartId={item.partId ?? ""}
                            />
                          </label>
                          <label className="w-14 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Qty
                            <input form={EDIT_FORM_ID} name={`qty__${item.id}`} type="number" min="1" step="any" defaultValue={item.quantity} className="mt-1 h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                          </label>
                          <label className="w-24 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Unit Price
                            <input form={EDIT_FORM_ID} name={`price__${item.id}`} type="number" min="0" step="any" defaultValue={item.unitPrice} className="mt-1 h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                          </label>
                          <label className="w-14 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Disc %
                            <input form={EDIT_FORM_ID} name={`disc__${item.id}`} type="number" min="0" max="100" step="any" defaultValue={item.discount} className="mt-1 h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                          </label>
                        </div>
                        <form
                          action={async (fd: FormData) => {
                            "use server";
                            await removeQuotationItem(String(fd.get("itemId") ?? ""));
                            revalidatePath(`/documents/quotations/${id}`);
                            redirect(flash(`/documents/quotations/${id}?edit=1`, "Line item removed"));
                          }}
                        >
                          <input type="hidden" name="itemId" value={item.id} />
                          <SubmitButton bare className="h-9 rounded-md border border-red-500/30 px-3 text-[0.75rem] font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400">Remove</SubmitButton>
                        </form>
                      </div>
                    ))}
                    <form
                      action={async (fd: FormData) => {
                        "use server";
                        await addQuotationItem(id, {
                          description: String(fd.get("description") ?? ""),
                          partId: String(fd.get("partId") ?? "") || null,
                          quantity: Number(fd.get("quantity")) || 1,
                          unitPrice: Number(fd.get("unitPrice")) || 0,
                          discount: Number(fd.get("discount")) || 0,
                        });
                        revalidatePath(`/documents/quotations/${id}`);
                        redirect(flash(`/documents/quotations/${id}?edit=1`, "Line item added"));
                      }}
                      className="flex flex-wrap items-end gap-2 bg-[var(--panel-strong)]/40 p-3"
                    >
                      <label className="min-w-[150px] flex-1 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Add line
                        <PartPickerField parts={parts} required placeholder="New line item — or pick from inventory" />
                      </label>
                      <label className="w-14 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Qty
                        <input name="quantity" type="number" min="1" step="any" defaultValue={1} className="mt-1 h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                      </label>
                      <label className="w-24 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Unit Price
                        <input name="unitPrice" type="number" min="0" step="any" defaultValue={0} className="mt-1 h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                      </label>
                      <label className="w-14 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Disc %
                        <input name="discount" type="number" min="0" max="100" step="any" defaultValue={0} className="mt-1 h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                      </label>
                      <SubmitButton bare className="btn-premium h-9 rounded-md px-3 text-[0.75rem] font-bold">Add line</SubmitButton>
                    </form>
                  </div>
                  {/* The Save button for these rows lives further down the page,
                      in the card that owns the form. Repeating it here means the
                      edit can be saved from where it was made. */}
                  <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3">
                    <p className="text-[0.75rem] text-[var(--ink-muted)]">
                      Line changes save with the quotation.
                    </p>
                    <SubmitButton
                      bare
                      form={EDIT_FORM_ID}
                      className="btn-premium rounded-lg px-4 py-2 text-[0.75rem] font-bold"
                    >
                      Save changes
                    </SubmitButton>
                  </div>
                  <div className="flex flex-col items-end gap-1 border-t border-[var(--line)] px-4 py-3">
                    <div className="flex w-full max-w-xs justify-between text-[0.8125rem]"><span className="text-[var(--ink-muted)]">Subtotal</span><span className="mono font-medium">{formatMoney(subtotal, currency)}</span></div>
                    {quotation.vatAmount > 0 && <div className="flex w-full max-w-xs justify-between text-[0.8125rem]"><span className="text-[var(--ink-muted)]">{quotation.taxLabel ?? "Tax"}</span><span className="mono font-medium">{formatMoney(quotation.vatAmount, currency)}</span></div>}
                    <div className="flex w-full max-w-xs justify-between border-t border-[var(--line)] pt-1 text-[0.875rem]"><span className="font-bold">Total</span><span className="mono font-black">{formatMoney(total, currency)}</span></div>
                  </div>
                </>
              ) : quotation.items.length ? (
                <>
                  <DataTable
                    frameless
                    rows={quotation.items}
                    getRowKey={(l) => l.id}
                    dense
                    columns={[
                      { key: "description", header: "Description", cell: (row) => <span className="font-medium">{row.description}</span> },
                      { key: "quantity", header: "Qty", align: "center", className: "w-[60px] whitespace-nowrap tabular-nums", cell: (row) => <span>{row.quantity}</span> },
                      { key: "unitPrice", header: "Unit Price", align: "right", className: "min-w-[100px] whitespace-nowrap", cell: (row) => <span className="mono tabular-nums">{formatMoney(row.unitPrice, currency)}</span> },
                      { key: "total", header: "Total", align: "right", className: "min-w-[100px] whitespace-nowrap", cell: (row) => <span className="mono font-bold tabular-nums">{formatMoney(row.lineTotal, currency)}</span> },
                    ]}
                  />
                  <div className="flex flex-col items-end gap-1 border-t border-[var(--line)] px-4 py-3">
                    <div className="flex w-full max-w-xs justify-between text-[0.8125rem]"><span className="text-[var(--ink-muted)]">Subtotal</span><span className="mono font-medium">{formatMoney(subtotal, currency)}</span></div>
                    {quotation.discountAmount > 0 && <div className="flex w-full max-w-xs justify-between text-[0.8125rem]"><span className="text-[var(--ink-muted)]">Discount</span><span className="mono text-red-500">− {formatMoney(quotation.discountAmount, currency)}</span></div>}
                    {quotation.vatAmount > 0 && <div className="flex w-full max-w-xs justify-between text-[0.8125rem]"><span className="text-[var(--ink-muted)]">{quotation.taxLabel ?? "Tax"}</span><span className="mono font-medium">{formatMoney(quotation.vatAmount, currency)}</span></div>}
                    <div className="flex w-full max-w-xs justify-between border-t border-[var(--line)] pt-1 text-[0.875rem]"><span className="font-bold">Total</span><span className="mono font-black">{formatMoney(total, currency)}</span></div>
                  </div>
                </>
              ) : <div className="p-4 text-[0.8125rem] text-[var(--ink-muted)]">No items.</div>}
            </div>

            {quotation.notes && (
              <div className={cardClass}>
                <div className={cardHeadClass}>Notes</div>
                <div className="whitespace-pre-wrap p-4 text-[0.8125rem] text-[var(--ink-muted)]">{sanitizeText(quotation.notes)}</div>
              </div>
            )}

            {isEdit && (
              <form
                action={async (fd: FormData) => {
                  "use server";
                  const { user: actor, orgId: actorOrg, org } = await requireOrgSession();
                  assertOrgCanMutate({ access: org.access, userRole: actor.role, userAccessMode: actor.accessMode, kind: "GENERAL" });
                  if (!(can.viewFinancials(actor) || ["ADMIN", "OPS"].includes(actor.role))) redirect("/dashboard");
                  const issueDateRaw = String(fd.get("issueDate") ?? "").trim();
                  const validUntilRaw = String(fd.get("validUntil") ?? "").trim();
                  await prisma.quotation.updateMany({
                    where: { id, orgId: actorOrg, status: "DRAFT", convertedToInvoiceId: null },
                    data: {
                      issueDate: issueDateRaw ? new Date(issueDateRaw) : null,
                      validUntil: validUntilRaw ? new Date(validUntilRaw) : null,
                      notes: String(fd.get("notes") ?? "").trim() || null,
                    },
                  });
                  // The line-item inputs post with this form, so the one button
                  // labelled "Save changes" saves the lines too. It previously
                  // saved only the fields in this card while each row carried
                  // its own small Save: editing a price and clicking the obvious
                  // primary button discarded the edit and then said
                  // "Quotation saved", which is the worst possible outcome —
                  // silent loss with a success message on top.
                  // Re-read the rows rather than closing over quotation.items:
                  // a server action serialises everything it captures, and the
                  // loaded rows carry Prisma types that have no business
                  // crossing that boundary.
                  const rows = await prisma.quotationItem.findMany({
                    where: { quotationId: id, quotation: { orgId: actorOrg } },
                    select: { id: true, quantity: true, unitPrice: true, discount: true },
                  });
                  for (const item of rows) {
                    const price = Number(fd.get(`price__${item.id}`));
                    const qty = Number(fd.get(`qty__${item.id}`));
                    const disc = Number(fd.get(`disc__${item.id}`));
                    const desc = fd.get(`desc__${item.id}`);
                    // A row missing from the payload is a row that was not
                    // rendered; leave it alone rather than overwrite it with
                    // defaults.
                    if (desc === null) continue;
                    await updateQuotationItem(item.id, {
                      description: String(desc),
                      partId: String(fd.get(`part__${item.id}`) ?? "") || null,
                      quantity: Number.isFinite(qty) && qty > 0 ? qty : item.quantity,
                      unitPrice: Number.isFinite(price) && price >= 0 ? price : item.unitPrice,
                      discount: Number.isFinite(disc) && disc >= 0 ? disc : item.discount,
                    });
                  }
                  revalidatePath(`/documents/quotations/${id}`);
                  revalidatePath("/documents/quotations");
                  redirect(flash(`/documents/quotations/${id}`, "Quotation saved"));
                }}
                id={EDIT_FORM_ID}
                className={cardClass}
              >
                <div className={cardHeadClass}>Edit quotation</div>
                <div className="grid grid-cols-1 gap-3 p-4 min-[600px]:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Issue Date</p>
                    <input name="issueDate" type="date" defaultValue={(quotation.issueDate ?? quotation.createdAt) ? new Date(quotation.issueDate ?? quotation.createdAt).toISOString().slice(0, 10) : ""} className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                  </div>
                  <div>
                    <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Valid Until</p>
                    <input name="validUntil" type="date" defaultValue={quotation.validUntil ? new Date(quotation.validUntil).toISOString().slice(0, 10) : ""} className="h-9 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Notes</p>
                  <textarea name="notes" defaultValue={quotation.notes ?? ""} rows={4} className="w-full resize-y rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]/50" />
                </div>
                <div className="flex items-center gap-2 border-t border-[var(--line)] px-4 py-3">
                  <SubmitButton bare className="btn-premium rounded-lg px-4 py-2 text-[0.8125rem] font-bold">Save changes</SubmitButton>
                  <Link href={`/documents/quotations/${quotation.id}`} className="btn-premium-secondary rounded-lg px-3 py-1.5 text-[0.75rem] font-medium">Cancel</Link>
                </div>
              </form>
            )}
          </div>

          <DocumentSummaryRail
            headline={{ label: "Total", value: formatMoney(total, currency), tone: "ink" }}
            rows={rows}
            client={quotation.client}
            related={related}
            activity={activity}
          />
        </div>
      </section>
    </>
  );
}
