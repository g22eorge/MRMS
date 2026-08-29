export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { formatMoney, normalizeCurrency, toBaseAmount } from "@/lib/currency";
import { can } from "@/lib/permissions";
import { prisma, ensureMoneySchema } from "@/lib/prisma";
import { findRecentDuplicate } from "@/lib/dedup";
import { orgDb } from "@/lib/db";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { RowActionsMenu, MenuSection, MenuDestructiveRow, MenuActionLink, MenuActionButton } from "@/components/shared/RowActionsMenu";
import { DocumentPreviewButton } from "@/components/documents/DocumentPreviewButton";
import { createReceiptForPayment } from "@/lib/commercial/document-workflow";
import { syncInvoicePaymentState, syncSalePaymentState } from "@/lib/commercial/payment-sync";
import { reverseJournalEntry, postJournalEntry } from "@/lib/accounting/post";
import { PAYMENT_METHODS, formatPaymentMethodLabel, parsePaymentMethod } from "@/lib/constants/payment-methods";
import { formatEATDate, formatEATTime } from "@/lib/date-eat";
import { dateFilterForDocumentPeriod } from "@/lib/documents/period-filters";
import { shareReceiptDocument } from "@/lib/notifications/share-document";
import {
  DocumentPageHeader,
  DocumentFilterBar,
  DocumentShareMenuSection,
  DocumentEmptyState,
} from "@/components/documents";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { FormErrorBanner } from "@/components/ui/FormErrorBanner";
import { type SourceGroup } from "@/components/documents/DocumentSourcePicker";
import {PAGE_SIZE, parsePage, paginationView, pageHrefBuilder, parsePageSize, sizeHrefBuilder} from "@/lib/pagination";
import { CreateReceiptDialog, type ReceiptFormState } from "./CreateReceiptDialog";
import { clientDisplayName } from "@/lib/client-name";
import { icontains } from "@/lib/db/search";

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; period?: string; new?: string; page?: string; size?: string; error?: string }>;
}) {
  const { user, orgId, org } = await requireOrgSession();
  const db = orgDb(orgId);
  const baseCurrency = org.baseCurrency;
  if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const period = params.period ?? "all";
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.size);
  const createMode = params.new === "1";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  async function createReceiptAction(_prev: ReceiptFormState, formData: FormData): Promise<ReceiptFormState> {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    // Payment capture stays available while suspended (canRecordPaymentsWhenSuspended).
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "PAYMENT" });
    const db = orgDb(orgId);
    const baseCurrency = org.baseCurrency;
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS"].includes(user.role))) redirect("/dashboard");
    // Payment + receipt + C5 ledger post run inside the txn below; ensure schema first.
    await ensureMoneySchema();

    const sourceKey = String(formData.get("sourceKey") ?? "").trim();
    const legacyInvoiceId = String(formData.get("invoiceId") ?? "").trim();
    const [sourceType, sourceId] = sourceKey.includes(":")
      ? sourceKey.split(":", 2)
      : ["invoice", legacyInvoiceId];
    const amount = Number(String(formData.get("amount") ?? "").replace(/[^\d.]/g, "").trim());
    const methodRaw = String(formData.get("method") ?? "CASH").trim();
    const reference = String(formData.get("reference") ?? "").trim();
    const currency = normalizeCurrency(formData.get("currency"), baseCurrency);
    if (!sourceId || !["invoice", "sale"].includes(sourceType)) return { error: "Choose the invoice or sale this receipt is for." };
    if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount greater than zero." };

    const method = parsePaymentMethod(methodRaw, "OTHER");
    if (sourceType === "invoice") {
      const invoice = await db.invoice.findFirst({ where: { id: sourceId, status: { not: "VOID" } }, select: { id: true, totalAmount: true, paidAmount: true, clientId: true, jobId: true, currency: true } });
      if (!invoice) return { error: "That invoice could not be found." };
      if (invoice.paidAmount + amount > invoice.totalAmount) {
        return { error: `That is more than the balance — ${formatMoney(invoice.totalAmount - invoice.paidAmount, normalizeCurrency(invoice.currency, baseCurrency))} outstanding.` };
      }

      // Record the payment in the INVOICE's currency, not the form's. A foreign-
      // currency invoice needs an FX rate or syncInvoicePaymentState converts to 0
      // and paidAmount never advances — the receipt dialog doesn't collect a rate,
      // so reject rather than silently under-record (use the invoice detail's
      // Collect payment, which does collect the rate).
      const invCurrency = normalizeCurrency(invoice.currency, baseCurrency);
      const rateRaw = String(formData.get("exchangeRateToBase") ?? "").replace(/,/g, "").trim();
      const exchangeRateToBase = invCurrency === baseCurrency ? null : (rateRaw ? Number(rateRaw) : null);
      if (invCurrency !== baseCurrency && (!exchangeRateToBase || !Number.isFinite(exchangeRateToBase) || exchangeRateToBase <= 0)) {
        return { error: `This invoice is in ${invCurrency}. Use Collect payment on the invoice, which records the exchange rate.` };
      }

      let deduped = false;
      await prisma.$transaction(async (tx) => {
        const dup = await findRecentDuplicate(tx.payment, { orgId, invoiceId: invoice.id, amount, method });
        if (dup) { deduped = true; return; }
        const payment = await tx.payment.create({ data: { orgId, invoiceId: invoice.id, amount, method, reference: reference || null, currency: invCurrency, exchangeRateToBase, createdById: user.id } });
        await createReceiptForPayment(tx, { orgId, paymentId: payment.id, invoiceId: invoice.id, clientId: invoice.clientId, amount, currency: invCurrency, issuedById: user.id });
        await syncInvoicePaymentState(tx, { orgId, invoiceId: invoice.id, baseCurrency, actorUserId: user.id });
      });
      if (!deduped) await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "Invoice", entityId: invoice.id, action: "RECEIPT_CREATED", summary: "Receipt generated from invoice" });
    } else {
      const sale = await prisma.sale.findFirst({ where: { id: sourceId, orgId, status: { not: "VOID" } }, select: { id: true, totalAmount: true, paidAmount: true, currency: true, clientId: true } });
      if (!sale) return { error: "That sale could not be found." };
      if (sale.paidAmount + amount > sale.totalAmount) {
        return { error: `That is more than the balance — ${formatMoney(sale.totalAmount - sale.paidAmount, normalizeCurrency(sale.currency, baseCurrency))} outstanding.` };
      }
      const saleCurrency = normalizeCurrency(sale.currency, baseCurrency);
      if (saleCurrency !== baseCurrency || currency !== baseCurrency) {
        return { error: `Receipts for ${saleCurrency} sales are not supported yet — record the payment on the sale itself.` };
      }

      let deduped = false;
      await prisma.$transaction(async (tx) => {
        const dup = await findRecentDuplicate(tx.payment, { orgId, saleId: sale.id, amount, method });
        if (dup) { deduped = true; return; }
        const payment = await tx.payment.create({ data: { orgId, saleId: sale.id, amount, method, reference: reference || null, currency: saleCurrency, createdById: user.id } });
        await createReceiptForPayment(tx, { orgId, paymentId: payment.id, saleId: sale.id, clientId: sale.clientId, amount, currency: saleCurrency, issuedById: user.id });
        await syncSalePaymentState(tx, { orgId, saleId: sale.id });
      });
      if (!deduped) await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "Sale", entityId: sale.id, action: "RECEIPT_CREATED", summary: "Receipt generated from sale" });
    }
    revalidatePath("/documents/receipts");
    revalidatePath("/documents/invoices");
    return null;
  }

  async function updateReceiptAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
    const db = orgDb(orgId);
    const baseCurrency = org.baseCurrency;
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS"].includes(user.role))) redirect("/dashboard");
    await ensureMoneySchema();

    const paymentId = String(formData.get("paymentId") ?? "").trim();
    const amount = Number(String(formData.get("amount") ?? "").trim());
    const methodRaw = String(formData.get("method") ?? "CASH").trim();
    const reference = String(formData.get("reference") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    const issueDateRaw = String(formData.get("issueDate") ?? "").trim();
    if (!paymentId) return;
    if (!Number.isFinite(amount) || amount <= 0) {
      redirect(`/documents/receipts?error=${encodeURIComponent("Enter a receipt amount greater than zero.")}`);
    }

    const method = parsePaymentMethod(methodRaw, "OTHER");

    const source = await prisma.payment.findFirst({
      where: { id: paymentId, orgId },
      select: { amount: true, invoiceId: true, saleId: true, currency: true, exchangeRateToBase: true },
    });
    if (!source) return;
    // Governance: a voided receipt is a closed record — never edit it.
    const existingReceipt = await prisma.receipt.findFirst({ where: { orgId, paymentId }, select: { voidedAt: true } });
    if (existingReceipt?.voidedAt) {
      redirect(`/documents/receipts?error=${encodeURIComponent("That receipt has been voided, so it can no longer be edited.")}`);
    }
    // Ledger delta in the payment's own currency (matching how the original
    // "pay:<id>" entry posted), so an amount change keeps the books in step.
    const ledgerDelta = Math.round((amount - source.amount + Number.EPSILON) * 100) / 100;

    if (source.invoiceId) {
      const invoice = await db.invoice.findFirst({ where: { id: source.invoiceId }, select: { id: true, totalAmount: true } });
      if (!invoice) return;
      const otherPayments = await prisma.payment.findMany({
        where: { invoiceId: invoice.id, orgId, id: { not: paymentId } },
        select: { amount: true, currency: true, exchangeRateToBase: true },
      });
      const nextPaidAmount = otherPayments.reduce((sum, p) => sum + toBaseAmount({ amount: p.amount, currency: p.currency, baseCurrency, exchangeRateToBase: p.exchangeRateToBase }), 0)
        + toBaseAmount({ amount, currency: source.currency, baseCurrency, exchangeRateToBase: source.exchangeRateToBase });
      if (nextPaidAmount > invoice.totalAmount) {
        redirect(`/documents/receipts?error=${encodeURIComponent(`That amount would pay more than the invoice total of ${formatMoney(invoice.totalAmount, baseCurrency)}.`)}`);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { id: paymentId, orgId },
        data: { amount, method, reference: reference || null, note: note || null },
      });

      // Keep the linked Receipt document in sync (no relation/cascade exists,
      // so the amount must be updated explicitly or the job timeline goes stale).
      await tx.receipt.updateMany({ where: { orgId, paymentId }, data: { amount, ...(issueDateRaw ? { issuedAt: new Date(issueDateRaw) } : {}) } });

      // Post a balanced adjusting entry for the amount change so the ledger tracks
      // the new receipt amount (unique per edit, so repeated edits each adjust).
      if (Math.abs(ledgerDelta) > 0.005) {
        const adjCount = await tx.journalEntry.count({ where: { orgId, reference: { startsWith: `pay:${paymentId}:adj:` } } });
        await postJournalEntry(tx, {
          orgId,
          userId: user.id,
          description: `Receipt amount adjusted (${source.amount} → ${amount})`,
          reference: `pay:${paymentId}:adj:${adjCount + 1}`,
          lines: ledgerDelta > 0
            ? [{ code: "1000", debit: ledgerDelta, memo: "Cash adjustment" }, { code: "4000", credit: ledgerDelta, memo: "Sales revenue adjustment" }]
            : [{ code: "4000", debit: -ledgerDelta, memo: "Sales revenue adjustment" }, { code: "1000", credit: -ledgerDelta, memo: "Cash adjustment" }],
        });
      }

      if (source.invoiceId) {
        const invoice = await tx.invoice.findFirst({ where: { id: source.invoiceId, orgId }, select: { id: true, totalAmount: true, jobId: true } });
        if (invoice) {
          await syncInvoicePaymentState(tx, { orgId, invoiceId: invoice.id, baseCurrency, actorUserId: user.id });
        }
      }

      if (source.saleId) {
        const sale = await tx.sale.findFirst({ where: { id: source.saleId, orgId }, select: { id: true, totalAmount: true } });
        if (sale) {
          await syncSalePaymentState(tx, { orgId, saleId: sale.id });
        }
      }
    });
    await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "Payment", entityId: paymentId, action: "RECEIPT_UPDATED", summary: "Receipt/payment updated" });

    revalidatePath("/documents/receipts");
    revalidatePath("/documents/invoices");
  }

  async function deleteReceiptAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
    const baseCurrency = org.baseCurrency;
    if (!("ADMIN" === user.role || can.approveInvoices(user))) return;
    await ensureMoneySchema();

    const paymentId = String(formData.get("paymentId") ?? "").trim();
    if (!paymentId) return;

    const source = await prisma.payment.findFirst({
      where: { id: paymentId, orgId },
      select: { invoiceId: true, saleId: true },
    });
    if (!source) return;

    await prisma.$transaction(async (tx) => {
      // Void (rather than delete) the linked Receipt document so the numbered
      // record is retained for audit; the job timeline already hides voided rows.
      //
      // This MUST run before the payment is deleted: Receipt.paymentId is an
      // onDelete: SetNull FK, so deleting the payment first detaches the receipt
      // and this update then matches zero rows — leaving a live, un-voided,
      // still-printable receipt pointing at nothing.
      await tx.receipt.updateMany({
        where: { orgId, paymentId },
        data: { voidedAt: new Date(), voidReason: "Payment deleted" },
      });

      await tx.payment.deleteMany({ where: { id: paymentId, orgId } });

      // Reverse the cash-basis ledger post for this payment ("pay:<id>") so the
      // deletion doesn't leave the ledger overstating cash.
      await reverseJournalEntry(tx, { orgId, userId: user.id, originalReference: `pay:${paymentId}`, description: "Reversal — receipt/payment deleted" });

      if (source.invoiceId) {
        const invoice = await tx.invoice.findFirst({ where: { id: source.invoiceId, orgId }, select: { id: true, totalAmount: true, jobId: true } });
        if (invoice) {
          await syncInvoicePaymentState(tx, { orgId, invoiceId: invoice.id, baseCurrency, actorUserId: user.id });
        }
      }

      if (source.saleId) {
        const sale = await tx.sale.findFirst({ where: { id: source.saleId, orgId }, select: { id: true, totalAmount: true } });
        if (sale) {
          await syncSalePaymentState(tx, { orgId, saleId: sale.id });
        }
      }
    });
    await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "Payment", entityId: paymentId, action: "RECEIPT_DELETED", summary: "Receipt/payment deleted" });

    revalidatePath("/documents/receipts");
    revalidatePath("/documents/invoices");
  }

  async function shareReceiptWhatsAppAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "PAYMENT" });
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) return;

    const paymentId = String(formData.get("paymentId") ?? "").trim();
    if (!paymentId) return;
    await shareReceiptDocument({ orgId, paymentId, channel: "whatsapp" });
    revalidatePath("/documents/receipts");
  }

  async function shareReceiptEmailAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "PAYMENT" });
    if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) return;

    const paymentId = String(formData.get("paymentId") ?? "").trim();
    if (!paymentId) return;
    await shareReceiptDocument({ orgId, paymentId, channel: "email" });
    revalidatePath("/documents/receipts");
  }

  const periodFilter = dateFilterForDocumentPeriod(period);

  const searchWhere = q
    ? {
        OR: [
          { reference: icontains(q) },
          { note: icontains(q) },
          { invoice: { invoiceNumber: icontains(q) } },
          { sale: { saleNumber: icontains(q) } },
        ],
      }
    : {};

  const paymentsWhere = {
    orgId,
    ...(periodFilter ? { receivedAt: periodFilter } : {}),
    ...(q ? searchWhere : {}),
  };

  // Whole-dataset KPIs need every matching row (currency-converted sums can't be
  // SQL-aggregated); keep this slim (few columns) and paginate the display rows.
  const [receiptsTotal, statsRows, pageRows] = await Promise.all([
    prisma.payment.count({ where: paymentsWhere }),
    prisma.payment.findMany({
      where: paymentsWhere,
      select: { amount: true, currency: true, exchangeRateToBase: true, receivedAt: true, method: true },
    }),
    prisma.payment.findMany({
      where: paymentsWhere,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        amount: true,
        currency: true,
        exchangeRateToBase: true,
        method: true,
        reference: true,
        note: true,
        receivedAt: true,
        receipts: { select: { issuedAt: true }, orderBy: { issuedAt: "desc" }, take: 1 },
        sale: { select: { id: true, saleNumber: true, client: { select: { fullName: true, phone: true, email: true, organization: true } } } },
        invoice: { select: { id: true, invoiceNumber: true, client: { select: { fullName: true, phone: true, email: true, organization: true } }, job: { select: { id: true, jobNumber: true, client: { select: { fullName: true, phone: true, email: true, organization: true } } } } } },
      },
    }),
  ]);
  const payments = pageRows;
  const pageView = paginationView(page, receiptsTotal, pageSize);
  const receiptsHrefFilters = { q, period: period !== "all" ? period : "",
    size: pageSize !== PAGE_SIZE ? pageSize : "",
  };
  const receiptsHref = pageHrefBuilder("/documents/receipts", receiptsHrefFilters);
  const receiptsHrefSize = sizeHrefBuilder("/documents/receipts", receiptsHrefFilters);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalAmountBase = statsRows.reduce(
    (sum, p) =>
      sum +
        toBaseAmount({
          amount: p.amount,
          currency: normalizeCurrency(p.currency, baseCurrency),
          baseCurrency,
          exchangeRateToBase: p.exchangeRateToBase,
        }),
    0,
  );
  const thisMonth = statsRows.filter((p) => p.receivedAt >= monthStart);
  const thisMonthAmountBase = thisMonth.reduce(
    (sum, p) =>
      sum +
        toBaseAmount({
          amount: p.amount,
          currency: normalizeCurrency(p.currency, baseCurrency),
          baseCurrency,
          exchangeRateToBase: p.exchangeRateToBase,
        }),
    0,
  );
  const cashPaymentsCount = statsRows.filter((p) => p.method === "CASH").length;
  type InvoiceOption = {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    paidAmount: number;
    currency: string | null;
    job: { jobNumber: string; client: { fullName: string; phone: string | null; organization: string | null } | null } | null;
    client: { fullName: string; phone: string | null; organization: string | null } | null;
  };

  type SaleOption = {
    id: string;
    saleNumber: string;
    totalAmount: number;
    paidAmount: number;
    currency: string | null;
    client: { fullName: string; phone: string | null; organization: string | null } | null;
  };

  const [invoiceOptions, saleOptions]: [InvoiceOption[], SaleOption[]] = await Promise.all([
    db.invoice.findMany({
      where: { status: { not: "VOID" } },
      orderBy: { issuedAt: "desc" },
      take: 80,
      select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, currency: true, job: { select: { jobNumber: true, client: { select: { fullName: true, phone: true, organization: true } } } }, client: { select: { fullName: true, phone: true, organization: true } } },
    }).then((rows: InvoiceOption[]) => rows.filter((invoice) => invoice.paidAmount < invoice.totalAmount)),
    prisma.sale.findMany({
      where: { orgId, status: { not: "VOID" } },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { id: true, saleNumber: true, totalAmount: true, paidAmount: true, currency: true, client: { select: { fullName: true, phone: true, organization: true } } },
    }).then((rows: SaleOption[]) => rows.filter((sale) => sale.paidAmount < sale.totalAmount)),
  ]);
  // Customer first, so the person paying is what you search for and read.
  const paymentSourceGroups: SourceGroup[] = [
    {
      label: "Invoices",
      options: invoiceOptions.map((inv) => {
        const who = clientDisplayName(inv.client ?? inv.job?.client, "No customer");
        return {
          value: `invoice:${inv.id}`,
          label: `${who} — ${inv.invoiceNumber}`,
          hint: `${inv.job?.jobNumber ? inv.job.jobNumber + " · " : ""}due ${formatMoney(inv.totalAmount - inv.paidAmount, normalizeCurrency(inv.currency, baseCurrency))}`,
          search: [who, inv.client?.phone, inv.job?.client?.phone, inv.invoiceNumber, inv.job?.jobNumber].filter(Boolean).join(" "),
        };
      }),
    },
    {
      label: "Sales",
      options: saleOptions.map((sale) => {
        const who = clientDisplayName(sale.client, "Walk-in");
        return {
          value: `sale:${sale.id}`,
          label: `${who} — ${sale.saleNumber}`,
          hint: `due ${formatMoney(sale.totalAmount - sale.paidAmount, normalizeCurrency(sale.currency, baseCurrency))}`,
          search: [who, sale.client?.phone, sale.saleNumber].filter(Boolean).join(" "),
        };
      }),
    },
  ].filter((g) => g.options.length > 0);

  function methodBadge(method: string) {
    switch (method) {
      case "CASH":          return "border-emerald-500/30 bg-emerald-500/15 text-emerald-700";
      case "MOBILE_MONEY":  return "border-sky-500/30 bg-sky-500/15 text-sky-700";
      case "CARD":          return "border-slate-500/30 bg-slate-500/15 text-slate-600";
      case "BANK_TRANSFER": return "border-blue-500/30 bg-blue-500/15 text-blue-700";
      default:              return "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]";
    }
  }

  type PaymentRow = (typeof payments)[number];

  function paymentLabel(p: PaymentRow) {
    return p.invoice?.job?.jobNumber
      ? `Repair ${p.invoice.job.jobNumber}`
      : p.sale?.saleNumber
        ? `Sale ${p.sale.saleNumber}`
        : p.invoice?.invoiceNumber
          ? `Invoice ${p.invoice.invoiceNumber}`
          : "Payment";
  }

  function paymentLinkHref(p: PaymentRow) {
    return p.invoice?.job?.id ? `/jobs/${p.invoice.job.id}` : p.sale?.id ? `/pos/${p.sale.id}` : null;
  }

  return (
    <section className="space-y-4">
      <FormErrorBanner message={params.error} />
      <DocumentPageHeader
        title="Receipts"
        action={
          paymentSourceGroups.length > 0 ? (
            <CreateReceiptDialog
              sourceGroups={paymentSourceGroups}
              baseCurrency={baseCurrency}
              paymentMethods={[...PAYMENT_METHODS]}
              action={createReceiptAction}
              initialOpen={createMode}
            />
          ) : (
            <Link href="/documents/invoices" className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem]">
              Create Invoice
            </Link>
          )
        }
        kpis={[
          { label: "Total", value: receiptsTotal, sub: `this month: ${thisMonth.length}` },
          { label: "Total Amount", value: formatMoney(totalAmountBase, baseCurrency) },
          { label: "This Month", value: formatMoney(thisMonthAmountBase, baseCurrency), accent: true },
          { label: "Cash", value: cashPaymentsCount },
        ]}
      />

      <DocumentFilterBar
        basePath="/documents/receipts"
        q={q}
        period={period}
        mode="form"
        searchPlaceholder="Search reference, invoice #, sale #…"
      />

      <div className="space-y-3 md:hidden">
        {payments.map((p) => {
          const currency = normalizeCurrency(p.currency, baseCurrency);
          const label = p.invoice?.job?.jobNumber
            ? `Repair ${p.invoice.job.jobNumber}`
            : p.sale?.saleNumber
              ? `Sale ${p.sale.saleNumber}`
              : p.invoice?.invoiceNumber
                ? `Invoice ${p.invoice.invoiceNumber}`
                : "Payment";

          const linkHref = p.invoice?.job?.id
            ? `/jobs/${p.invoice.job.id}`
            : p.sale?.id
              ? `/pos/${p.sale.id}`
              : null;
          const recipientPhone = p.invoice?.job?.client?.phone ?? p.invoice?.client?.phone ?? p.sale?.client?.phone ?? null;
          const recipientEmail = p.invoice?.job?.client?.email ?? p.invoice?.client?.email ?? p.sale?.client?.email ?? null;
          const receiptUrl = `${appUrl}/api/payments/${p.id}/receipt`;
          const receiptShareText = encodeURIComponent(`Your receipt is ready.\n\n${label}\nAmount: ${formatMoney(p.amount, currency)}\nPDF: ${receiptUrl}`);
          const receiptWaPhone = recipientPhone?.replace(/\D/g, "").replace(/^0/, "256");

          return (
            <article key={p.id} className="dc-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.75rem] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                    {formatEATDate(p.receivedAt)} · {formatEATTime(p.receivedAt)}
                  </p>
                  <p className="mt-1 mono text-base font-black text-[var(--ink)]">{formatMoney(p.amount, currency)}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.75rem] font-semibold ${methodBadge(p.method)}`}>
                  {p.method.replaceAll("_", " ")}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
                <div className="min-w-0">
                  {linkHref ? (
                    <Link href={linkHref} className="block truncate text-[0.8125rem] font-semibold text-[var(--ink)]">
                      {label}
                    </Link>
                  ) : (
                    <p className="truncate text-[0.8125rem] font-semibold text-[var(--ink-muted)]">{label}</p>
                  )}
                  <p className="truncate text-[0.75rem] text-[var(--ink-muted)]">{p.reference ?? "No reference"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {linkHref ? (
                    <Link href={linkHref} title="View source" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </Link>
                  ) : null}
                  <a href={`/api/payments/${p.id}/receipt`} target="_blank" rel="noreferrer" title="Open receipt PDF" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] transition hover:bg-[var(--accent)]/20">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M9 12h6M9 16h4"/></svg>
                  </a>
                  <RowActionsMenu label="Receipt actions">
                    <div className="py-1 text-left">
                      <MenuActionLink href={`/documents/receipts/${p.id}`} icon="open">
                        View receipt
                      </MenuActionLink>
                      <DocumentPreviewButton pdfUrl={`/api/payments/${p.id}/receipt`} title="Receipt" />
                      <MenuActionLink href={`/api/payments/${p.id}/receipt`} external icon="receipt" tone="success">
                        Download Receipt PDF
                      </MenuActionLink>
                    </div>
                    <DocumentShareMenuSection
                      hiddenFieldName="paymentId"
                      hiddenFieldValue={p.id}
                      recipientPhone={recipientPhone}
                      recipientEmail={recipientEmail}
                      whatsAppAction={shareReceiptWhatsAppAction}
                      emailAction={shareReceiptEmailAction}
                      emailLabel="Email receipt"
                      waLinkHref={receiptWaPhone ? `https://wa.me/${receiptWaPhone}?text=${receiptShareText}` : null}
                    />
                    <MenuSection label="Edit Receipt" />
                    <form action={updateReceiptAction} className="space-y-2 p-3">
                      <input type="hidden" name="paymentId" value={p.id} />
                      <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Issue date
                        <input name="issueDate" type="date" defaultValue={new Date(p.receipts[0]?.issuedAt ?? p.receivedAt).toISOString().slice(0, 10)} className="mt-0.5 w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]/50" />
                      </label>
                      <input name="amount" required type="number" min="0.01" step="0.01" defaultValue={p.amount} className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]/50" />
                      <select name="method" defaultValue={p.method} className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]/50">
                        {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{formatPaymentMethodLabel(m)}</option>)}
                      </select>
                      <input name="reference" defaultValue={p.reference ?? ""} placeholder="Reference" className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]/50" />
                      <textarea name="note" defaultValue={p.note ?? ""} placeholder="Note" className="min-h-14 w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]/50" />
                      <MenuActionButton icon="save" tone="accent" className="bg-[var(--accent)]/8">Save Receipt</MenuActionButton>
                    </form>
                    <MenuDestructiveRow>
                      <form action={deleteReceiptAction}>
                        <input type="hidden" name="paymentId" value={p.id} />
                        <ConfirmSubmitButton message="Delete this receipt/payment? Totals will be recalculated." className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-500/10 hover:text-red-700">Delete Receipt</ConfirmSubmitButton>
                      </form>
                    </MenuDestructiveRow>
                  </RowActionsMenu>
                </div>
              </div>
            </article>
          );
        })}
        {payments.length === 0 ? <DocumentEmptyState message="No payments yet." /> : null}
      </div>

      <div className="hidden md:block">
        <DataTable
          rows={payments}
          getRowKey={(p) => p.id}
          empty="No payments yet."
          columns={[
            {
              key: "date",
              header: "Date",
              className: "text-[var(--ink-muted)]",
              cell: (p) => (
                <>
                  {formatEATDate(p.receivedAt)}<br /><span className="text-[0.75rem]">{formatEATTime(p.receivedAt)}</span>
                </>
              ),
            },
            {
              key: "amount",
              header: "Amount",
              className: "whitespace-nowrap font-semibold tabular-nums text-[var(--ink)]",
              cell: (p) => formatMoney(p.amount, normalizeCurrency(p.currency, baseCurrency)),
            },
            {
              key: "method",
              header: "Method",
              headerClassName: "hidden md:table-cell",
              className: "hidden md:table-cell",
              cell: (p) => (
                <span className={`rounded-full border px-2 py-0.5 font-semibold ${methodBadge(p.method)}`}>
                  {p.method.replaceAll("_", " ")}
                </span>
              ),
            },
            {
              key: "reference",
              header: "Reference",
              headerClassName: "hidden lg:table-cell",
              className: "hidden text-[var(--ink-muted)] lg:table-cell",
              cell: (p) => p.reference ?? "-",
            },
            {
              key: "for",
              header: "For",
              cell: (p) => {
                const label = paymentLabel(p);
                const linkHref = paymentLinkHref(p);
                return linkHref ? (
                  <Link href={linkHref} className="font-medium text-[var(--ink)] transition hover:text-[var(--accent)]">
                    {label}
                  </Link>
                ) : (
                  <span className="text-[var(--ink-muted)]">{label}</span>
                );
              },
            },
          ]}
          actions={(p) => {
            const currency = normalizeCurrency(p.currency, baseCurrency);
            const label = paymentLabel(p);
            const linkHref = paymentLinkHref(p);
            const recipientPhone = p.invoice?.job?.client?.phone ?? p.invoice?.client?.phone ?? p.sale?.client?.phone ?? null;
            const recipientEmail = p.invoice?.job?.client?.email ?? p.invoice?.client?.email ?? p.sale?.client?.email ?? null;
            const receiptUrl = `${appUrl}/api/payments/${p.id}/receipt`;
            const receiptShareText = encodeURIComponent(`Your receipt is ready.\n\n${label}\nAmount: ${formatMoney(p.amount, currency)}\nPDF: ${receiptUrl}`);
            const receiptWaPhone = recipientPhone?.replace(/\D/g, "").replace(/^0/, "256");

            return (
              <>
                {linkHref ? (
                  <Link href={linkHref} title="View source" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </Link>
                ) : null}
                <a href={`/api/payments/${p.id}/receipt`} target="_blank" rel="noreferrer" title="Open receipt PDF" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)] transition hover:bg-[var(--accent)]/20">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M9 12h6M9 16h4"/></svg>
                </a>
                <RowActionsMenu label="Receipt actions">
                  <div className="py-1 text-left">
                    <MenuActionLink href={`/documents/receipts/${p.id}`} icon="open">
                      View receipt
                    </MenuActionLink>
                    <DocumentPreviewButton pdfUrl={`/api/payments/${p.id}/receipt`} title="Receipt" />
                    <MenuActionLink href={`/api/payments/${p.id}/receipt`} external icon="receipt" tone="success">
                      Download Receipt PDF
                    </MenuActionLink>
                  </div>
                  <DocumentShareMenuSection
                    hiddenFieldName="paymentId"
                    hiddenFieldValue={p.id}
                    recipientPhone={recipientPhone}
                    recipientEmail={recipientEmail}
                    whatsAppAction={shareReceiptWhatsAppAction}
                    emailAction={shareReceiptEmailAction}
                    emailLabel="Email receipt"
                    waLinkHref={receiptWaPhone ? `https://wa.me/${receiptWaPhone}?text=${receiptShareText}` : null}
                  />
                  <MenuSection label="Edit Receipt" />
                  <form action={updateReceiptAction} className="space-y-2 p-3">
                    <input type="hidden" name="paymentId" value={p.id} />
                    <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-[var(--ink-muted)]">Issue date
                      <input name="issueDate" type="date" defaultValue={new Date(p.receipts[0]?.issuedAt ?? p.receivedAt).toISOString().slice(0, 10)} className="mt-0.5 w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 outline-none focus:border-[var(--accent)]/50" />
                    </label>
                    <input name="amount" required type="number" min="0.01" step="0.01" defaultValue={p.amount} className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 outline-none focus:border-[var(--accent)]/50" />
                    <select name="method" defaultValue={p.method} className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 outline-none focus:border-[var(--accent)]/50">
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{formatPaymentMethodLabel(m)}</option>)}
                    </select>
                    <input name="reference" defaultValue={p.reference ?? ""} placeholder="Reference" className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 outline-none focus:border-[var(--accent)]/50" />
                    <textarea name="note" defaultValue={p.note ?? ""} placeholder="Note" className="min-h-14 w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 outline-none focus:border-[var(--accent)]/50" />
                    <MenuActionButton icon="save" tone="accent" className="bg-[var(--accent)]/8">Save Receipt</MenuActionButton>
                  </form>
                  <MenuDestructiveRow>
                    <form action={deleteReceiptAction}>
                      <input type="hidden" name="paymentId" value={p.id} />
                      <ConfirmSubmitButton message="Delete this receipt/payment? Totals will be recalculated." className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-semibold text-red-600 transition hover:bg-red-500/10 hover:text-red-700">Delete Receipt</ConfirmSubmitButton>
                    </form>
                  </MenuDestructiveRow>
                </RowActionsMenu>
              </>
            );
          }}
        />
      </div>

      <TablePagination
        page={pageView.page}
        totalPages={pageView.totalPages}
        rangeStart={pageView.rangeStart}
        rangeEnd={pageView.rangeEnd}
        total={pageView.total}
        unit="receipts"
        hrefForPage={receiptsHref}
          pageSize={pageSize}
          hrefForSize={receiptsHrefSize}
      />
    </section>
  );
}
