// @ts-nocheck
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
import { nextDocumentNumber } from "@/lib/commercial/document-workflow";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { QuotationPreviewProvider } from "./QuotationPreviewProvider";
import { PreviewButton } from "./PreviewButton";

import { BulkSelectionProvider } from "./BulkSelectionProvider";
import { BulkActionBar } from "./BulkActionBar";
import { RowCheckbox } from "./RowCheckbox";
import { QuotationCreateDialog, QuotationNewButton } from "./QuotationCreateDialog";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { formatEATDate } from "@/lib/date-eat";
import { getDocumentBrandingSettings } from "@/lib/document-branding";

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
      { client: { fullName: { contains: q } } },
    ];
  }

  const [quotations, totalItems] = await Promise.all([
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
        client: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.quotation.count({ where }),
  ]);

  const rows = quotations.map((q) => {
    const currency = normalizeCurrency(orgCurrency, normalizeCurrency(q.currency, "UGX"));
    const clientName = q.client?.fullName ?? "—";
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
    const { user } = await getCurrentUserRole();
    if (!canDelete) redirect("/dashboard");
    const db = orgDb(user.orgId);
    const id = String(formData.get("id") ?? "").trim();
    await db.quotation.delete({ where: { id } });
    revalidatePath("/documents/quotations");
    redirect("/documents/quotations");
  }

  async function convertToInvoiceAction(formData: FormData) {
    "use server";
    const { user } = await getCurrentUserRole();
    if (!can.createInvoices(user)) redirect("/dashboard");
    const db = orgDb(user.orgId);
    const id = String(formData.get("id") ?? "").trim();
    const quotation = await db.quotation.findFirst({ where: { id, orgId: user.orgId }, select: { clientId: true, items: true, totalAmount: true, currency: true, notes: true } });
    if (!quotation) redirect("/documents/quotations");
    const nextInvNumber = await nextDocumentNumber(db, "INV", "invoice", orgId);
    await db.invoice.create({
      data: {
        orgId: user.orgId,
        invoiceNumber: nextInvNumber,
        clientId: quotation.clientId,
        currency: quotation.currency ?? "UGX",
        totalAmount: quotation.totalAmount,
        notes: quotation.notes ?? "",
        status: "DRAFT",
        lines: {
          create: quotation.items.map((item: any) => ({
            orgId: user.orgId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            lineTotal: item.lineTotal,
            taxAmount: 0,
          })),
        },
      },
    });
    await db.quotation.update({ where: { id }, data: { convertedToInvoiceId: nextInvNumber } });
    revalidatePath("/documents/quotations");
    redirect("/documents/quotations");
  }

  const pageView = paginationView(page, totalItems, pageSize);
  const hrefForPage = (p: number) => pageHrefBuilder(`/documents/quotations`, { page: p.toString(), status: statusFilter, q });

  const [clients, parts, taxRates, leads, jobs, branding] = await Promise.all([
    db.client.findMany({ where: { orgId: user.orgId }, orderBy: { fullName: "asc" }, take: 300, select: { id: true, fullName: true, phone: true, email: true, organization: true, address: true } }),
    db.part.findMany({ where: { orgId: user.orgId, isActive: true }, orderBy: { name: "asc" }, take: 500, select: { id: true, sku: true, name: true, unitCost: true, qtyOnHand: true } }),
    db.taxRate.findMany({ where: { orgId: user.orgId, isActive: true, appliesToSales: true }, orderBy: [{ isDefault: "desc" }, { code: "asc" }], select: { id: true, name: true, code: true, rate: true, isDefault: true } }),
    db.lead.findMany({ where: { orgId: user.orgId, status: { notIn: ["LOST", "STALE"] } }, orderBy: { updatedAt: "desc" }, take: 150, select: { id: true, fullName: true, phone: true, organization: true, interest: true } }),
    db.job.findMany({ where: { orgId: user.orgId, status: { notIn: ["CLOSED"] } }, orderBy: { updatedAt: "desc" }, take: 150, select: { id: true, jobNumber: true, brand: true, model: true, client: { select: { fullName: true, phone: true, address: true } } } }),
    getDocumentBrandingSettings(user.orgId),
  ]);

  const defaultTaxRateObj = taxRates.find((rate) => rate.isDefault) ?? null;

  return (
    <QuotationPreviewProvider>
      <section className="space-y-4">
        <PageHeader
          title="Quotations"
          eyebrow="Documents"
          actions={
canCreate && <QuotationNewButton className="btn-premium rounded-lg px-4 py-2 text-[13px] font-bold" />
          }
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
                <button
                  key={s.key}
                  type="submit"
                  name="status"
                  value={s.key}
                  className={`rounded-full px-3 py-1 text-[13px] font-semibold transition ${
                    statusFilter === s.key
                      ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/40"
                      : "border border-transparent text-[var(--ink-muted)] hover:border-[var(--line)] hover:text-[var(--ink)]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="qt-search">Search quotations</label>
            <input
              id="qt-search"
              name="q"
              defaultValue={q}
              placeholder="#, customer, amount…"
              className="ml-auto h-8 w-56 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 text-[13px] outline-none focus:border-[var(--accent)]/50"
            />
</form>
          </div>

      <div>
  <BulkSelectionProvider pageIds={rows.map((r) => r.id)}>
    <BulkActionBar />
    {(() => {
      const columns = [
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
          <MenuActionLink href={`/documents/quotations/${row.id}`} icon="save">Edit</MenuActionLink>
          <MenuActionLink href={`/api/quotations/${row.id}/pdf`} external icon="download">Print / PDF</MenuActionLink>
          {["ACCEPTED", "SENT"].includes(row.status) && (
            <form action={convertToInvoiceAction}>
              <input type="hidden" name="id" value={row.id} />
              <MenuActionButton icon="save" tone="success" type="submit">Convert to Invoice</MenuActionButton>
            </form>
          )}
          <MenuSection label="Send" />
          <form action={`/api/quotations/${row.id}/send`} method="POST">
            <MenuActionButton icon="receipt" type="submit">Send by Email</MenuActionButton>
          </form>
          <form action={`/api/quotations/${row.id}/whatsapp`} method="POST">
            <MenuActionButton icon="whatsapp" tone="success" type="submit">Send by WhatsApp</MenuActionButton>
          </form>
          <MenuSection label="Danger zone" />
          {canDelete && (
            <form action={deleteQuotationAction}>
              <input type="hidden" name="id" value={row.id} />
              <MenuDestructiveRow icon="delete" type="submit">Delete</MenuDestructiveRow>
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
    </QuotationPreviewProvider>
  );
}
