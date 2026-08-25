import Link from "next/link";
import { redirect } from "next/navigation";
import { FormErrorBanner } from "@/components/ui/FormErrorBanner";
import { DocumentSourcePicker, type SourceGroup } from "@/components/documents/DocumentSourcePicker";
import { revalidatePath } from "next/cache";
import { type DeliveryMethod, Prisma } from "@prisma/client";

import { can } from "@/lib/permissions";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { findRecentDuplicate } from "@/lib/dedup";
import { requireOrgSession } from "@/lib/org-context";
import { requireModule, OrgModule } from "@/lib/module-access";
import { assertOrgCanMutate } from "@/lib/org-write";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { RowActionsMenu, MenuSection, MenuDestructiveRow, MenuActionLink, MenuActionButton } from "@/components/shared/RowActionsMenu";
import { DocumentPreviewButton } from "@/components/documents/DocumentPreviewButton";
import { nextDocumentNumber } from "@/lib/commercial/document-workflow";
import { dateFilterForDocumentPeriod } from "@/lib/documents/period-filters";
import { formatEATDate, formatEATTime } from "@/lib/date-eat";
import { shareDeliveryNoteDocument } from "@/lib/notifications/share-document";
import {
  DocumentPageHeader,
  DocumentFilterBar,
  DocumentShareMenuSection,
} from "@/components/documents";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { Disclosure, DisclosureButton, DisclosurePanel } from "@/components/shared/Disclosure";
import { clientDisplayName } from "@/lib/client-name";

import { flash } from "@/lib/flash";
const DELIVERY_METHODS: DeliveryMethod[] = ["PICKUP", "DELIVERY", "COURIER"];

