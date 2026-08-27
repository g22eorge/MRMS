import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { type PaymentMethod } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { formatMoney, formatMoneyCompact, normalizeCurrency, toBaseAmount } from "@/lib/currency";
import { can } from "@/lib/permissions";
import { prisma, ensureMoneySchema } from "@/lib/prisma";
import { findRecentDuplicate } from "@/lib/dedup";
import { requireOrgSession } from "@/lib/org-context";
import { requireModule, OrgModule } from "@/lib/module-access";
import { assertOrgCanMutate } from "@/lib/org-write";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { RowActionsMenu, MenuActionButton, MenuActionLink, MenuDestructiveRow, MenuSection } from "@/components/shared/RowActionsMenu";
import { DocumentPreviewButton } from "@/components/documents/DocumentPreviewButton";
import { shareRefundDocument } from "@/lib/notifications/share-document";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { postRefund, reverseJournalEntry } from "@/lib/accounting/post";
import { syncInvoicePaymentState, syncSalePaymentState } from "@/lib/commercial/payment-sync";
import { PAYMENT_METHODS, formatPaymentMethodLabel, parsePaymentMethod } from "@/lib/constants/payment-methods";
import { formatEATDate } from "@/lib/date-eat";
import { DocumentFilterBar } from "@/components/documents";
import { DocumentSourcePicker, type SourceGroup } from "@/components/documents/DocumentSourcePicker";
import { creditNoteParent } from "@/lib/commercial/credit-note-parent";
import { DOCUMENT_PERIOD_OPTIONS_SHORT } from "@/lib/documents/period-filters";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import {parsePage, paginationView, pageHrefBuilder, PAGE_SIZE, parsePageSize, sizeHrefBuilder} from "@/lib/pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Disclosure, DisclosureButton, DisclosurePanel } from "@/components/shared/Disclosure";
import { clientDisplayName } from "@/lib/client-name";

