import Link from "next/link";
import { getCurrentUserRole } from "@/lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { QuotationStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { can } from "@/lib/permissions";
import { orgDb } from "@/lib/db";
import { sanitizeText } from "@/lib/sanitize";
import { RowActionsMenu, MenuActionLink, MenuActionButton, MenuDestructiveRow, MenuSection } from "@/components/shared/RowActionsMenu";
import { ensureInvoiceFromQuotation } from "@/lib/commercial/document-workflow";
import { prisma } from "@/lib/prisma";
import { shareQuotationDocument } from "@/lib/notifications/share-document";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { QuotationPreviewProvider } from "./QuotationPreviewProvider";
import { PreviewButton } from "./PreviewButton";

import { BulkSelectionProvider } from "./BulkSelectionProvider";
import { BulkActionBar } from "./BulkActionBar";
import { RowCheckbox } from "./RowCheckbox";
import { QuotationCreateDialog, QuotationCreateProvider, QuotationNewButton } from "./QuotationCreateDialog";
import { DataTable, TablePagination, type DataTableColumn } from "@/components/ui/DataTable";
import { parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { formatEATDate } from "@/lib/date-eat";
import { getDocumentBrandingSettings } from "@/lib/document-branding";
import { assertOrgCanMutate } from "@/lib/org-write";
import { requireOrgSession } from "@/lib/org-context";
import { clientDisplayName } from "@/lib/client-name";

import { SubmitButton } from "@/components/ui/SubmitButton";
import { flash } from "@/lib/flash";
const QUOTATION_STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  SENT: "sky",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "slate",
};

