import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { type PaymentMethod } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { formatMoney, formatMoneyCompact, normalizeCurrency } from "@/lib/currency";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { requireModule, OrgModule } from "@/lib/module-access";
import { assertOrgCanMutate } from "@/lib/org-write";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { RowActionsMenu, MenuActionButton, MenuActionLink, MenuDestructiveRow, MenuSection } from "@/components/shared/RowActionsMenu";
import { shareRefundDocument } from "@/lib/notifications/share-document";
import { PAYMENT_METHODS, formatPaymentMethodLabel, parsePaymentMethod } from "@/lib/constants/payment-methods";
import { formatEATDate } from "@/lib/date-eat";
import { DocumentFilterBar } from "@/components/documents";
import { DOCUMENT_PERIOD_OPTIONS_SHORT } from "@/lib/documents/period-filters";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; method?: string; type?: string; new?: string; period?: string; page?: string }>;
}) {
  await requireModule(OrgModule.INVOICING);
  const { user, orgId, org } = await requireOrgSession();
  if (!can.viewFinancials(user) && !["ADMIN", "OPS", "MANAGER", "FINANCE"].includes(user.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const methodFilter = params.method ?? "all";
  const typeFilter = params.type ?? "all";
  const periodFilter = params.period ?? "all";
  const page = parsePage(params.page);
  const now2 = new Date();
  const thisMonthStart = new Date(now2.getFullYear(), now2.getMonth(), 1);
  const lastMonthStart = new Date(now2.getFullYear(), now2.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now2.getFullYear(), now2.getMonth(), 0, 23, 59, 59);
  const showNewRefundForm = params.new === "1";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // ── Server actions ───────────────────────────────────────────────────────────

  async function createRefundAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!["ADMIN", "OPS", "MANAGER", "FINANCE"].includes(user.role)) return;
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "PAYMENT" });

    const sourceKey = String(formData.get("sourceKey") ?? "").trim();
    const amountRaw = Number(String(formData.get("amount") ?? "").trim());
    const methodRaw = String(formData.get("method") ?? "CASH").trim();
    const reference = String(formData.get("reference") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();

    const [sourceType, sourceId] = sourceKey.split(":", 2);
    if (!sourceId || !["invoice", "sale", "creditNote"].includes(sourceType)) return;
    if (!Number.isFinite(amountRaw) || amountRaw <= 0) return;

    const method = parsePaymentMethod(methodRaw, "CASH");

    let invoiceId: string | null = null;
    let saleId: string | null = null;
    let creditNoteId: string | null = null;
    let currency = org.baseCurrency;
    let refundableAmount = 0;

    if (sourceType === "invoice") {
      const inv = await prisma.invoice.findFirst({
        where: { id: sourceId, orgId, status: { not: "VOID" } },
        select: { id: true, paidAmount: true, currency: true, refunds: { select: { amount: true } } },
      });
      if (!inv) return;
      invoiceId = inv.id;
      currency = inv.currency;
      refundableAmount = Math.max(0, inv.paidAmount - inv.refunds.reduce((sum, refund) => sum + refund.amount, 0));
    } else if (sourceType === "sale") {
      const sale = await prisma.sale.findFirst({
        where: { id: sourceId, orgId, status: { not: "VOID" } },
        select: { id: true, paidAmount: true, currency: true, refunds: { select: { amount: true } } },
      });
      if (!sale) return;
      saleId = sale.id;
      currency = sale.currency;
      refundableAmount = Math.max(0, sale.paidAmount - sale.refunds.reduce((sum, refund) => sum + refund.amount, 0));
    } else {
      const creditNote = await prisma.creditNote.findFirst({
        where: { id: sourceId, orgId },
        select: { id: true, saleId: true, totalAmount: true, currency: true, refunds: { select: { amount: true } } },
      });
      if (!creditNote) return;
      creditNoteId = creditNote.id;
      saleId = creditNote.saleId;
      currency = creditNote.currency;
      refundableAmount = Math.max(0, creditNote.totalAmount - creditNote.refunds.reduce((sum, refund) => sum + refund.amount, 0));
    }
    if (refundableAmount <= 0 || amountRaw > refundableAmount) return;

    await prisma.refund.create({
      data: {
        orgId,
        invoiceId,
        saleId,
        creditNoteId,
        currency,
        amount: amountRaw,
        method,
        reference: reference || null,
        note: note || null,
        createdById: user.id,
      },
    });
    revalidatePath("/documents/refunds");
    redirect("/documents/refunds");
  }

  async function deleteRefundAction(formData: FormData) {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (user.role !== "ADMIN") return;

    const refundId = String(formData.get("refundId") ?? "").trim();
    if (!refundId) return;

    const refund = await prisma.refund.findFirst({ where: { id: refundId, orgId }, select: { id: true } });
    if (!refund) return;

    await prisma.refund.delete({ where: { id: refundId } });
    revalidatePath("/documents/refunds");
  }

  async function shareRefundWhatsAppAction(formData: FormData) {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "MANAGER", "FINANCE"].includes(user.role))) return;

    const refundId = String(formData.get("refundId") ?? "").trim();
    if (!refundId) return;
    await shareRefundDocument({ orgId, refundId, channel: "whatsapp" });
    revalidatePath("/documents/refunds");
  }

  async function shareRefundEmailAction(formData: FormData) {
    "use server";
    const { user, orgId } = await requireOrgSession();
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "MANAGER", "FINANCE"].includes(user.role))) return;

    const refundId = String(formData.get("refundId") ?? "").trim();
    if (!refundId) return;
    await shareRefundDocument({ orgId, refundId, channel: "email" });
    revalidatePath("/documents/refunds");
  }

  // ── Data fetching ────────────────────────────────────────────────────────────

  const baseWhere: Prisma.RefundWhereInput = { orgId };
  if (methodFilter !== "all") baseWhere.method = methodFilter as PaymentMethod;
  if (typeFilter === "invoice") baseWhere.invoiceId = { not: null };
  if (typeFilter === "sale") baseWhere.saleId = { not: null };

  const [refunds, kpiData, invoiceRefundTotal, saleRefundTotal, invoiceRefundSources, saleRefundSources, creditNoteRefundSources] = await Promise.all([
    prisma.refund.findMany({
      where: baseWhere,
      orderBy: { refundedAt: "desc" },
      take: 100,
      select: {
        id: true,
        amount: true,
        currency: true,
        method: true,
        reference: true,
        note: true,
        refundedAt: true,
        createdAt: true,
        invoiceId: true,
        saleId: true,
        creditNoteId: true,
        invoice: { select: { invoiceNumber: true, client: { select: { fullName: true, phone: true, email: true } }, job: { select: { id: true, client: { select: { fullName: true, phone: true, email: true } } } } } },
        sale: { select: { saleNumber: true, client: { select: { fullName: true, phone: true, email: true } } } },
        creditNote: { select: { creditNoteNumber: true, sale: { select: { client: { select: { fullName: true, phone: true, email: true } } } } } },
        createdBy: { select: { name: true } },
      },
    }).catch(() => [] as never[]),
    prisma.refund.aggregate({
      where: { orgId },
      _count: { id: true },
      _sum: { amount: true },
    }).catch(() => ({ _count: { id: 0 }, _sum: { amount: null } })),
    prisma.refund.aggregate({
      where: { orgId, invoiceId: { not: null } },
      _sum: { amount: true },
    }).catch(() => ({ _sum: { amount: null } })),
    prisma.refund.aggregate({
      where: { orgId, saleId: { not: null } },
      _sum: { amount: true },
    }).catch(() => ({ _sum: { amount: null } })),
    prisma.invoice.findMany({
      where: { orgId, status: { not: "VOID" }, paidAmount: { gt: 0 } },
      orderBy: { issuedAt: "desc" },
      take: 80,
      select: {
        id: true,
        invoiceNumber: true,
        paidAmount: true,
        currency: true,
        client: { select: { fullName: true } },
        job: { select: { jobNumber: true, client: { select: { fullName: true } } } },
        refunds: { select: { amount: true } },
      },
    }).catch(() => []),
    prisma.sale.findMany({
      where: { orgId, status: { not: "VOID" }, paidAmount: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: {
        id: true,
        saleNumber: true,
        paidAmount: true,
        currency: true,
        client: { select: { fullName: true } },
        refunds: { select: { amount: true } },
      },
    }).catch(() => []),
    prisma.creditNote.findMany({
      where: { orgId },
      orderBy: { issuedAt: "desc" },
      take: 80,
      select: {
        id: true,
        creditNoteNumber: true,
        totalAmount: true,
        currency: true,
        sale: { select: { saleNumber: true, client: { select: { fullName: true } } } },
        refunds: { select: { amount: true } },
      },
    }).catch(() => []),
  ]);

  const filtered = refunds.filter((r) => {
    if (q) {
      const search = q.toLowerCase();
      if (!(
        r.invoice?.invoiceNumber?.toLowerCase().includes(search) ||
        r.sale?.saleNumber?.toLowerCase().includes(search) ||
        r.creditNote?.creditNoteNumber?.toLowerCase().includes(search) ||
        r.invoice?.job?.client?.fullName?.toLowerCase().includes(search) ||
        r.sale?.client?.fullName?.toLowerCase().includes(search) ||
        r.reference?.toLowerCase().includes(search) ||
        r.note?.toLowerCase().includes(search)
      )) return false;
    }
    if (periodFilter === "this_month") return r.refundedAt >= thisMonthStart;
    if (periodFilter === "last_month") return r.refundedAt >= lastMonthStart && r.refundedAt <= lastMonthEnd;
    return true;
  });

  // KPIs come from whole-dataset aggregates above; only the displayed rows are paginated.
  const pageView = paginationView(page, filtered.length);
  const pageRows = filtered.slice(pageView.skip, pageView.skip + pageView.take);
  const refundsHref = pageHrefBuilder("/documents/refunds", {
    q,
    method: methodFilter !== "all" ? methodFilter : "",
    type: typeFilter !== "all" ? typeFilter : "",
    period: periodFilter !== "all" ? periodFilter : "",
  });

  const currency = org.baseCurrency;
  const totalRefunds = kpiData._count.id ?? 0;
  const totalAmount = kpiData._sum.amount ?? 0;
  const invoiceAmount = invoiceRefundTotal._sum.amount ?? 0;
  const saleAmount = saleRefundTotal._sum.amount ?? 0;
  const refundableInvoices = invoiceRefundSources
    .map((invoice) => ({
      ...invoice,
      refundableAmount: Math.max(0, invoice.paidAmount - invoice.refunds.reduce((sum, refund) => sum + refund.amount, 0)),
    }))
    .filter((invoice) => invoice.refundableAmount > 0);
  const refundableSales = saleRefundSources
    .map((sale) => ({
      ...sale,
      refundableAmount: Math.max(0, sale.paidAmount - sale.refunds.reduce((sum, refund) => sum + refund.amount, 0)),
    }))
    .filter((sale) => sale.refundableAmount > 0);
  const refundableCreditNotes = creditNoteRefundSources
    .map((creditNote) => ({
      ...creditNote,
      refundableAmount: Math.max(0, creditNote.totalAmount - creditNote.refunds.reduce((sum, refund) => sum + refund.amount, 0)),
    }))
    .filter((creditNote) => creditNote.refundableAmount > 0);
  const hasRefundSources = refundableInvoices.length > 0 || refundableSales.length > 0 || refundableCreditNotes.length > 0;

  type RefundRow = (typeof refunds)[number];

  const refundDerived = (r: RefundRow) => {
    const refundCurrency = normalizeCurrency(r.currency, currency);
    const sourceLabel = r.invoice
      ? r.invoice.invoiceNumber
      : r.sale
      ? r.sale.saleNumber
      : r.creditNote
      ? r.creditNote.creditNoteNumber
      : "—";
    const sourceHref = r.invoiceId
      ? `/documents/invoices?id=${r.invoiceId}`
      : r.saleId
      ? `/sales/${r.saleId}`
      : null;
    const clientName =
      r.invoice?.job?.client?.fullName ??
      r.invoice?.client?.fullName ??
      r.sale?.client?.fullName ??
      r.creditNote?.sale.client?.fullName ??
      "—";
    const recipientPhone =
      r.invoice?.job?.client?.phone ??
      r.invoice?.client?.phone ??
      r.sale?.client?.phone ??
      r.creditNote?.sale.client?.phone ??
      null;
    const recipientEmail =
      r.invoice?.job?.client?.email ??
      r.invoice?.client?.email ??
      r.sale?.client?.email ??
      r.creditNote?.sale.client?.email ??
      null;
    const refundUrl = `${appUrl}/api/refunds/${r.id}`;
    const refundShareText = encodeURIComponent(`Your refund document is ready.\n\n${sourceLabel}\nAmount: ${formatMoney(r.amount, refundCurrency)}\nPDF: ${refundUrl}`);
    const refundWaPhone = recipientPhone?.replace(/\D/g, "").replace(/^0/, "256");
    return { refundCurrency, sourceLabel, sourceHref, clientName, recipientPhone, recipientEmail, refundShareText, refundWaPhone };
  };

  /** Shared overflow menu — used by both the mobile cards and the desktop table rows. */
  const refundActionsMenu = (r: RefundRow) => {
    const { sourceLabel, recipientPhone, recipientEmail, refundShareText, refundWaPhone } = refundDerived(r);
    return (
      <RowActionsMenu label={`Refund actions for ${sourceLabel}`}>
        <div className="py-1 text-left">
          <MenuActionLink href={`/api/refunds/${r.id}`} external icon="receipt" tone="accent">
            Download Refund PDF
          </MenuActionLink>
        </div>
        <MenuSection label="Share" />
        {recipientPhone ? (
          <form action={shareRefundWhatsAppAction}>
            <input type="hidden" name="refundId" value={r.id} />
            <MenuActionButton icon="whatsapp" tone="success">Send via WhatsApp</MenuActionButton>
          </form>
        ) : (
          <span className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[var(--ink-muted)]">WhatsApp unavailable</span>
        )}
        {recipientEmail ? (
          <form action={shareRefundEmailAction}>
            <input type="hidden" name="refundId" value={r.id} />
            <MenuActionButton icon="open">Email refund</MenuActionButton>
          </form>
        ) : (
          <span className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[var(--ink-muted)]">Email unavailable</span>
        )}
        {refundWaPhone ? (
          <MenuActionLink href={`https://wa.me/${refundWaPhone}?text=${refundShareText}`} external icon="whatsapp" tone="success">
            Open WhatsApp Link
          </MenuActionLink>
        ) : null}
        {user.role === "ADMIN" ? (
          <MenuDestructiveRow>
            <form action={deleteRefundAction}>
              <input type="hidden" name="refundId" value={r.id} />
              <ConfirmSubmitButton
                message="Delete this refund? This cannot be undone."
                confirmLabel="Delete"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-500/10 hover:text-red-700"
              >Delete Refund</ConfirmSubmitButton>
            </form>
          </MenuDestructiveRow>
        ) : null}
      </RowActionsMenu>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header + KPIs */}
      <PageHeader
        eyebrow="Documents"
        title="Refunds"
        description="All cash refunds issued against invoices and sales"
        actions={
          ["ADMIN", "OPS", "MANAGER", "FINANCE"].includes(user.role) ? (
            <Link href="/documents/refunds?new=1" className="btn-premium rounded-lg px-3 py-1.5 text-[12px]">
              + New Refund
            </Link>
          ) : undefined
        }
      />

      <StatCards columns={4} cards={[
          { label: "Total Refunds", value: totalRefunds, sub: "all time" },
          { label: "Total Refunded", value: formatMoneyCompact(totalAmount, currency), sub: "amount returned" },
          { label: "Invoice Refunds", value: formatMoneyCompact(invoiceAmount, currency), sub: "from invoices" },
          { label: "Sale Refunds", value: formatMoneyCompact(saleAmount, currency), sub: "from sales" },
        ]} />

      {showNewRefundForm && ["ADMIN", "OPS", "MANAGER", "FINANCE"].includes(user.role) && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Issue New Refund</p>
              <p className="text-[13px] text-[var(--ink-muted)]">Record cash-out against an invoice, sale, or credit note.</p>
            </div>
            <Link href="/documents/refunds" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">
              Cancel
            </Link>
          </div>
          {hasRefundSources ? (
          <form action={createRefundAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Refund Source
              </label>
              <select
                name="sourceKey"
                required
                className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm"
              >
                <option value="">Select invoice, sale, or credit note...</option>
                {refundableInvoices.length > 0 ? (
                  <optgroup label="Invoices">
                    {refundableInvoices.map((invoice) => (
                      <option key={invoice.id} value={`invoice:${invoice.id}`}>
                        {invoice.invoiceNumber} - {invoice.job?.jobNumber ?? invoice.job?.client?.fullName ?? invoice.client?.fullName ?? "Invoice"} - refundable {formatMoney(invoice.refundableAmount, invoice.currency)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {refundableSales.length > 0 ? (
                  <optgroup label="POS sales">
                    {refundableSales.map((sale) => (
                      <option key={sale.id} value={`sale:${sale.id}`}>
                        {sale.saleNumber} - {sale.client?.fullName ?? "Walk-in"} - refundable {formatMoney(sale.refundableAmount, sale.currency)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {refundableCreditNotes.length > 0 ? (
                  <optgroup label="Credit notes">
                    {refundableCreditNotes.map((creditNote) => (
                      <option key={creditNote.id} value={`creditNote:${creditNote.id}`}>
                        {creditNote.creditNoteNumber} - {creditNote.sale.saleNumber} - refundable {formatMoney(creditNote.refundableAmount, creditNote.currency)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Amount ({currency})
              </label>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                required
                className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Method
              </label>
              <select
                name="method"
                className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{formatPaymentMethodLabel(m)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Reference
              </label>
              <input
                name="reference"
                placeholder="Optional"
                className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <label className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Note
              </label>
              <input
                name="note"
                placeholder="Optional reason for refund"
                className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
              <button type="submit" className="h-9 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-black hover:opacity-90">
                Issue Refund
              </button>
            </div>
          </form>
          ) : (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-3 text-[13px] text-[var(--ink-muted)]">
              No paid invoices, sales, or credit notes have refundable balances.
            </div>
          )}
        </div>
      )}

      {/* Filters: period chips + search + type/method */}
      <DocumentFilterBar
        basePath="/documents/refunds"
        q={q}
        period={periodFilter}
        periodOptions={DOCUMENT_PERIOD_OPTIONS_SHORT}
        extraQuery={{ method: methodFilter, type: typeFilter }}
        searchPlaceholder="Search invoice, sale, client, reference…"
      >
        <form method="GET" className="flex gap-2">
          <input type="hidden" name="period" value={periodFilter} />
          {q ? <input type="hidden" name="q" value={q} /> : null}
          <select
            name="type"
            defaultValue={typeFilter}
            className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--accent)]/50"
          >
            <option value="all">All Types</option>
            <option value="invoice">Invoice Refunds</option>
            <option value="sale">Sale Refunds</option>
          </select>
          <select
            name="method"
            defaultValue={methodFilter}
            className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--accent)]/50"
          >
            <option value="all">All Methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{formatPaymentMethodLabel(m)}</option>
            ))}
          </select>
          <button
            type="submit"
            className="h-8 rounded-lg border border-[var(--line)] px-3 text-[12px] font-medium hover:bg-[var(--panel-strong)]"
          >
            Filter
          </button>
        </form>
      </DocumentFilterBar>

      {/* Table */}
      <DataTable
        rows={pageRows}
        getRowKey={(r) => r.id}
        empty="No refunds found"
        renderMobileCard={(r) => {
          const { refundCurrency, sourceLabel, sourceHref, clientName } = refundDerived(r);
          return (
            <div className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {sourceHref ? (
                    <Link href={sourceHref} className="mono text-xs font-semibold text-[var(--accent)] hover:underline">{sourceLabel}</Link>
                  ) : (
                    <span className="mono text-xs font-semibold text-[var(--ink)]">{sourceLabel}</span>
                  )}
                  <StatusBadge tone={r.invoiceId ? "info" : "violet"}>{r.invoiceId ? "Invoice" : "Sale"}</StatusBadge>
                </div>
                <StatusBadge tone="neutral" className="shrink-0">{r.method.replace(/_/g, " ")}</StatusBadge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px]">
                <span className="font-medium text-[var(--ink)]">{clientName}</span>
                <span className="font-bold tabular-nums text-[var(--ink)]">{formatMoney(r.amount, refundCurrency)}</span>
                <span className="text-[var(--ink-muted)]">{formatEATDate(r.refundedAt)}</span>
              </div>
              {(r.reference || r.note) && (
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-[var(--ink-muted)]">
                  {r.reference && <span>Ref: <span className="mono">{r.reference}</span></span>}
                  {r.note && <span className="line-clamp-1">{r.note}</span>}
                </div>
              )}
              <div className="mt-1 flex items-center justify-between text-[13px] text-[var(--ink-muted)]">
                <span>By: {r.createdBy?.name ?? "—"}</span>
                {refundActionsMenu(r)}
              </div>
            </div>
          );
        }}
        columns={[
          {
            key: "date",
            header: "Date",
            className: "whitespace-nowrap text-[var(--ink-muted)]",
            cell: (r) => formatEATDate(r.refundedAt),
          },
          {
            key: "source",
            header: "Source",
            cell: (r) => {
              const { sourceLabel, sourceHref } = refundDerived(r);
              return (
                <div className="flex flex-col gap-0.5">
                  {sourceHref ? (
                    <Link href={sourceHref} className="mono font-semibold text-[var(--accent)] hover:underline">
                      {sourceLabel}
                    </Link>
                  ) : (
                    <span className="mono font-semibold">{sourceLabel}</span>
                  )}
                  {r.creditNote && (
                    <span className="text-[12px] text-[var(--ink-muted)]">
                      CN: {r.creditNote.creditNoteNumber}
                    </span>
                  )}
                  <StatusBadge tone={r.invoiceId ? "info" : "violet"} className="w-fit">
                    {r.invoiceId ? "Invoice" : "Sale"}
                  </StatusBadge>
                </div>
              );
            },
          },
          {
            key: "client",
            header: "Client",
            className: "font-medium text-[var(--ink)]",
            cell: (r) => refundDerived(r).clientName,
          },
          {
            key: "method",
            header: "Method",
            cell: (r) => <StatusBadge tone="neutral">{r.method.replace(/_/g, " ")}</StatusBadge>,
          },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            className: "whitespace-nowrap font-bold text-[var(--ink)]",
            cell: (r) => formatMoney(r.amount, refundDerived(r).refundCurrency),
          },
          {
            key: "reference",
            header: "Reference",
            className: "mono text-[var(--ink-muted)]",
            cell: (r) => r.reference || "—",
          },
          {
            key: "note",
            header: "Note",
            className: "max-w-[160px] truncate text-[var(--ink-muted)]",
            cell: (r) => r.note || "—",
          },
          {
            key: "issuedBy",
            header: "Issued By",
            className: "whitespace-nowrap text-[var(--ink-muted)]",
            cell: (r) => r.createdBy?.name ?? "—",
          },
        ]}
        actions={(r) => (
          <>
            <a href={`/api/refunds/${r.id}`} target="_blank" rel="noreferrer" title="Download PDF" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] transition hover:bg-[var(--accent)]/20">
              PDF
            </a>
            {refundActionsMenu(r)}
          </>
        )}
      />

      <TablePagination
        page={pageView.page}
        totalPages={pageView.totalPages}
        rangeStart={pageView.rangeStart}
        rangeEnd={pageView.rangeEnd}
        total={pageView.total}
        unit="refunds"
        hrefForPage={refundsHref}
      />
    </div>
  );
}