import { SubmitButton } from "@/components/ui/SubmitButton";
import { flash } from "@/lib/flash";
export const dynamic = "force-dynamic";

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; method?: string; type?: string; period?: string; page?: string; size?: string; error?: string }>;
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
  const pageSize = parsePageSize(params.size);
  const now2 = new Date();
  const thisMonthStart = new Date(now2.getFullYear(), now2.getMonth(), 1);
  const lastMonthStart = new Date(now2.getFullYear(), now2.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now2.getFullYear(), now2.getMonth(), 0, 23, 59, 59);
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
    if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
      redirect(`/documents/refunds?error=${encodeURIComponent("Enter a refund amount greater than zero.")}`);
    }

    const method = parsePaymentMethod(methodRaw, "CASH");

    let invoiceId: string | null = null;
    let saleId: string | null = null;
    let creditNoteId: string | null = null;
    let currency = org.baseCurrency;

    // Everything below is held in ORG BASE currency, because that is the unit
    // Invoice.paidAmount and Sale.paidAmount are stored in. Mixing that with a
    // document-currency figure used to make a USD 100 sale look like it had
    // hundreds of thousands refundable.
    let refundableBase = 0;
    // A credit note stores no FX rate of its own, so its ceiling can only be
    // converted once the rate on this form has been read. Held here until then.
    let creditNoteDocTotal: number | null = null;
    let creditNoteRefundedBase = 0;

    if (sourceType === "invoice") {
      const inv = await prisma.invoice.findFirst({
        where: { id: sourceId, orgId, status: { not: "VOID" } },
        select: { id: true, paidAmount: true, currency: true },
      });
      if (!inv) return;
      invoiceId = inv.id;
      currency = inv.currency;
      // paidAmount is already net of both REFUND-kind payments and Refund rows
      // (see sumInvoicePaidAmount), so subtracting refunds again would halve it.
      refundableBase = Math.max(0, inv.paidAmount);
    } else if (sourceType === "sale") {
      const sale = await prisma.sale.findFirst({
        where: { id: sourceId, orgId, status: { not: "VOID" } },
        select: { id: true, paidAmount: true, currency: true },
      });
      if (!sale) return;
      saleId = sale.id;
      currency = sale.currency;
      refundableBase = Math.max(0, sale.paidAmount);
    } else {
      const creditNote = await prisma.creditNote.findFirst({
        where: { id: sourceId, orgId },
        select: {
          id: true,
          saleId: true,
          invoiceId: true,
          totalAmount: true,
          currency: true,
          refunds: { select: { amount: true, currency: true, exchangeRateToBase: true } },
        },
      });
      if (!creditNote) return;
      creditNoteId = creditNote.id;
      // Inherit whichever parent the credit note hangs off, so refunding an
      // invoice-sourced credit note reduces that invoice rather than nothing.
      saleId = creditNote.saleId;
      invoiceId = creditNote.invoiceId;
      currency = creditNote.currency;
      // A credit note carries no paidAmount and stores no rate of its own, so
      // its total stays in document currency until the form's rate is read.
      creditNoteDocTotal = creditNote.totalAmount;
      creditNoteRefundedBase = creditNote.refunds.reduce(
        (sum, refund) =>
          sum +
          toBaseAmount({
            amount: refund.amount,
            currency: refund.currency,
            baseCurrency: org.baseCurrency,
            exchangeRateToBase: refund.exchangeRateToBase,
          }),
        0,
      );
    }

    // Capture the FX rate for a non-base refund so it can be converted for
    // base-currency reporting (was left null, making conversion impossible).
    // This has to happen before the cap check: the cap is in base and the typed
    // amount is in document currency, so one of them needs converting first.
    const refundCurrency = normalizeCurrency(currency, org.baseCurrency);
    const rawRate = String(formData.get("exchangeRateToBase") ?? "").replace(/,/g, "").trim();
    const exchangeRateToBase = refundCurrency === org.baseCurrency ? null : (rawRate ? Number(rawRate) : null);
    if (refundCurrency !== org.baseCurrency && (!exchangeRateToBase || !Number.isFinite(exchangeRateToBase) || exchangeRateToBase <= 0)) {
      redirect(`/documents/refunds?error=${encodeURIComponent(`Enter the exchange rate for this ${refundCurrency} refund.`)}`);
    }

    if (creditNoteDocTotal != null) {
      const creditedBase = toBaseAmount({
        amount: creditNoteDocTotal,
        currency: refundCurrency,
        baseCurrency: org.baseCurrency,
        exchangeRateToBase,
      });
      refundableBase = Math.max(0, creditedBase - creditNoteRefundedBase);
    }

    // Show the ceiling in the currency the user is actually typing in.
    const refundableAmount = exchangeRateToBase ? refundableBase / exchangeRateToBase : refundableBase;
    const amountBase = toBaseAmount({
      amount: amountRaw,
      currency: refundCurrency,
      baseCurrency: org.baseCurrency,
      exchangeRateToBase,
    });

    // Was a bare return, so over-refunding did nothing at all — no refund, no
    // message. The amount field has no max, so this is an ordinary typo.
    if (refundableBase <= 0) {
      redirect(`/documents/refunds?error=${encodeURIComponent("There is nothing left to refund on that document.")}`);
    }
    if (amountBase > refundableBase) {
      redirect(`/documents/refunds?error=${encodeURIComponent(`That is more than the refundable amount (${formatMoney(refundableAmount, refundCurrency)}).`)}`);
    }

    // Double-submit guard: an identical refund landed seconds ago — reuse it
    // instead of paying out twice.
    const dupRefund = await findRecentDuplicate(prisma.refund, {
      orgId,
      invoiceId,
      saleId,
      creditNoteId,
      amount: amountRaw,
      method,
    });
    if (dupRefund) {
      revalidatePath("/documents/refunds");
      redirect(flash("/documents/refunds", "Refund created"));
    }

    // Refund write + ledger reversal run inside the txn; ensure schema first.
    await ensureMoneySchema();
    const refund = await prisma.$transaction(async (tx) => {
      const created = await tx.refund.create({
        data: {
          orgId,
          invoiceId,
          saleId,
          creditNoteId,
          currency,
          exchangeRateToBase,
          amount: amountRaw,
          method,
          reference: reference || null,
          note: note || null,
          createdById: user.id,
        },
        select: { id: true },
      });
      // Recompute paid state on the source so a refund actually reduces
      // paidAmount / reopens it — for a sale source too, not just invoices
      // (previously a sale refund left sale.paidAmount stale).
      if (invoiceId) {
        await syncInvoicePaymentState(tx, { orgId, invoiceId, baseCurrency: org.baseCurrency, actorUserId: user.id });
      } else if (saleId) {
        await syncSalePaymentState(tx, { orgId, saleId });
      }

      // Re-check the ceiling INSIDE the transaction. The check above runs before
      // the transaction opens, so two refunds submitted at the same moment both
      // read the pre-write ceiling and both pass — and the duplicate guard only
      // catches identical amounts within ten seconds, not two different ones.
      // The sync above has already subtracted this refund, so an over-refund now
      // shows up as a negative paid balance, and throwing rolls the whole thing
      // back rather than paying out money that was not there.
      if (invoiceId || saleId) {
        const after = invoiceId
          ? await tx.invoice.findFirst({ where: { id: invoiceId, orgId }, select: { paidAmount: true } })
          : await tx.sale.findFirst({ where: { id: saleId as string, orgId }, select: { paidAmount: true } });
        if (after && after.paidAmount < -0.005) {
          throw new Error("That refund is larger than what is left on the document. Reload and try again.");
        }
      } else if (creditNoteId) {
        const [cn, drawn] = await Promise.all([
          tx.creditNote.findFirst({ where: { id: creditNoteId, orgId }, select: { totalAmount: true, currency: true } }),
          tx.refund.findMany({
            where: { orgId, creditNoteId },
            select: { amount: true, currency: true, exchangeRateToBase: true },
          }),
        ]);
        if (cn) {
          const creditedBase = toBaseAmount({
            amount: cn.totalAmount,
            currency: cn.currency,
            baseCurrency: org.baseCurrency,
            exchangeRateToBase,
          });
          const drawnBase = drawn.reduce(
            (sum, r) =>
              sum +
              toBaseAmount({ amount: r.amount, currency: r.currency, baseCurrency: org.baseCurrency, exchangeRateToBase: r.exchangeRateToBase }),
            0,
          );
          if (drawnBase - creditedBase > 0.005) {
            throw new Error("That refund is larger than what is left on the credit note. Reload and try again.");
          }
        }
      }
      // C5: cash-basis ledger post — reverse revenue, pay out cash. Post the base
      // value of a foreign refund (was posting the document-currency number).
      const baseRefund = refundCurrency === org.baseCurrency
        ? amountRaw
        : toBaseAmount({ amount: amountRaw, currency: refundCurrency, baseCurrency: org.baseCurrency, exchangeRateToBase });
      await postRefund(tx, {
        orgId,
        userId: user.id,
        amount: baseRefund,
        reference: `refund:${created.id}`,
        description: `Refund against ${sourceType} ${sourceId}`,
      });
      return created;
    });
    await writeSystemAuditEvent({
      orgId,
      actorUserId: user.id,
      entityType: "Refund",
      entityId: refund.id,
      action: "REFUND_CREATED",
      summary: `Refund ${formatMoney(amountRaw, currency)} against ${sourceType} ${sourceId}`,
    });
    revalidatePath("/documents/refunds");
    redirect(flash("/documents/refunds", "Refund created"));
  }

  async function deleteRefundAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
    if (user.role !== "ADMIN") return;

    const refundId = String(formData.get("refundId") ?? "").trim();
    if (!refundId) return;

    const refund = await prisma.refund.findFirst({ where: { id: refundId, orgId }, select: { id: true, amount: true, currency: true, invoiceId: true, saleId: true } });
    if (!refund) return;

    await ensureMoneySchema();
    await prisma.$transaction(async (tx) => {
      await tx.refund.deleteMany({ where: { id: refundId, orgId } });
      // Reverse the refund's ledger post ("refund:<id>") and reopen the source's
      // paid state — deleting the refund undoes both the cash-out and the reduction.
      // Handle a sale source too, mirroring the create path (was invoice-only, so a
      // deleted sale refund left sale.paidAmount understated).
      await reverseJournalEntry(tx, { orgId, userId: user.id, originalReference: `refund:${refundId}`, description: "Reversal — refund deleted" });
      if (refund.invoiceId) {
        await syncInvoicePaymentState(tx, { orgId, invoiceId: refund.invoiceId, baseCurrency: org.baseCurrency, actorUserId: user.id });
      } else if (refund.saleId) {
        await syncSalePaymentState(tx, { orgId, saleId: refund.saleId });
      }
    });
    await writeSystemAuditEvent({
      orgId,
      actorUserId: user.id,
      entityType: "Refund",
      entityId: refundId,
      action: "REFUND_DELETED",
      summary: `Refund deleted (${formatMoney(refund.amount, refund.currency)})`,
      before: { amount: refund.amount, currency: refund.currency },
    });
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
  // Period + text search run in SQL (not in-memory over the first 100 rows), so
  // large orgs don't silently lose older refunds and pagination reflects the true
  // filtered total. SQLite LIKE is ASCII-case-insensitive, matching the old lowercased filter.
  if (periodFilter === "this_month") baseWhere.refundedAt = { gte: thisMonthStart };
  else if (periodFilter === "last_month") baseWhere.refundedAt = { gte: lastMonthStart, lte: lastMonthEnd };
  if (q) {
    baseWhere.OR = [
      { reference: { contains: q } },
      { note: { contains: q } },
      { invoice: { is: { invoiceNumber: { contains: q } } } },
      { invoice: { is: { job: { is: { client: { is: { OR: [{ fullName: { contains: q } }, { organization: { contains: q } }] } } } } } } },
      { sale: { is: { saleNumber: { contains: q } } } },
      { sale: { is: { client: { is: { OR: [{ fullName: { contains: q } }, { organization: { contains: q } }] } } } } },
      { creditNote: { is: { creditNoteNumber: { contains: q } } } },
    ];
  }

  const refundListSelect = {
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
    invoice: { select: { invoiceNumber: true, client: { select: { fullName: true, phone: true, email: true, organization: true } }, job: { select: { id: true, client: { select: { fullName: true, phone: true, email: true, organization: true } } } } } },
    sale: { select: { saleNumber: true, client: { select: { fullName: true, phone: true, email: true, organization: true } } } },
    creditNote: {
      select: {
        creditNoteNumber: true,
        sale: { select: { client: { select: { fullName: true, phone: true, email: true, organization: true } } } },
        invoice: {
          select: {
            client: { select: { fullName: true, phone: true, email: true, organization: true } },
            job: { select: { client: { select: { fullName: true, phone: true, email: true, organization: true } } } },
          },
        },
      },
    },
    createdBy: { select: { name: true } },
  } satisfies Prisma.RefundSelect;

  const [refundCount, kpiData, invoiceRefundTotal, saleRefundTotal, invoiceRefundSources, saleRefundSources, creditNoteRefundSources] = await Promise.all([
    prisma.refund.count({ where: baseWhere }).catch(() => 0),
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
        client: { select: { fullName: true, phone: true, organization: true } },
        job: { select: { jobNumber: true, client: { select: { fullName: true, phone: true, organization: true } } } },
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
        client: { select: { fullName: true, phone: true, organization: true } },
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
        sale: { select: { saleNumber: true, client: { select: { fullName: true, phone: true, organization: true } } } },
        invoice: {
          select: {
            invoiceNumber: true,
            client: { select: { fullName: true, phone: true, organization: true } },
            job: { select: { jobNumber: true, client: { select: { fullName: true, phone: true, organization: true } } } },
          },
        },
        refunds: { select: { amount: true } },
      },
    }).catch(() => []),
  ]);

  // KPIs come from whole-dataset aggregates above; the list is paginated in SQL
  // against the filtered total so no rows are dropped beyond an arbitrary cap.
  const pageView = paginationView(page, refundCount, pageSize);
  const pageRows = await prisma.refund.findMany({
    where: baseWhere,
    orderBy: { refundedAt: "desc" },
    skip: pageView.skip,
    take: pageView.take,
    select: refundListSelect,
  }).catch(() => [] as never[]);
  const refundsHrefFilters = {
    q,
    method: methodFilter !== "all" ? methodFilter : "",
    type: typeFilter !== "all" ? typeFilter : "",
    period: periodFilter !== "all" ? periodFilter : "",
    size: pageSize !== PAGE_SIZE ? pageSize : "",
  };
  const refundsHref = pageHrefBuilder("/documents/refunds", refundsHrefFilters);
  const refundsHrefSize = sizeHrefBuilder("/documents/refunds", refundsHrefFilters);

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

  // Customer first — a job-linked invoice was labelled with its job number, so
  // searching for the person who is owed money found nothing.
  const refundSourceGroups: SourceGroup[] = [
    {
      label: "Invoices",
      options: refundableInvoices.map((invoice) => {
        const who = clientDisplayName(invoice.client ?? invoice.job?.client, "No customer");
        return {
          value: `invoice:${invoice.id}`,
          label: `${who} — ${invoice.invoiceNumber}`,
          hint: `${invoice.job?.jobNumber ? invoice.job.jobNumber + " · " : ""}refundable ${formatMoney(invoice.refundableAmount, invoice.currency)}`,
          search: [who, invoice.client?.phone, invoice.job?.client?.phone, invoice.invoiceNumber, invoice.job?.jobNumber].filter(Boolean).join(" "),
        };
      }),
    },
    {
      label: "Sales",
      options: refundableSales.map((sale) => {
        const who = clientDisplayName(sale.client, "Walk-in");
        return {
          value: `sale:${sale.id}`,
          label: `${who} — ${sale.saleNumber}`,
          hint: `refundable ${formatMoney(sale.refundableAmount, sale.currency)}`,
          search: [who, sale.client?.phone, sale.saleNumber].filter(Boolean).join(" "),
        };
      }),
    },
    {
      label: "Credit notes",
      options: refundableCreditNotes.map((cn) => {
        const parent = creditNoteParent(cn);
        return {
          value: `creditNote:${cn.id}`,
          label: `${parent.clientName} — ${cn.creditNoteNumber}`,
          hint: `${parent.reference ? parent.reference + " · " : ""}refundable ${formatMoney(cn.refundableAmount, cn.currency)}`,
          search: [parent.clientName, cn.creditNoteNumber, parent.reference].filter(Boolean).join(" "),
        };
      }),
    },
  ].filter((g) => g.options.length > 0);

  type RefundRow = (typeof pageRows)[number];

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
    const clientName = clientDisplayName(
      r.invoice?.job?.client ??
        r.invoice?.client ??
        r.sale?.client ??
        r.creditNote?.sale?.client ??
        r.creditNote?.invoice?.client ??
        r.creditNote?.invoice?.job?.client,
      "—",
    );
    const recipientPhone =
      r.invoice?.job?.client?.phone ??
      r.invoice?.client?.phone ??
      r.sale?.client?.phone ??
      r.creditNote?.sale?.client?.phone ??
      r.creditNote?.invoice?.client?.phone ??
      r.creditNote?.invoice?.job?.client?.phone ??
      null;
    const recipientEmail =
      r.invoice?.job?.client?.email ??
      r.invoice?.client?.email ??
      r.sale?.client?.email ??
      r.creditNote?.sale?.client?.email ??
      r.creditNote?.invoice?.client?.email ??
      r.creditNote?.invoice?.job?.client?.email ??
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
          <MenuActionLink href={`/documents/refunds/${r.id}`} icon="open">
            View refund
          </MenuActionLink>
          <DocumentPreviewButton pdfUrl={`/api/refunds/${r.id}`} title={`Refund · ${sourceLabel}`} />
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
    <Disclosure>
    <div className="space-y-4">
      {params.error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-[0.8125rem] font-medium text-red-600">
          {params.error}
        </p>
      ) : null}
      {/* Header + KPIs */}
      <PageHeader
        eyebrow="Documents"
        title="Refunds"
        description="Money paid back on an invoice, sale or credit note. For a POS return that restocks items, use Credit Notes."
        actions={
          ["ADMIN", "OPS", "MANAGER", "FINANCE"].includes(user.role) ? (
            <DisclosureButton
              label="+ New Refund"
              openLabel="Cancel"
              className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem]"
            />
          ) : undefined
        }
        kpis={[
          { label: "Total Refunds", value: totalRefunds, sub: "all time" },
          { label: "Total Refunded", value: formatMoneyCompact(totalAmount, currency), sub: "amount returned" },
          { label: "Invoice Refunds", value: formatMoneyCompact(invoiceAmount, currency), sub: "from invoices" },
          { label: "Sale Refunds", value: formatMoneyCompact(saleAmount, currency), sub: "from sales" },
        ]}
      />

      {["ADMIN", "OPS", "MANAGER", "FINANCE"].includes(user.role) && (
        <DisclosurePanel>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Issue New Refund</p>
            </div>
            <DisclosureButton
              label="Cancel"
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.8125rem] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]"
            />
          </div>
          {hasRefundSources ? (
          <form action={createRefundAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[0.8125rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Refund Source
              </label>
              <DocumentSourcePicker
                name="sourceKey"
                required
                groups={refundSourceGroups}
                placeholder="Search by customer, number or job…"
                emptyLabel="Nothing refundable matches that"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[0.8125rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
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
              <label className="text-[0.8125rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
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
              <label className="text-[0.8125rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Reference
              </label>
              <input
                name="reference"
                placeholder="Optional"
                className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <label className="text-[0.8125rem] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Note
              </label>
              <input
                name="note"
                placeholder="Optional reason for refund"
                className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
              <ConfirmSubmitButton
                message="Issue this refund? Money leaves the business and this cannot be undone."
                confirmLabel="Issue refund"
                className="h-9 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-black hover:opacity-90"
              >
                Issue Refund
              </ConfirmSubmitButton>
            </div>
          </form>
          ) : (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-3 text-[0.8125rem] text-[var(--ink-muted)]">
              No paid invoices, sales, or credit notes have refundable balances.
            </div>
          )}
        </div>
        </DisclosurePanel>
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
            className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none focus:border-[var(--accent)]/50"
          >
            <option value="all">All Types</option>
            <option value="invoice">Invoice Refunds</option>
            <option value="sale">Sale Refunds</option>
          </select>
          <select
            name="method"
            defaultValue={methodFilter}
            className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.75rem] text-[var(--ink)] outline-none focus:border-[var(--accent)]/50"
          >
            <option value="all">All Methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{formatPaymentMethodLabel(m)}</option>
            ))}
          </select>
          <SubmitButton bare className="h-8 rounded-lg border border-[var(--line)] px-3 text-[0.75rem] font-medium hover:bg-[var(--panel-strong)]">
            Filter
          </SubmitButton>
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
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.8125rem]">
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
              <div className="mt-1 flex items-center justify-between text-[0.8125rem] text-[var(--ink-muted)]">
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
                    <span className="text-[0.75rem] text-[var(--ink-muted)]">
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
            className: "whitespace-nowrap font-bold tabular-nums text-[var(--ink)]",
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
          pageSize={pageSize}
          hrefForSize={refundsHrefSize}
      />
    </div>
    </Disclosure>
  );
}