export const dynamic = "force-dynamic";

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { user } = await getCurrentUserRole();
  if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) redirect("/dashboard");
  if (!user.orgId) redirect("/dashboard");

  const sp = await searchParams;
  const statusFilter = typeof sp.status === "string" ? sp.status.toUpperCase() : "ALL";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = parsePage(sp.page);
  const pageSize = 20;

  const db = orgDb(user.orgId);
  const org = await db.organization.findFirst({ where: { id: user.orgId }, select: { baseCurrency: true } });
  const orgCurrency = org?.baseCurrency ?? "UGX";

  const where: Prisma.QuotationWhereInput = { orgId: user.orgId };
  if (statusFilter !== "ALL") where.status = statusFilter as QuotationStatus;
  if (q) {
    where.OR = [
      { quoteNumber: { contains: q } },
      { client: { OR: [{ fullName: { contains: q } }, { organization: { contains: q } }] } },
    ];
  }

  // KPI band reflects the whole org (all statuses), respecting only the search —
  // so the summary numbers stay stable as you flip the status filter.
  const kpiWhere: Prisma.QuotationWhereInput = { orgId: user.orgId };
  if (q) kpiWhere.OR = [{ quoteNumber: { contains: q } }, { client: { OR: [{ fullName: { contains: q } }, { organization: { contains: q } }] } }];

  const [quotations, totalItems, statusGroups] = await Promise.all([
    db.quotation.findMany({
      where,
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        currency: true,
        totalAmount: true,
        validUntil: true,
        createdAt: true,
        client: { select: { id: true, fullName: true, organization: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.quotation.count({ where }),
    db.quotation.groupBy({ by: ["status"], where: kpiWhere, _count: { _all: true }, _sum: { totalAmount: true } }),
  ]);

  const byStatus = Object.fromEntries(statusGroups.map((g) => [g.status, g]));
  const statusCount = (s: string) => byStatus[s]?._count?._all ?? 0;
  const statusValue = (s: string) => byStatus[s]?._sum?.totalAmount ?? 0;
  const openQuoteValue = statusValue("DRAFT") + statusValue("SENT");

  const rows = quotations.map((q) => {
    const currency = normalizeCurrency(orgCurrency, normalizeCurrency(q.currency, "UGX"));
    const clientName = clientDisplayName(q.client, "—");
    return {
      id: q.id,
      quoteNumber: q.quoteNumber,
      client: clientName,
      status: q.status,
      statusBadge: <StatusBadge tone={toneFor(QUOTATION_STATUS_TONES, q.status)}>{q.status === "DRAFT" ? "Draft" : q.status === "SENT" ? "Pending" : q.status === "ACCEPTED" ? "Accepted" : q.status === "REJECTED" ? "Rejected" : q.status}</StatusBadge>,
      amount: formatMoney(q.totalAmount, currency),
      validUntil: q.validUntil ? formatEATDate(q.validUntil) : "—",
      created: q.createdAt ? formatEATDate(q.createdAt) : "—",
    };
  });

  const canCreate = can.createInvoices(user);
  const canDelete = ["ADMIN", "OPS"].includes(user.role);

  async function deleteQuotationAction(formData: FormData) {
    "use server";
    const { user, org } = await requireOrgSession();
    if (!canDelete) redirect("/dashboard");
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
    const db = orgDb(user.orgId);
    const id = String(formData.get("id") ?? "").trim();
    await db.quotation.delete({ where: { id } });
    revalidatePath("/documents/quotations");
    redirect(flash("/documents/quotations", "Quotation deleted"));
  }

  async function convertToInvoiceAction(formData: FormData) {
    "use server";
    const { user } = await getCurrentUserRole();
    if (!can.createInvoices(user)) redirect("/dashboard");
    const orgId = user.orgId;
    if (!orgId) redirect("/dashboard");
    const id = String(formData.get("id") ?? "").trim();
    if (!id) redirect("/documents/quotations");
    // Use the canonical converter: correct tax proportioning, one-invoice-per-job
    // dedup, and it links convertedToInvoiceId to the invoice ID (the old inline
    // version referenced an undefined `orgId` and stored the invoice number).
    const orgRec = await prisma.organization.findUnique({ where: { id: orgId }, select: { baseCurrency: true } });
    const currency = normalizeCurrency(orgRec?.baseCurrency, "UGX");
    const invoice = await prisma.$transaction((tx) => ensureInvoiceFromQuotation(tx, { orgId, quotationId: id, currency }));
    revalidatePath("/documents/quotations");
    if (invoice) {
      revalidatePath("/documents/invoices");
      redirect(flash(`/documents/invoices/${invoice.id}`, "Quotation converted to invoice"));
    }
    redirect("/documents/quotations");
  }

  // Row-menu Send — outbox-logged WhatsApp/email. Replaces the old form POSTs to
  // /api/quotations/[id]/send /whatsapp, which were never real routes (404).
  async function sendQuotationRowShareAction(formData: FormData) {
    "use server";
    const { user } = await getCurrentUserRole();
    const orgId = user.orgId;
    if (!orgId) return;
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) return;
    const quotationId = String(formData.get("quotationId") ?? "").trim();
    const channel = String(formData.get("channel") ?? "") === "email" ? "email" : "whatsapp";
    if (!quotationId) return;
    await shareQuotationDocument({ orgId, quotationId, channel });
    revalidatePath("/documents/quotations");
  }

  const pageView = paginationView(page, totalItems, pageSize);
  const hrefForPage = pageHrefBuilder(`/documents/quotations`, { status: statusFilter, q });

  const [clients, parts, taxRates, leads, jobs, branding] = await Promise.all([
    db.client.findMany({ where: { orgId: user.orgId }, orderBy: { fullName: "asc" }, take: 300, select: { id: true, fullName: true, phone: true, email: true, organization: true, address: true } }),
    db.part.findMany({ where: { orgId: user.orgId, isActive: true }, orderBy: { name: "asc" }, take: 500, select: { id: true, sku: true, name: true, unitCost: true, sellingPrice: true, taxable: true, taxRate: true, qtyOnHand: true } }),
    db.taxRate.findMany({ where: { orgId: user.orgId, isActive: true, appliesToSales: true }, orderBy: [{ isDefault: "desc" }, { code: "asc" }], select: { id: true, name: true, code: true, rate: true, isDefault: true } }),
    db.lead.findMany({ where: { orgId: user.orgId, status: { notIn: ["LOST", "STALE"] } }, orderBy: { updatedAt: "desc" }, take: 150, select: { id: true, fullName: true, phone: true, organization: true, interest: true } }),
    db.job.findMany({ where: { orgId: user.orgId, status: { notIn: ["CLOSED"] } }, orderBy: { updatedAt: "desc" }, take: 150, select: { id: true, jobNumber: true, brand: true, model: true, client: { select: { fullName: true, phone: true, address: true, organization: true } } } }),
    getDocumentBrandingSettings(user.orgId),
  ]);

  const defaultTaxRateObj = taxRates.find((rate) => rate.isDefault) ?? null;

  return (
    <QuotationPreviewProvider>
      <QuotationCreateProvider>
      <section className="space-y-4">
        <PageHeader
          title="Quotations"
          eyebrow="Documents"
          actions={
canCreate && <QuotationNewButton className="btn-premium rounded-lg px-4 py-2 text-[0.8125rem] font-bold" />
          }
          kpis={[
            { label: "Quotations", value: totalItems, sub: "all statuses" },
            { label: "Open Value", value: formatMoney(openQuoteValue, orgCurrency), sub: "draft + pending", tone: "accent" },
            { label: "Pending", value: statusCount("SENT"), sub: "awaiting reply", tone: statusCount("SENT") > 0 ? "warn" : "neutral" },
            { label: "Accepted", value: statusCount("ACCEPTED"), sub: "won", tone: "good" },
          ]}
        />

        {/* Search + Status toolbar — mirrors invoice */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
          <form method="GET" action="/documents/quotations" className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "all", label: "All" },
                { key: "DRAFT", label: "Draft" },
                { key: "SENT", label: "Pending" },
                { key: "ACCEPTED", label: "Accepted" },
                { key: "REJECTED", label: "Rejected" },
              ].map((s) => (
                <SubmitButton bare key={s.key}

 name="status"
 value={s.key}
 className={`rounded-full px-3 py-1 text-[0.8125rem] font-semibold transition ${
 statusFilter === s.key
 ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/40"
 : "border border-transparent text-[var(--ink-muted)] hover:border-[var(--line)] hover:text-[var(--ink)]"
 }`}>
                  {s.label}
                </SubmitButton>
              ))}
            </div>
            <label className="sr-only" htmlFor="qt-search">Search quotations</label>
            <input
              id="qt-search"
              name="q"
              defaultValue={q}
              placeholder="#, customer, amount…"
              className="ml-auto h-8 w-56 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50"
            />
</form>
          </div>

      <div>
  <BulkSelectionProvider pageIds={rows.map((r) => r.id)}>
    <BulkActionBar />
    {(() => {
      const columns: DataTableColumn<any>[] = [
        { key: "select", header: "", className: "w-8", cell: (row: any) => <RowCheckbox quotationId={row.id} /> },
        { key: "quoteNumber", header: "Quote #", className: "w-[150px]", cell: (row: any) => (
          <Link href={`/documents/quotations/${row.id}`} className="mono font-semibold text-[var(--accent)] hover:underline truncate whitespace-nowrap">{row.quoteNumber}</Link>
        )},
        { key: "client", header: "Client", className: "min-w-[200px]", cell: (row: any) => <span className="font-medium text-[var(--ink)] truncate">{row.client}</span> },
        { key: "status", header: "Status", className: "w-[100px]", cell: (row: any) => row.statusBadge },
        { key: "amount", header: "Amount", align: "right", className: "w-[100px]", cell: (row: any) => <span className="tabular-nums whitespace-nowrap">{row.amount}</span> },
        { key: "validUntil", header: "Valid Until", className: "w-[130px]", cell: (row: any) => <span className="whitespace-nowrap">{row.validUntil}</span> },
        { key: "created", header: "Created", className: "w-[130px]", cell: (row: any) => <span className="whitespace-nowrap">{row.created}</span> },
      ];
      const actions = (row: any) => (
        <RowActionsMenu label={`Quotation ${row.quoteNumber}`}>
          <MenuActionLink href={`/documents/quotations/${row.id}`} icon="open">View</MenuActionLink>
          <PreviewButton quotationId={row.id} />
          <MenuActionLink href={`/documents/quotations/${row.id}?edit=1`} icon="save">Edit</MenuActionLink>
          {/* Quotation PDF is served by the [id] route's GET — there is no /pdf subroute. */}
          <MenuActionLink href={`/api/quotations/${row.id}`} external icon="download">Print / PDF</MenuActionLink>
          {["ACCEPTED", "SENT"].includes(row.status) && (
            <form action={convertToInvoiceAction}>
              <input type="hidden" name="id" value={row.id} />
              <MenuActionButton icon="save" tone="success">Convert to Invoice</MenuActionButton>
            </form>
          )}
          <MenuSection label="Send" />
          <form action={sendQuotationRowShareAction}>
            <input type="hidden" name="quotationId" value={row.id} />
            <input type="hidden" name="channel" value="email" />
            <MenuActionButton icon="receipt">Send by Email</MenuActionButton>
          </form>
          <form action={sendQuotationRowShareAction}>
            <input type="hidden" name="quotationId" value={row.id} />
            <input type="hidden" name="channel" value="whatsapp" />
            <MenuActionButton icon="whatsapp" tone="success">Send by WhatsApp</MenuActionButton>
          </form>
          <MenuSection label="Danger zone" />
          {canDelete && (
            <form action={deleteQuotationAction}>
              <input type="hidden" name="id" value={row.id} />
              <MenuDestructiveRow>Delete</MenuDestructiveRow>
            </form>
          )}
        </RowActionsMenu>
      );
      return (
        <DataTable
          rows={rows}
          getRowKey={(r) => r.id}
          empty="No quotations found."
          columns={columns}
          actions={actions}
          renderMobileCard={(row: any) => (
            <div className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <RowCheckbox quotationId={row.id} />
                  <Link href={`/documents/quotations/${row.id}`} className="mono truncate text-xs font-semibold text-[var(--accent)] hover:underline">{row.quoteNumber}</Link>
                  {row.statusBadge}
                </div>
                {actions(row)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.8125rem]">
                <span className="font-medium text-[var(--ink)]">{row.client}</span>
                <span className="font-bold tabular-nums text-[var(--ink)]">{row.amount}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-[0.75rem] text-[var(--ink-muted)]">
                <span>Created {row.created}</span>
                {row.validUntil !== "—" ? <span>Valid until {row.validUntil}</span> : null}
              </div>
            </div>
          )}
        />
      );
    })()}
  </BulkSelectionProvider>
  <TablePagination
    page={pageView.page}
    totalPages={pageView.totalPages}
    rangeStart={pageView.rangeStart}
    rangeEnd={pageView.rangeEnd}
    total={pageView.total}
    unit="quotations"
    hrefForPage={hrefForPage}
  />
  </div>

      <QuotationCreateDialog
        currency={orgCurrency}
        canOverrideDiscount={can.overrideDiscount(user)}
        clients={clients as any[]}
        leads={leads as any}
        jobs={jobs as any}
        parts={parts as any[]}
        taxRates={taxRates as any[]}
        defaultTaxApplicable={branding.vatDefaultApplicable ?? false}
        defaultTaxRate={defaultTaxRateObj?.rate ?? branding.vatRatePercent ?? 0}
        defaultTaxLabel={defaultTaxRateObj?.code ?? branding.vatLabel ?? "Tax"}
      />

    </section>
      </QuotationCreateProvider>
    </QuotationPreviewProvider>
  );
}
