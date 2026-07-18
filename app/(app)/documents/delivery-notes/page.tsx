import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { type DeliveryMethod } from "@prisma/client";

import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { requireModule, OrgModule } from "@/lib/module-access";
import { assertOrgCanMutate } from "@/lib/org-write";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { RowActionsMenu, MenuSection, MenuDestructiveRow, MenuActionLink, MenuActionButton } from "@/components/shared/RowActionsMenu";
import { nextDocumentNumber } from "@/lib/commercial/document-workflow";
import { matchesDocumentPeriod } from "@/lib/documents/period-filters";
import { formatEATDate, formatEATTime } from "@/lib/date-eat";
import { shareDeliveryNoteDocument } from "@/lib/notifications/share-document";
import {
  DocumentPageHeader,
  DocumentFilterBar,
  DocumentShareMenuSection,
} from "@/components/documents";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";

const DELIVERY_METHODS: DeliveryMethod[] = ["PICKUP", "DELIVERY", "COURIER"];

export default async function DeliveryNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; period?: string; method?: string; create?: string; page?: string }>;
}) {
  const { user, orgId } = await requireOrgSession();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const periodFilter = sp.period ?? "all";
  const methodFilter = sp.method ?? "all";
  const createMode = sp.create === "1";
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
      if (!invoice || invoice.paidAmount < invoice.totalAmount) return;

      const fallbackDescription = invoice.job
        ? `Repair handover for ${invoice.job.jobNumber} (${invoice.job.brand} ${invoice.job.model})`
        : invoice.subject ?? invoice.invoiceNumber;
      const items = invoice.lines.length > 0
        ? invoice.lines.map((line) => ({
            description: line.description,
            quantity: Math.max(1, Math.round(Number(line.quantity) || 1)),
          }))
        : [{ description: fallbackDescription, quantity: 1 }];

      const noteRecord = await prisma.$transaction(async (tx) => {
        const deliveryNoteNumber = await nextDocumentNumber(tx, "DN", "deliveryNote");
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

      const noteRecord = await prisma.$transaction(async (tx) => {
        const deliveryNoteNumber = await nextDocumentNumber(tx, "DN", "deliveryNote");
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
    redirect("/documents/delivery-notes");
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
      },
    });
    await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "DeliveryNote", entityId: deliveryNoteId, action: "DELIVERY_NOTE_UPDATED", summary: "Delivery note updated" });

    revalidatePath("/documents/delivery-notes");
    redirect("/documents/delivery-notes");
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
    redirect("/documents/delivery-notes");
  }

  async function shareDeliveryNoteWhatsAppAction(formData: FormData) {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) return;

    const deliveryNoteId = String(formData.get("deliveryNoteId") ?? "").trim();
    if (!deliveryNoteId) return;
    await shareDeliveryNoteDocument({ orgId, deliveryNoteId, channel: "whatsapp" });
    revalidatePath("/documents/delivery-notes");
    redirect("/documents/delivery-notes");
  }

  async function shareDeliveryNoteEmailAction(formData: FormData) {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) return;

    const deliveryNoteId = String(formData.get("deliveryNoteId") ?? "").trim();
    if (!deliveryNoteId) return;
    await shareDeliveryNoteDocument({ orgId, deliveryNoteId, channel: "email" });
    revalidatePath("/documents/delivery-notes");
    redirect("/documents/delivery-notes");
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
    sale: { id: string; saleNumber: string; invoiceNumber: string | null; client: { fullName: string; phone: string | null; email: string | null } | null } | null;
    invoice?: { id: string; invoiceNumber: string; client: { fullName: string; phone: string | null; email: string | null } | null; job: { id: string; jobNumber: string; client: { fullName: string; phone: string | null; email: string | null } } | null } | null;
  };

  let notes: DeliveryNoteRow[] = [];
  try {
    notes = await prisma.deliveryNote.findMany({
      where: { orgId },
      orderBy: { deliveredAt: "desc" },
      take: 100,
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
            client: { select: { fullName: true, phone: true, email: true } },
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            client: { select: { fullName: true, phone: true, email: true } },
            job: { select: { id: true, jobNumber: true, client: { select: { fullName: true, phone: true, email: true } } } },
          },
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("Unknown field `invoice`")) throw err;
    // Keep legacy deployments readable until their generated Prisma client includes DeliveryNote.invoice.
    notes = await prisma.deliveryNote.findMany({
      where: { orgId },
      orderBy: { deliveredAt: "desc" },
      take: 100,
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
            client: { select: { fullName: true, phone: true, email: true } },
          },
        },
      },
    });
  }

  const now = new Date();
  const monthStart = now.getMonth();
  const thisMonth = notes.filter((n) => n.deliveredAt >= new Date(now.getFullYear(), monthStart, 1)).length;
  const uniqueSources = new Set(notes.map((n) => n.invoice?.id ?? n.sale?.id).filter(Boolean)).size;

  const filteredNotes = notes.filter((n) => {
    if (q) {
      const search = q.toLowerCase();
      const label = n.deliveryNoteNumber + " " + (n.invoice?.invoiceNumber ?? "") + " " + (n.sale?.saleNumber ?? "") + " " + (n.invoice?.client?.fullName ?? n.sale?.client?.fullName ?? "");
      if (!label.toLowerCase().includes(search)) return false;
    }
    if (methodFilter !== "all" && n.deliveryMethod !== methodFilter) return false;
    if (!matchesDocumentPeriod(n.deliveredAt, periodFilter, now)) return false;
    return true;
  });
  // KPIs stay whole-dataset (computed from notes/filteredNotes); slice for display only.
  const pageView = paginationView(page, filteredNotes.length);
  const pageRows = filteredNotes.slice(pageView.skip, pageView.skip + pageView.take);
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
      select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, job: { select: { jobNumber: true, client: { select: { fullName: true } } } }, client: { select: { fullName: true } } },
    }).then((rows) => rows.filter((invoice) => invoice.paidAmount >= invoice.totalAmount)),
    prisma.sale.findMany({
      where: { orgId, status: "PAID" },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { id: true, saleNumber: true, totalAmount: true, client: { select: { fullName: true } } },
    }).catch(() => []),
  ]);
  const hasDeliverySources = invoiceOptions.length > 0 || saleOptions.length > 0;

  return (
    <section className="space-y-4">
      <DocumentPageHeader
        title="Delivery Notes"
        action={
          <Link href="/documents/delivery-notes?create=1#create-delivery-note" className="btn-premium rounded-lg px-3 py-1.5 text-[12px]">
            Create Delivery Note
          </Link>
        }
        kpis={[
          { label: "Total Notes", value: notes.length, sub: "all time" },
          { label: "This Month", value: thisMonth, sub: "delivered", accent: true },
          { label: "Unique Sources", value: uniqueSources, sub: "invoices & sales" },
          { label: "Filtered", value: filteredNotes.length, sub: "matching filters" },
        ]}
      />

      {hasDeliverySources ? (
        <details id="create-delivery-note" open={createMode} className="group rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <summary className="cursor-pointer select-none px-4 py-2.5 text-[12px] font-semibold text-[var(--ink)] group-open:border-b group-open:border-[var(--line)]">
            Create Delivery Note from paid invoice or sale
          </summary>
          <form action={createDeliveryNoteAction} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <select name="sourceKey" required className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm sm:col-span-2">
              <option value="">Select paid invoice or sale...</option>
              {invoiceOptions.length > 0 ? (
                <optgroup label="Paid invoices">
                  {invoiceOptions.map((invoice) => (
                    <option key={invoice.id} value={`invoice:${invoice.id}`}>{invoice.invoiceNumber} - {invoice.job?.jobNumber ?? invoice.client?.fullName ?? "Invoice"}</option>
                  ))}
                </optgroup>
              ) : null}
              {saleOptions.length > 0 ? (
                <optgroup label="Paid POS sales">
                  {saleOptions.map((sale) => (
                    <option key={sale.id} value={`sale:${sale.id}`}>{sale.saleNumber} - {sale.client?.fullName ?? "Walk-in"} - {formatMoney(sale.totalAmount, "UGX")}</option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            <input name="deliveredByName" required placeholder="Delivered by" className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm" />
            <input name="receivedByName" required placeholder="Received by" className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm" />
            <select name="deliveryMethod" defaultValue="" className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm">
              <option value="">No method</option>
              {DELIVERY_METHODS.map((method) => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}
            </select>
            <input name="note" placeholder="Optional note" className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm" />
            <button type="submit" className="btn-premium h-9 rounded-lg px-5 text-sm font-semibold">Create Delivery Note</button>
          </form>
        </details>
      ) : createMode ? (
        <div id="create-delivery-note" className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <p className="text-[13px] font-semibold text-[var(--ink)]">No paid invoices or sales are ready for delivery notes.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/documents/invoices?create=1#create-invoice" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:text-[var(--accent)]">Create invoice</Link>
            <Link href="/pos" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:text-[var(--accent)]">Open POS</Link>
          </div>
        </div>
      ) : null}

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
              className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
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
        dense
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
                <p className="text-xs text-[var(--ink-muted)]">{n.deliveredByName} → {n.receivedByName}</p>
                {/* Client + source visible on mobile (those columns hidden at md/lg) */}
                <p className="mt-0.5 text-[13px] font-medium text-[var(--ink)] lg:hidden">
                  {n.invoice?.job?.client.fullName ?? n.sale?.client?.fullName ?? ""}
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
            cell: (n) => n.invoice?.job?.client.fullName ?? n.sale?.client?.fullName ?? "-",
          },
          {
            key: "delivered",
            header: "Delivered",
            className: "text-[var(--ink-muted)]",
            cell: (n) => (
              <>
                {formatEATDate(n.deliveredAt)}<br /><span className="text-[12px]">{formatEATTime(n.deliveredAt)}</span>
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
                <span className="rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-0.5 text-[13px] font-semibold text-[var(--ink-muted)]">
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
                  <input name="deliveredByName" defaultValue={n.deliveredByName} placeholder="Delivered by" className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]/50" />
                  <input name="receivedByName" defaultValue={n.receivedByName} placeholder="Received by" className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]/50" />
                  <input name="receivedBySignatureText" defaultValue={n.receivedBySignatureText ?? ""} placeholder="Signature text" className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]/50" />
                  <select name="deliveryMethod" defaultValue={n.deliveryMethod ?? ""} className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]/50">
                    <option value="">No method</option>
                    {DELIVERY_METHODS.map((m) => <option key={m} value={m}>{m.replaceAll("_", " ")}</option>)}
                  </select>
                  <textarea name="note" defaultValue={n.note ?? ""} placeholder="Note" className="min-h-14 w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]/50" />
                  <MenuActionButton icon="save" tone="accent" className="bg-[var(--accent)]/8">Save Delivery Note</MenuActionButton>
                </form>
                <MenuDestructiveRow>
                  <form action={deleteDeliveryNoteAction}>
                    <input type="hidden" name="deliveryNoteId" value={n.id} />
                    <ConfirmSubmitButton message="Delete this delivery note? This cannot be undone." className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-500/10 hover:text-red-700">Delete Delivery Note</ConfirmSubmitButton>
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
  );
}