export default async function DeliveryNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; period?: string; method?: string; page?: string; error?: string }>;
}) {
  const { user, orgId, org } = await requireOrgSession();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const periodFilter = sp.period ?? "all";
  const methodFilter = sp.method ?? "all";
  const page = parsePage(sp.page);
  if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) {
    redirect("/dashboard");
  }
  await requireModule(OrgModule.INVOICING);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  async function createDeliveryNoteAction(formData: FormData) {
    "use server";
    const { user, orgId, org, session } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS"].includes(user.role))) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const sourceKey = String(formData.get("sourceKey") ?? "").trim();
    const legacyInvoiceId = String(formData.get("invoiceId") ?? "").trim();
    const deliveredByName = String(formData.get("deliveredByName") ?? "").trim();
    const receivedByName = String(formData.get("receivedByName") ?? "").trim();
    const methodRaw = String(formData.get("deliveryMethod") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    if ((!sourceKey && !legacyInvoiceId) || !deliveredByName || !receivedByName) return;

    const [sourceType, sourceId] = sourceKey.includes(":")
      ? sourceKey.split(":", 2)
      : ["invoice", legacyInvoiceId];
    if (!sourceId || !["invoice", "sale"].includes(sourceType)) return;

    const deliveryMethod = DELIVERY_METHODS.includes(methodRaw as DeliveryMethod) ? (methodRaw as DeliveryMethod) : null;

    if (sourceType === "invoice") {
      const invoice = await prisma.invoice.findFirst({
        where: { id: sourceId, orgId, status: { not: "VOID" } },
        select: {
          id: true,
          invoiceNumber: true,
          paidAmount: true,
          totalAmount: true,
          subject: true,
          lines: { select: { description: true, quantity: true } },
          job: { select: { jobNumber: true, brand: true, model: true } },
        },
      });
      if (!invoice) return;
      if (invoice.paidAmount < invoice.totalAmount) {
        // A delivery note is only issued once the invoice is settled; saying so
        // beats the dialog closing with nothing having happened.
        redirect(`/documents/delivery-notes?error=${encodeURIComponent("That invoice is not fully paid yet, so a delivery note can't be issued for it.")}`);
      }

      const fallbackDescription = invoice.job
        ? `Repair handover for ${invoice.job.jobNumber} (${invoice.job.brand} ${invoice.job.model})`
        : invoice.subject ?? invoice.invoiceNumber;
      const items = invoice.lines.length > 0
        ? invoice.lines.map((line) => ({
            description: line.description,
            quantity: Math.max(1, Math.round(Number(line.quantity) || 1)),
          }))
        : [{ description: fallbackDescription, quantity: 1 }];

      // Double-submit guard: a delivery note for this invoice landed seconds ago.
      const dupDn = await findRecentDuplicate(prisma.deliveryNote, { orgId, invoiceId: invoice.id });
      if (dupDn) { revalidatePath("/documents/delivery-notes"); redirect("/documents/delivery-notes"); }

      const noteRecord = await prisma.$transaction(async (tx) => {
        const deliveryNoteNumber = await nextDocumentNumber(tx, "DN", "deliveryNote", orgId);
        return tx.deliveryNote.create({
          data: {
            orgId,
            invoiceId: invoice.id,
            deliveryNoteNumber,
            deliveryMethod,
            deliveredByName,
            receivedByName,
            note: note || null,
            createdById: session.user.id,
            items: { create: items },
          },
        });
      });
      await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "DeliveryNote", entityId: noteRecord.id, action: "DELIVERY_NOTE_CREATED", summary: `${noteRecord.deliveryNoteNumber} generated from ${invoice.invoiceNumber}` });
    } else {
      const sale = await prisma.sale.findFirst({
        where: { id: sourceId, orgId, status: "PAID" },
        select: {
          id: true,
          saleNumber: true,
          items: { select: { id: true, partId: true, description: true, quantity: true } },
        },
      });
      if (!sale) return;

      const items = sale.items.length > 0
        ? sale.items.map((item) => ({
            saleItemId: item.id,
            partId: item.partId,
            description: item.description,
            quantity: Math.max(1, item.quantity),
          }))
        : [{ description: `Sale handover for ${sale.saleNumber}`, quantity: 1 }];

      // Double-submit guard: a delivery note for this sale landed seconds ago.
      const dupDn = await findRecentDuplicate(prisma.deliveryNote, { orgId, saleId: sale.id });
      if (dupDn) { revalidatePath("/documents/delivery-notes"); redirect("/documents/delivery-notes"); }

      const noteRecord = await prisma.$transaction(async (tx) => {
        const deliveryNoteNumber = await nextDocumentNumber(tx, "DN", "deliveryNote", orgId);
        return tx.deliveryNote.create({
          data: {
            orgId,
            saleId: sale.id,
            deliveryNoteNumber,
            deliveryMethod,
            deliveredByName,
            receivedByName,
            note: note || null,
            createdById: session.user.id,
            items: { create: items },
          },
        });
      });
      await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "DeliveryNote", entityId: noteRecord.id, action: "DELIVERY_NOTE_CREATED", summary: `${noteRecord.deliveryNoteNumber} generated from ${sale.saleNumber}` });
    }

    revalidatePath("/documents/delivery-notes");
    revalidatePath("/documents/invoices");
    redirect(flash("/documents/delivery-notes", "Delivery note created"));
  }

  async function updateDeliveryNoteAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS"].includes(user.role))) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const deliveryNoteId = String(formData.get("deliveryNoteId") ?? "").trim();
    const deliveredByName = String(formData.get("deliveredByName") ?? "").trim();
    const receivedByName = String(formData.get("receivedByName") ?? "").trim();
    const receivedBySignatureText = String(formData.get("receivedBySignatureText") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    const methodRaw = String(formData.get("deliveryMethod") ?? "").trim();
    const deliveredAtRaw = String(formData.get("deliveredAt") ?? "").trim();
    if (!deliveryNoteId || !deliveredByName || !receivedByName) return;

    const deliveryMethod = DELIVERY_METHODS.includes(methodRaw as DeliveryMethod) ? (methodRaw as DeliveryMethod) : null;
    await prisma.deliveryNote.updateMany({
      where: { id: deliveryNoteId, orgId },
      data: {
        deliveredByName,
        receivedByName,
        receivedBySignatureText: receivedBySignatureText || null,
        deliveryMethod,
        note: note || null,
        ...(deliveredAtRaw ? { deliveredAt: new Date(deliveredAtRaw) } : {}),
      },
    });
    await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "DeliveryNote", entityId: deliveryNoteId, action: "DELIVERY_NOTE_UPDATED", summary: "Delivery note updated" });

    revalidatePath("/documents/delivery-notes");
    redirect(flash("/documents/delivery-notes", "Delivery note updated"));
  }

  async function deleteDeliveryNoteAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!("ADMIN" === user.role || can.approveInvoices(user))) return;
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const deliveryNoteId = String(formData.get("deliveryNoteId") ?? "").trim();
    if (!deliveryNoteId) return;

    await prisma.deliveryNote.deleteMany({ where: { id: deliveryNoteId, orgId } });
    await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "DeliveryNote", entityId: deliveryNoteId, action: "DELIVERY_NOTE_DELETED", summary: "Delivery note deleted" });
    revalidatePath("/documents/delivery-notes");
    redirect(flash("/documents/delivery-notes", "Delivery note deleted"));
  }

  async function shareDeliveryNoteWhatsAppAction(formData: FormData) {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) return;

    const deliveryNoteId = String(formData.get("deliveryNoteId") ?? "").trim();
    if (!deliveryNoteId) return;
    await shareDeliveryNoteDocument({ orgId, deliveryNoteId, channel: "whatsapp" });
    revalidatePath("/documents/delivery-notes");
    redirect(flash("/documents/delivery-notes", "Saved"));
  }

  async function shareDeliveryNoteEmailAction(formData: FormData) {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) return;

    const deliveryNoteId = String(formData.get("deliveryNoteId") ?? "").trim();
    if (!deliveryNoteId) return;
    await shareDeliveryNoteDocument({ orgId, deliveryNoteId, channel: "email" });
    revalidatePath("/documents/delivery-notes");
    redirect(flash("/documents/delivery-notes", "Saved"));
  }

  type DeliveryNoteRow = {
    id: string;
    deliveryNoteNumber: string;
    deliveredAt: Date;
    deliveryMethod: DeliveryMethod | null;
    deliveredByName: string;
    receivedByName: string;
    receivedBySignatureText: string | null;
    note: string | null;
    sale: { id: string; saleNumber: string; invoiceNumber: string | null; client: { fullName: string; phone: string | null; email: string | null; organization: string | null } | null } | null;
    invoice?: { id: string; invoiceNumber: string; client: { fullName: string; phone: string | null; email: string | null; organization: string | null } | null; job: { id: string; jobNumber: string; client: { fullName: string; phone: string | null; email: string | null; organization: string | null } } | null } | null;
  };

  const now = new Date();
  const monthStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodRange = dateFilterForDocumentPeriod(periodFilter, now);

  // Method + period + search run in SQL so the list isn't capped at the first 100
  // rows (which silently hid older notes and made pagination lie past 100).
  const commonWhere: Prisma.DeliveryNoteWhereInput = { orgId };
  if (methodFilter !== "all") commonWhere.deliveryMethod = methodFilter as DeliveryMethod;
  if (periodRange) commonWhere.deliveredAt = periodRange;

  const searchOrPrimary: Prisma.DeliveryNoteWhereInput[] | undefined = q
    ? [
        { deliveryNoteNumber: { contains: q } },
        { invoice: { is: { invoiceNumber: { contains: q } } } },
        { invoice: { is: { client: { is: { OR: [{ fullName: { contains: q } }, { organization: { contains: q } }] } } } } },
        { sale: { is: { saleNumber: { contains: q } } } },
        { sale: { is: { client: { is: { OR: [{ fullName: { contains: q } }, { organization: { contains: q } }] } } } } },
      ]
    : undefined;
  // Legacy deployments whose Prisma client predates DeliveryNote.invoice can't
  // filter on that relation — drop the invoice clauses for the fallback path.
  const searchOrFallback: Prisma.DeliveryNoteWhereInput[] | undefined = q
    ? [
        { deliveryNoteNumber: { contains: q } },
        { sale: { is: { saleNumber: { contains: q } } } },
        { sale: { is: { client: { is: { OR: [{ fullName: { contains: q } }, { organization: { contains: q } }] } } } } },
      ]
    : undefined;

  const wherePrimary: Prisma.DeliveryNoteWhereInput = searchOrPrimary ? { ...commonWhere, OR: searchOrPrimary } : commonWhere;
  const whereFallback: Prisma.DeliveryNoteWhereInput = searchOrFallback ? { ...commonWhere, OR: searchOrFallback } : commonWhere;

  let notes: DeliveryNoteRow[] = [];
  let filteredCount = 0;
  let pageView = paginationView(page, 0);
  try {
    filteredCount = await prisma.deliveryNote.count({ where: wherePrimary });
    pageView = paginationView(page, filteredCount);
    notes = await prisma.deliveryNote.findMany({
      where: wherePrimary,
      orderBy: { deliveredAt: "desc" },
      skip: pageView.skip,
      take: pageView.take,
      select: {
        id: true,
        deliveryNoteNumber: true,
        deliveredAt: true,
        deliveryMethod: true,
        deliveredByName: true,
        receivedByName: true,
        receivedBySignatureText: true,
        note: true,
        sale: {
          select: {
            id: true,
            saleNumber: true,
            invoiceNumber: true,
            client: { select: { fullName: true, phone: true, email: true, organization: true } },
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            client: { select: { fullName: true, phone: true, email: true, organization: true } },
            job: { select: { id: true, jobNumber: true, client: { select: { fullName: true, phone: true, email: true, organization: true } } } },
          },
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("Unknown field `invoice`")) throw err;
    // Keep legacy deployments readable until their generated Prisma client includes DeliveryNote.invoice.
    filteredCount = await prisma.deliveryNote.count({ where: whereFallback });
    pageView = paginationView(page, filteredCount);
    notes = await prisma.deliveryNote.findMany({
      where: whereFallback,
      orderBy: { deliveredAt: "desc" },
      skip: pageView.skip,
      take: pageView.take,
      select: {
        id: true,
        deliveryNoteNumber: true,
        deliveredAt: true,
        deliveryMethod: true,
        deliveredByName: true,
        receivedByName: true,
        receivedBySignatureText: true,
        note: true,
        sale: {
          select: {
            id: true,
            saleNumber: true,
            invoiceNumber: true,
            client: { select: { fullName: true, phone: true, email: true, organization: true } },
          },
        },
      },
    });
  }

  // KPIs are whole-dataset aggregates, independent of the current page/filters.
  const [totalNotes, thisMonth, distinctInvoiceSources, distinctSaleSources] = await Promise.all([
    prisma.deliveryNote.count({ where: { orgId } }).catch(() => 0),
    prisma.deliveryNote.count({ where: { orgId, deliveredAt: { gte: monthStartDate } } }).catch(() => 0),
    prisma.deliveryNote.findMany({ where: { orgId, invoiceId: { not: null } }, distinct: ["invoiceId"], select: { invoiceId: true } }).catch(() => [] as { invoiceId: string | null }[]),
    prisma.deliveryNote.findMany({ where: { orgId, saleId: { not: null } }, distinct: ["saleId"], select: { saleId: true } }).catch(() => [] as { saleId: string | null }[]),
  ]);
  const uniqueSources = distinctInvoiceSources.length + distinctSaleSources.length;
  const pageRows = notes;
  const deliveryNotesHref = pageHrefBuilder("/documents/delivery-notes", {
    q,
    period: periodFilter !== "all" ? periodFilter : "",
    method: methodFilter !== "all" ? methodFilter : "",
  });
  const [invoiceOptions, saleOptions] = await Promise.all([
    prisma.invoice.findMany({
      where: { orgId, status: { not: "VOID" } },
      orderBy: { issuedAt: "desc" },
      take: 80,
      select: { id: true, invoiceNumber: true, totalAmount: true, currency: true, paidAmount: true, job: { select: { jobNumber: true, client: { select: { fullName: true, phone: true, organization: true } } } }, client: { select: { fullName: true, phone: true, organization: true } } },
    }).then((rows) => rows.filter((invoice) => invoice.paidAmount >= invoice.totalAmount)),
    prisma.sale.findMany({
      where: { orgId, status: "PAID" },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { id: true, saleNumber: true, totalAmount: true, currency: true, client: { select: { fullName: true, phone: true, organization: true } } },
    }).catch(() => []),
  ]);
  const hasDeliverySources = invoiceOptions.length > 0 || saleOptions.length > 0;

  // Lead with the customer. A job-linked invoice used to be labelled with its
  // JOB number and nothing else, so the name being searched for was not even on
  // screen. `search` carries the phone and job number too, so any of them find
  // the row.
  const deliverySourceGroups: SourceGroup[] = [
    {
      label: "Paid invoices",
      options: invoiceOptions.map((invoice) => {
        const who = clientDisplayName(invoice.client ?? invoice.job?.client, "No customer");
        const phone = invoice.client?.phone ?? invoice.job?.client?.phone ?? "";
        return {
          value: `invoice:${invoice.id}`,
          label: `${who} — ${invoice.invoiceNumber}`,
          hint: [invoice.job?.jobNumber, formatMoney(invoice.totalAmount, normalizeCurrency(invoice.currency, org.baseCurrency))]
            .filter(Boolean)
            .join(" · "),
          search: [who, phone, invoice.invoiceNumber, invoice.job?.jobNumber].filter(Boolean).join(" "),
        };
      }),
    },
    {
      label: "Paid sales",
      options: saleOptions.map((sale) => {
        const who = clientDisplayName(sale.client, "Walk-in");
        return {
          value: `sale:${sale.id}`,
          label: `${who} — ${sale.saleNumber}`,
          hint: formatMoney(sale.totalAmount, normalizeCurrency(sale.currency, org.baseCurrency)),
          search: [who, sale.client?.phone, sale.saleNumber].filter(Boolean).join(" "),
        };
      }),
    },
  ].filter((g) => g.options.length > 0);

  return (
    <Disclosure>
    <section className="space-y-4">
      <FormErrorBanner message={sp.error} />
      <DocumentPageHeader
        title="Delivery Notes"
        action={
          <DisclosureButton
            label="Create Delivery Note"
            openLabel="Cancel"
            className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem]"
          />
        }
        kpis={[
          { label: "Total Notes", value: totalNotes, sub: "all time" },
          { label: "This Month", value: thisMonth, sub: "delivered", accent: true },
          { label: "Unique Sources", value: uniqueSources, sub: "invoices & sales" },
          { label: "Filtered", value: filteredCount, sub: "matching filters" },
        ]}
      />

      <DisclosurePanel>
      {hasDeliverySources ? (
        <div id="create-delivery-note" className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] px-4 py-2.5 text-[0.75rem] font-semibold text-[var(--ink)]">
            Create Delivery Note from paid invoice or sale
          </div>
          <form action={createDeliveryNoteAction} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2">
              <DocumentSourcePicker
                name="sourceKey"
                required
                groups={deliverySourceGroups}
                placeholder="Search paid invoices and sales by customer, number or job…"
                emptyLabel="No paid invoice or sale matches that"
              />
            </div>
            <input name="deliveredByName" required placeholder="Delivered by" className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm" />
            <input name="receivedByName" required placeholder="Received by" className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm" />
            <select name="deliveryMethod" defaultValue="" className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm">
              <option value="">No method</option>
              {DELIVERY_METHODS.map((method) => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}
            </select>
            <input name="note" placeholder="Optional note" className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm" />
            <SubmitButton bare pendingLabel="Creating…" className="btn-premium h-9 rounded-lg px-5 text-sm font-semibold disabled:opacity-60">Create Delivery Note</SubmitButton>
          </form>
        </div>
      ) : (
        <div id="create-delivery-note" className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-[0.8125rem] font-semibold text-[var(--ink)]">No paid invoices or sales are ready for delivery notes.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/documents/invoices?create=1#create-invoice" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:text-[var(--accent)]">Create invoice</Link>
            <Link href="/pos" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:text-[var(--accent)]">Open POS</Link>
          </div>
        </div>
      )}
      </DisclosurePanel>

      <DocumentFilterBar
        basePath="/documents/delivery-notes"
        q={q}
        period={periodFilter}
        extraQuery={{ method: methodFilter }}
        searchPlaceholder="Search note #, client…"
      >
        <div className="flex gap-1">
          {(["all", "PICKUP", "DELIVERY", "COURIER"] as const).map((m) => (
            <Link
              key={m}
              href={`/documents/delivery-notes?period=${periodFilter}&method=${m}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-full border px-3 py-1.5 text-[0.75rem] font-semibold transition ${
                methodFilter === m
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
              }`}
            >
              {m === "all" ? "All methods" : m.charAt(0) + m.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>
      </DocumentFilterBar>

      <DataTable
        className="doc-list"
        rows={pageRows}
        getRowKey={(n) => n.id}
        empty="No delivery notes yet. Generate one from a paid invoice where delivery or handover proof is needed."
        columns={[
          {
            key: "note",
            header: "Delivery Note",
            cell: (n) => (
              <>
                <p className="mono font-bold text-[var(--ink)]">{n.deliveryNoteNumber}</p>
                <p className="text-[0.75rem] text-[var(--ink-muted)]">{n.deliveredByName} → {n.receivedByName}</p>
                {/* Client + source visible on mobile (those columns hidden at md/lg) */}
                <p className="mt-0.5 font-medium text-[var(--ink)] lg:hidden">
                  {n.invoice?.job?.client ? clientDisplayName(n.invoice.job.client) : n.sale?.client ? clientDisplayName(n.sale.client) : ""}
                </p>
              </>
            ),
          },
          {
            key: "source",
            header: "Source",
            headerClassName: "hidden md:table-cell",
            className: "hidden md:table-cell",
            cell: (n) =>
              n.invoice ? (
                <Link className="mono font-semibold text-[var(--ink)] transition hover:text-[var(--accent)]" href={n.invoice.job ? `/jobs/${n.invoice.job.id}` : "/documents/invoices"}>
                  {n.invoice.invoiceNumber}{n.invoice.job ? ` / ${n.invoice.job.jobNumber}` : ""}
                </Link>
              ) : n.sale ? (
                <Link className="mono font-semibold text-[var(--ink)] transition hover:text-[var(--accent)]" href={`/pos/${n.sale.id}`}>
                  {n.sale.invoiceNumber ?? n.sale.saleNumber}
                </Link>
              ) : "-",
          },
          {
            key: "client",
            header: "Client",
            headerClassName: "hidden lg:table-cell",
            className: "hidden text-[var(--ink-muted)] lg:table-cell",
            cell: (n) => clientDisplayName(n.invoice?.job?.client ?? n.sale?.client, "-"),
          },
          {
            key: "delivered",
            header: "Delivered",
            className: "text-[var(--ink-muted)]",
            cell: (n) => (
              <>
                {formatEATDate(n.deliveredAt)}<br /><span className="text-[0.75rem]">{formatEATTime(n.deliveredAt)}</span>
              </>
            ),
          },
          {
            key: "method",
            header: "Method",
            headerClassName: "hidden lg:table-cell",
            className: "hidden lg:table-cell",
            cell: (n) =>
              n.deliveryMethod ? (
                <span className="rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-0.5 font-semibold text-[var(--ink-muted)]">
                  {n.deliveryMethod.replaceAll("_", " ")}
                </span>
              ) : "-",
          },
        ]}
        actions={(n) => {
          const recipientPhone = n.invoice?.job?.client.phone ?? n.invoice?.client?.phone ?? n.sale?.client?.phone ?? null;
          const recipientEmail = n.invoice?.job?.client.email ?? n.invoice?.client?.email ?? n.sale?.client?.email ?? null;
          const deliveryUrl = `${appUrl}/api/delivery-notes/${n.id}`;
          const sourceLabel = n.invoice?.invoiceNumber ?? n.sale?.invoiceNumber ?? n.sale?.saleNumber ?? n.deliveryNoteNumber;
          const deliveryShareText = encodeURIComponent(`Your delivery note is ready.\n\n${n.deliveryNoteNumber} for ${sourceLabel}\nPDF: ${deliveryUrl}`);
          const deliveryWaPhone = recipientPhone?.replace(/\D/g, "").replace(/^0/, "256");
          return (
            <>
              <Link href={n.invoice?.job ? `/jobs/${n.invoice.job.id}` : n.sale ? `/pos/${n.sale.id}` : "/documents/delivery-notes"} title="View source" className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </Link>
              <a href={`/api/delivery-notes/${n.id}`} target="_blank" rel="noreferrer" title="Download PDF" className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] transition hover:bg-[var(--accent)]/20">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              </a>
              <RowActionsMenu label="Delivery note actions">
                <div className="py-1 text-left">
                  <MenuActionLink href={`/documents/delivery-notes/${n.id}`} icon="open">View delivery note</MenuActionLink>
                  <DocumentPreviewButton pdfUrl={`/api/delivery-notes/${n.id}`} title={`Delivery note ${n.deliveryNoteNumber}`} />
                  <MenuActionLink href={`/api/delivery-notes/${n.id}`} external icon="delivery" tone="accent">
                    Download Delivery Note
                  </MenuActionLink>
                </div>
                <DocumentShareMenuSection
                  hiddenFieldName="deliveryNoteId"
                  hiddenFieldValue={n.id}
                  recipientPhone={recipientPhone}
                  recipientEmail={recipientEmail}
                  whatsAppAction={shareDeliveryNoteWhatsAppAction}
                  emailAction={shareDeliveryNoteEmailAction}
                  emailLabel="Email delivery note"
                  waLinkHref={deliveryWaPhone ? `https://wa.me/${deliveryWaPhone}?text=${deliveryShareText}` : null}
                />
                <MenuSection label="Edit Delivery Note" />
                <form action={updateDeliveryNoteAction} className="space-y-2 p-3">
                  <input type="hidden" name="deliveryNoteId" value={n.id} />
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Delivery date
                    <input name="deliveredAt" type="date" defaultValue={new Date(n.deliveredAt).toISOString().slice(0, 10)} className="mt-0.5 w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 outline-none focus:border-[var(--accent)]/50" />
                  </label>
                  <input name="deliveredByName" defaultValue={n.deliveredByName} placeholder="Delivered by" className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 outline-none focus:border-[var(--accent)]/50" />
                  <input name="receivedByName" defaultValue={n.receivedByName} placeholder="Received by" className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 outline-none focus:border-[var(--accent)]/50" />
                  <input name="receivedBySignatureText" defaultValue={n.receivedBySignatureText ?? ""} placeholder="Signature text" className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 outline-none focus:border-[var(--accent)]/50" />
                  <select name="deliveryMethod" defaultValue={n.deliveryMethod ?? ""} className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 outline-none focus:border-[var(--accent)]/50">
                    <option value="">No method</option>
                    {DELIVERY_METHODS.map((m) => <option key={m} value={m}>{m.replaceAll("_", " ")}</option>)}
                  </select>
                  <textarea name="note" defaultValue={n.note ?? ""} placeholder="Note" className="min-h-14 w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 outline-none focus:border-[var(--accent)]/50" />
                  <MenuActionButton icon="save" tone="accent" className="bg-[var(--accent)]/8">Save Delivery Note</MenuActionButton>
                </form>
                <MenuDestructiveRow>
                  <form action={deleteDeliveryNoteAction}>
                    <input type="hidden" name="deliveryNoteId" value={n.id} />
                    <ConfirmSubmitButton message="Delete this delivery note? This cannot be undone." className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-semibold text-red-600 transition hover:bg-red-500/10 hover:text-red-700">Delete Delivery Note</ConfirmSubmitButton>
                  </form>
                </MenuDestructiveRow>
              </RowActionsMenu>
            </>
          );
        }}
      />

      <TablePagination
        page={pageView.page}
        totalPages={pageView.totalPages}
        rangeStart={pageView.rangeStart}
        rangeEnd={pageView.rangeEnd}
        total={pageView.total}
        unit="delivery notes"
        hrefForPage={deliveryNotesHref}
      />
    </section>
    </Disclosure>
  );
}
