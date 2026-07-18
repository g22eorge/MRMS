import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { CopyButton } from "@/components/shared/CopyButton";
import { RowActionsMenu, MenuSection, MenuActionLink, MenuActionButton } from "@/components/shared/RowActionsMenu";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { getClientBill } from "@/lib/billing";
import { formatMoney, getAppCurrency } from "@/lib/currency";
import { formatEATDate } from "@/lib/date-eat";
import { canGenerateQuotationForStatus, formatQuotationNumber } from "@/lib/documents";
import { getDocumentBrandingSettings } from "@/lib/document-branding";
import { normalizeJobStatus } from "@/lib/job-status";
import { filterSupportedJobStatuses } from "@/lib/job-status-server";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { requireModule, OrgModule } from "@/lib/module-access";
import { JobStatus, OutboundMessageType, QuotationStatus } from "@prisma/client";
import { assertOrgCanMutate } from "@/lib/org-write";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { ensureInvoiceFromQuotation, ensureQuotationFromJob } from "@/lib/commercial/document-workflow";
import { sendQuotationViaWhatsAppAction } from "@/app/(app)/jobs/[id]/actions";
import { enqueueEmailMessage } from "@/lib/notifications/whatsapp-outbox";
import {
  ExpireStaleDraftsButton,
  QuoteFollowUpBulkButton,
  QuoteFollowUpButton,
} from "@/components/documents/QuotationFollowUpForms";
import { shouldExpireQuotationDraft } from "@/lib/commercial/quote-followups";
import { DocumentFilterBar } from "@/components/documents";
import { DOCUMENT_PERIOD_OPTIONS_SHORT } from "@/lib/documents/period-filters";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatStrip } from "@/components/ui/StatStrip";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";

const QUOTATION_STATUS_TONES: Record<string, BadgeTone> = {
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "danger",
  SENT: "sky",
  DRAFT: "warning",
};

type SearchParams = {
  q?: string;
  approval?: string;
  period?: string;
  followupSent?: string;
  followupBulk?: string;
  followupSkipped?: string;
  followupFailed?: string;
  followupError?: string;
  expiredDrafts?: string;
  page?: string;
};

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, orgId } = await requireOrgSession();
  if (!(can.createQuotations(user) || can.viewFinancials(user))) {
    redirect("/dashboard");
  }
  await requireModule(OrgModule.INVOICING);

  const params = await searchParams;
  const { q, approval: approvalFilter, period: periodFilter = "all" } = params;
  const page = parsePage(params.page);
  const followupSentParam = params.followupSent ?? "";
  const followupBulkParam = params.followupBulk ?? "";
  const followupSkippedParam = params.followupSkipped ?? "";
  const followupFailedParam = params.followupFailed ?? "";
  const followupErrorParam = params.followupError ?? "";
  const expiredDraftsParam = params.expiredDrafts ?? "";
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const currency = getAppCurrency();

  // ── Server action: mark quotation as sent (sets quotedAt = now) ──────────
  async function markSent(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!(can.createQuotations(user) || can.viewFinancials(user))) return;
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const jobId = formData.get("jobId") as string;
    if (!jobId) return;
    await prisma.job.update({
      where: { id: jobId, orgId },
      data: { quotedAt: new Date() },
    });
    revalidatePath("/documents/quotations");
  }

  async function convertQuotationToInvoiceAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!(can.createInvoices(user) || can.approveInvoices(user))) return;
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const jobId = String(formData.get("jobId") ?? "").trim();
    const quotationId = String(formData.get("quotationId") ?? "").trim();
    if (!jobId && !quotationId) return;

    const result = await prisma.$transaction(async (tx) => {
      const quotation = quotationId
        ? await tx.quotation.findFirst({
            where: {
              id: quotationId,
              orgId,
              status: "ACCEPTED",
              convertedToInvoiceId: null,
              ...(!can.viewAllSales(user) && !can.approveInvoices(user) ? { createdById: user.id } : {}),
            },
            include: { items: true },
          })
        : await ensureQuotationFromJob(tx, { orgId, jobId, userId: user.id, currency: org.baseCurrency });
      if (!quotation) return;
      const invoice = await ensureInvoiceFromQuotation(tx, { orgId, quotationId: quotation.id, currency: org.baseCurrency });
      return invoice ? { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, quoteNumber: quotation.quoteNumber } : null;
    });
    if (result) {
      await writeSystemAuditEvent({ orgId, actorUserId: user.id, entityType: "Invoice", entityId: result.invoiceId, action: "QUOTATION_CONVERTED_TO_INVOICE", summary: `${result.quoteNumber} converted to ${result.invoiceNumber}` });
    }

    revalidatePath("/documents/quotations");
    revalidatePath("/documents/invoices");
  }

  async function sendQuotationWhatsAppAction(formData: FormData) {
    "use server";
    const jobId = String(formData.get("jobId") ?? "").trim();
    if (!jobId) return;
    await sendQuotationViaWhatsAppAction(jobId);
    revalidatePath("/documents/quotations");
  }

  async function sendQuotationEmailAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!(can.createQuotations(user) || can.viewFinancials(user))) return;
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const jobId = String(formData.get("jobId") ?? "").trim();
    if (!jobId) return;
    const job = await prisma.job.findFirst({
      where: { id: jobId, orgId },
      select: {
        id: true,
        jobNumber: true,
        brand: true,
        model: true,
        clientBill: true,
        client: { select: { fullName: true, email: true } },
      },
    });
    if (!job?.client.email) return;

    const quoteNumber = String(formData.get("quoteNumber") ?? "").trim() || `Quote for ${job.jobNumber}`;
    const pdfUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/jobs/${job.id}/quotation`;
    const body = [
      `Hi ${job.client.fullName},`,
      "",
      `Your repair quotation is ready.`,
      `Quote: ${quoteNumber}`,
      `Job: ${job.jobNumber}`,
      `Device: ${job.brand} ${job.model}`,
      job.clientBill ? `Estimate: ${formatMoney(job.clientBill, getAppCurrency())}` : null,
      "",
      `Download PDF: ${pdfUrl}`,
    ].filter(Boolean).join("\n");

    await enqueueEmailMessage({
      orgId,
      jobId: job.id,
      to: job.client.email,
      subject: `Quotation ${quoteNumber}`,
      body,
      type: OutboundMessageType.JOB_STATUS_UPDATE,
    });
    revalidatePath("/documents/quotations");
  }

  async function updateQuotationStatusAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });
    const quotationId = String(formData.get("quotationId") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    if (!quotationId || !["SENT", "ACCEPTED", "REJECTED"].includes(status)) return;

    if (status === "SENT" && !can.createQuotations(user)) return;
    if (status === "ACCEPTED" && !can.approveQuotations(user)) return;
    if (status === "REJECTED" && !can.createQuotations(user)) return;

    const accessWhere = {
      id: quotationId,
      orgId,
      ...(status === "ACCEPTED" || can.viewAllSales(user) ? {} : { createdById: user.id }),
    };
    const quote = await prisma.quotation.findFirst({ where: accessWhere, select: { id: true, leadId: true } });
    if (!quote) return;
    const now = new Date();
    await prisma.quotation.updateMany({
      where: accessWhere,
      data: {
        status: status as QuotationStatus,
        ...(status === "SENT" ? { sentAt: now } : {}),
        ...(status === "ACCEPTED" ? { acceptedAt: now, approvedById: user.id } : {}),
        ...(status === "REJECTED" ? { rejectedAt: now } : {}),
      },
    });
    if (quote.leadId && status === "ACCEPTED") {
      await prisma.lead.updateMany({ where: { id: quote.leadId, orgId }, data: { status: "WON", convertedAt: now, closedAt: null, lostReason: null } });
    }
    revalidatePath("/documents/quotations");
    revalidatePath(`/sales/quotations/${quotationId}`);
  }

  async function updateQuotationDetailsAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!can.createQuotations(user)) return;
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const quotationId = String(formData.get("quotationId") ?? "").trim();
    if (!quotationId) return;
    const validUntilRaw = String(formData.get("validUntil") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    await prisma.quotation.updateMany({
      where: {
        id: quotationId,
        orgId,
        status: "DRAFT",
        convertedToInvoiceId: null,
        ...(!can.viewAllSales(user) ? { createdById: user.id } : {}),
      },
      data: {
        validUntil: validUntilRaw ? new Date(validUntilRaw) : null,
        notes: notes || null,
      },
    });
    revalidatePath("/documents/quotations");
    revalidatePath(`/sales/quotations/${quotationId}`);
  }

  async function deleteQuotationRowAction(formData: FormData) {
    "use server";
    const { user, orgId, org } = await requireOrgSession();
    if (!can.createQuotations(user)) return;
    assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

    const quotationId = String(formData.get("quotationId") ?? "").trim();
    if (!quotationId) return;
    await prisma.quotation.deleteMany({
      where: {
        id: quotationId,
        orgId,
        status: "DRAFT",
        convertedToInvoiceId: null,
        ...(!can.viewAllSales(user) ? { createdById: user.id } : {}),
      },
    });
    revalidatePath("/documents/quotations");
  }

  const [jobs, standaloneQuotations, branding] = await Promise.all([
    prisma.job.findMany({
      where: {
        orgId,
        ...(!can.viewAllSales(user) && !can.viewFinancials(user) ? { OR: [{ assignedToId: user.id }, { createdById: user.id }] } : {}),
        status: approvalFilter === "pending"
          ? ("AWAITING_APPROVAL" as JobStatus)
          : {
              in: filterSupportedJobStatuses([
                "DIAGNOSING",
                "REFERRED",
                "IN_EXTERNAL_REPAIR",
                "WAITING_FOR_PARTS",
                "RETURNED_FROM_EXTERNAL",
                "AWAITING_APPROVAL",
                "IN_REPAIR",
                "READY_FOR_PICKUP",
                "COMPLETED",
                "CLOSED",
              ]) as JobStatus[],
            },
        ...(approvalFilter === "pending"
          ? { clientApproved: null }
          : approvalFilter === "approved"
          ? { clientApproved: true }
          : approvalFilter === "declined"
          ? { clientApproved: false }
          : {}),
        ...(q
          ? {
              OR: [
                { jobNumber: { contains: q } },
                { client: { fullName: { contains: q } } },
                { brand: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [
        // AWAITING_APPROVAL jobs float to top
        { status: "asc" },
        { updatedAt: "desc" },
      ],
      take: 100,
      select: {
        id: true,
        jobNumber: true,
        status: true,
        brand: true,
        model: true,
        deviceType: true,
        clientBill: true,
        quotedAt: true,
        updatedAt: true,
        clientApproved: true,
        approvalDate: true,
        client: { select: { fullName: true, phone: true, email: true } },
        quotations: { select: { id: true, quoteNumber: true, status: true, validUntil: true, notes: true, convertedToInvoiceId: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.quotation.findMany({
      where: {
        orgId,
        jobId: null,
        ...(!can.viewAllSales(user) && !can.viewFinancials(user) ? { createdById: user.id } : {}),
        ...(approvalFilter === "pending"
          ? { status: { in: ["DRAFT", "SENT"] as QuotationStatus[] } }
          : approvalFilter === "approved"
          ? { status: "ACCEPTED" as QuotationStatus }
          : approvalFilter === "declined"
          ? { status: "REJECTED" as QuotationStatus }
          : {}),
        ...(periodFilter === "this_month"
          ? { createdAt: { gte: thisMonthStart } }
          : periodFilter === "last_month"
          ? { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } }
          : {}),
        ...(q
          ? {
              OR: [
                { quoteNumber: { contains: q } },
                { client: { fullName: { contains: q } } },
                { lead: { fullName: { contains: q } } },
                { items: { some: { description: { contains: q } } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        validUntil: true,
        convertedToInvoiceId: true,
        client: { select: { fullName: true, phone: true, email: true } },
        lead: { select: { fullName: true, phone: true, email: true, interest: true } },
        _count: { select: { items: true } },
      },
    }),
    getDocumentBrandingSettings(),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const pendingCount = jobs.filter(
    (j) => j.status === "AWAITING_APPROVAL" && j.clientApproved === null,
  ).length;
  const standalonePendingCount = standaloneQuotations.filter((quotation) => ["DRAFT", "SENT"].includes(quotation.status)).length;
  const standaloneSentCount = standaloneQuotations.filter((quotation) => quotation.status === "SENT").length;
  const followUpAwaitingCount = pendingCount + standaloneSentCount;
  const staleDraftCount =
    standaloneQuotations.filter(
      (quotation) =>
        quotation.status === "DRAFT" &&
        shouldExpireQuotationDraft({
          status: quotation.status,
          createdAt: quotation.createdAt,
          validUntil: quotation.validUntil,
        }),
    ).length +
    jobs.filter((job) => {
      const draft = job.quotations[0];
      return (
        draft?.status === "DRAFT" &&
        shouldExpireQuotationDraft({
          status: draft.status,
          createdAt: draft.createdAt,
          validUntil: draft.validUntil,
        })
      );
    }).length;
  const totalQuoteCount = jobs.length + standaloneQuotations.length;

  const canSendQuoteFollowUps =
    ["ADMIN", "OPS"].includes(user.role) ||
    can.createQuotations(user) ||
    can.approveQuotations(user);
  const canExpireStaleDrafts = can.createQuotations(user) || ["ADMIN", "OPS"].includes(user.role);

  const followUpReturnQuery = new URLSearchParams();
  if (q) followUpReturnQuery.set("q", q);
  if (approvalFilter) followUpReturnQuery.set("approval", approvalFilter);
  if (periodFilter && periodFilter !== "all") followUpReturnQuery.set("period", periodFilter);
  const followUpReturnTo = `/documents/quotations${followUpReturnQuery.toString() ? `?${followUpReturnQuery.toString()}` : ""}`;
  const followUpContext = { returnTo: followUpReturnTo };

  // Period filter applied client-side (jobs are already fetched)
  const periodFilteredJobs = jobs.filter((j) => {
    if (periodFilter === "this_month") return j.updatedAt >= thisMonthStart;
    if (periodFilter === "last_month") return j.updatedAt >= lastMonthStart && j.updatedAt <= lastMonthEnd;
    return true;
  });

  // Sort: AWAITING_APPROVAL first, then by updatedAt desc
  const sorted = [...periodFilteredJobs].sort((a, b) => {
    const aAw = a.status === "AWAITING_APPROVAL" ? 0 : 1;
    const bAw = b.status === "AWAITING_APPROVAL" ? 0 : 1;
    if (aAw !== bAw) return aAw - bAw;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
  const nowMs = Date.now();

  // KPIs stay whole-dataset (computed from jobs/standaloneQuotations); paginate the
  // Repair Job Quotation Queue for display only.
  const pageView = paginationView(page, sorted.length);
  const pageRows = sorted.slice(pageView.skip, pageView.skip + pageView.take);
  const quotationsHref = pageHrefBuilder("/documents/quotations", {
    q: q ?? "",
    approval: approvalFilter ?? "",
    period: periodFilter !== "all" ? periodFilter : "",
  });

  const approvalBadgeFor = (job: (typeof sorted)[number]) =>
    job.clientApproved === true ? (
      <StatusBadge tone="success">Approved</StatusBadge>
    ) : job.clientApproved === false ? (
      <StatusBadge tone="danger">Declined</StatusBadge>
    ) : job.status === "AWAITING_APPROVAL" ? (
      <StatusBadge tone="warning" className="animate-pulse">Awaiting</StatusBadge>
    ) : null;

  return (
    <section className="space-y-4">

      {followupSentParam === "1" ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5">
          <p className="text-[13px] font-medium text-emerald-700 dark:text-emerald-400">
            Quote follow-up queued via outbox.
          </p>
        </div>
      ) : null}

      {followupBulkParam ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5">
          <p className="text-[13px] font-medium text-emerald-700 dark:text-emerald-400">
            Follow-ups queued for {followupBulkParam} quote{Number(followupBulkParam) === 1 ? "" : "s"}.
            {followupSkippedParam ? ` Skipped ${followupSkippedParam}.` : ""}
            {followupFailedParam && Number(followupFailedParam) > 0 ? ` Failed ${followupFailedParam}.` : ""}
          </p>
        </div>
      ) : null}

      {expiredDraftsParam ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5">
          <p className="text-[13px] font-medium text-emerald-700 dark:text-emerald-400">
            Expired {expiredDraftsParam} stale draft quotation{Number(expiredDraftsParam) === 1 ? "" : "s"}.
          </p>
        </div>
      ) : null}

      {followupErrorParam ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5">
          <p className="text-[13px] font-medium text-red-700 dark:text-red-400">
            {followupErrorParam === "forbidden"
              ? "You do not have permission to send quote follow-ups or expire drafts."
              : decodeURIComponent(followupErrorParam)}
          </p>
        </div>
      ) : null}

      {/* ── Mobile quick-gen explainer ── */}
      <div className="sm:hidden rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/6 px-4 py-3">
        <p className="text-[12px] font-semibold text-[var(--accent)] mb-1">Create a quotation</p>
        <p className="text-[13px] text-[var(--ink-muted)] leading-relaxed">
          Build a quotation for a client, lead, product sale, service package, or a repair job. Select products from inventory or add custom service lines.
        </p>
        <Link
          href="/sales/quotations/new"
          className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1.5 text-[12px] font-bold text-[var(--accent)]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          New quotation
        </Link>
      </div>

      {/* Header */}
      <div className="hidden sm:block">
        <PageHeader
          eyebrow="Documents"
          title={`Quotations · ${totalQuoteCount}`}
          actions={
            <>
              {pendingCount + standalonePendingCount > 0 && (
                <StatusBadge tone="warning">{pendingCount + standalonePendingCount} awaiting client</StatusBadge>
              )}
              {canSendQuoteFollowUps && followUpAwaitingCount > 0 ? (
                <QuoteFollowUpBulkButton count={followUpAwaitingCount} context={followUpContext} />
              ) : null}
              <Link href="/sales/quotations/new" className="btn-premium rounded-lg px-3 py-1.5 text-[12px]">
                + New Quote
              </Link>
            </>
          }
        />
      </div>

      {canExpireStaleDrafts && staleDraftCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-amber-600">Stale drafts</p>
            <p className="text-[13px] text-[var(--ink-muted)]">
              {staleDraftCount} draft quotation{staleDraftCount === 1 ? "" : "s"} past the expiry policy
            </p>
          </div>
          <ExpireStaleDraftsButton count={staleDraftCount} context={followUpContext} />
        </div>
      ) : null}

      {/* KPI strip */}
      <StatStrip
        variant="cards"
        columns={4}
        tiles={[
          { label: "Total Quotes", value: totalQuoteCount, sub: "repairs + sales" },
          { label: "Awaiting Client", value: pendingCount + standalonePendingCount, sub: "need decision", valueClass: pendingCount + standalonePendingCount > 0 ? "text-amber-600" : undefined },
          { label: "Approved", value: jobs.filter(j => j.clientApproved === true).length + standaloneQuotations.filter(quotation => quotation.status === "ACCEPTED").length, sub: "accepted", valueClass: "text-emerald-600" },
          { label: "Declined", value: jobs.filter(j => j.clientApproved === false).length + standaloneQuotations.filter(quotation => quotation.status === "REJECTED").length, sub: "rejected", valueClass: "text-red-500" },
        ]}
      />

      {/* Filters: period chips + search + approval */}
      <DocumentFilterBar
        basePath="/documents/quotations"
        q={q ?? ""}
        period={periodFilter || "all"}
        periodOptions={DOCUMENT_PERIOD_OPTIONS_SHORT}
        extraQuery={{ approval: approvalFilter ?? "" }}
        searchPlaceholder="Search quote #, client, job, product..."
      >
        <form method="GET" className="flex gap-2">
          <input type="hidden" name="period" value={periodFilter === "all" ? "" : periodFilter} />
          {q ? <input type="hidden" name="q" value={q} /> : null}
          <select
            name="approval"
            defaultValue={approvalFilter ?? ""}
            className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--accent)]/50"
          >
            <option value="">All quotes</option>
            <option value="pending">Awaiting approval</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
          </select>
          <button
            type="submit"
            className="h-8 rounded-lg border border-[var(--line)] px-3 text-[12px] font-medium hover:bg-[var(--panel-strong)]"
          >
            Filter
          </button>
        </form>
      </DocumentFilterBar>

      <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Client & Product Quotations</p>
            <p className="text-[13px] text-[var(--ink-muted)]">{standaloneQuotations.length} quotes not tied to repair jobs</p>
          </div>
          <Link href="/sales/quotations/new" className="rounded-md bg-[var(--gold)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--gold)] hover:bg-[var(--gold)]/25">
            New Quotation
          </Link>
        </div>
        <DataTable
          frameless
          rows={standaloneQuotations}
          getRowKey={(quotation) => quotation.id}
          empty="No client/product quotations yet. Create one from a client and inventory products without opening a repair job."
          columns={[
            {
              key: "quote",
              header: "Quote",
              cell: (quotation) => (
                <>
                  <Link href={`/sales/quotations/${quotation.id}`} className="font-mono text-xs font-bold text-[var(--accent)] hover:underline">{quotation.quoteNumber}</Link>
                  <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">{formatEATDate(quotation.createdAt)}</p>
                </>
              ),
            },
            {
              key: "recipient",
              header: "Client / Lead",
              cell: (quotation) => (
                <>
                  <p className="text-xs font-medium text-[var(--ink)]">{quotation.client?.fullName ?? quotation.lead?.fullName ?? "Client"}</p>
                  <p className="text-[12px] text-[var(--ink-muted)]">{quotation.client?.phone ?? quotation.lead?.phone ?? quotation.lead?.interest ?? "No contact captured"}</p>
                </>
              ),
            },
            {
              key: "status",
              header: "Status",
              cell: (quotation) => (
                <StatusBadge tone={toneFor(QUOTATION_STATUS_TONES, quotation.status)}>{quotation.status}</StatusBadge>
              ),
            },
            {
              key: "value",
              header: "Value",
              align: "right",
              className: "text-xs font-semibold tabular-nums text-[var(--ink)]",
              cell: (quotation) => formatMoney(quotation.totalAmount, quotation.currency),
            },
            {
              key: "lines",
              header: "Lines",
              align: "right",
              className: "text-xs text-[var(--ink-muted)]",
              cell: (quotation) => quotation._count.items,
            },
          ]}
          actions={(quotation) => (
            <>
              {canSendQuoteFollowUps && quotation.status === "SENT" ? (
                <QuoteFollowUpButton quotationId={quotation.id} context={followUpContext} compact />
              ) : null}
              <a href={`/api/quotations/${quotation.id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--accent)]">PDF</a>
              <Link href={`/sales/quotations/${quotation.id}`} className="btn-premium-secondary rounded-lg px-2.5 py-1.5 text-xs font-semibold">Open</Link>
            </>
          )}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Repair Job Quotation Queue</p>
          <p className="text-[13px] text-[var(--ink-muted)]">Job-based estimates remain available for repair workflows.</p>
        </div>
        <Link href="/jobs?status=DIAGNOSING,AWAITING_APPROVAL,IN_REPAIR" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">
          Eligible jobs
        </Link>
      </div>

      {/* Table */}
      <DataTable
        rows={pageRows}
        getRowKey={(job) => job.id}
        empty={
          q || approvalFilter
            ? "No quotes match your filter."
            : "No repair quote-ready jobs yet. Use New Quotation for client or product quotes."
        }
        columns={[
          {
            key: "job",
            header: "Job",
            cell: (job) => {
              const canGenerate = canGenerateQuotationForStatus(job.status);
              const quoteNumber = formatQuotationNumber(
                job.jobNumber,
                job.quotedAt ?? job.updatedAt,
                branding.quotePrefix,
                branding.quoteFormat,
                branding.sequencePadLength,
              );
              return (
                <>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="mono text-xs font-bold text-[var(--accent)] hover:underline"
                  >
                    {job.jobNumber}
                  </Link>
                  {canGenerate && (
                    <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">{quoteNumber}</p>
                  )}
                  {/* Mobile: show client + approval inline */}
                  <p className="mt-0.5 text-[12px] text-[var(--ink-muted)] sm:hidden">
                    {job.client.fullName}
                  </p>
                  <div className="mt-1 sm:hidden">{approvalBadgeFor(job)}</div>
                </>
              );
            },
          },
          {
            key: "client",
            header: "Client",
            headerClassName: "hidden sm:table-cell",
            className: "hidden sm:table-cell",
            cell: (job) => (
              <>
                <p className="text-xs font-medium text-[var(--ink)]">{job.client.fullName}</p>
                <p className="text-[12px] text-[var(--ink-muted)]">{job.client.phone}</p>
              </>
            ),
          },
          {
            key: "device",
            header: "Device",
            headerClassName: "hidden md:table-cell",
            className: "hidden md:table-cell",
            cell: (job) => (
              <p className="text-xs text-[var(--ink)]">
                {job.brand} {job.model}
              </p>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (job) => {
              const daysPending =
                job.status === "AWAITING_APPROVAL"
                  ? Math.floor((nowMs - job.updatedAt.getTime()) / 86400000)
                  : null;
              return (
                <div className="flex flex-col gap-1">
                  <JobStatusBadge status={normalizeJobStatus(job.status as never)} />
                  {approvalBadgeFor(job)}
                  {daysPending !== null && daysPending > 0 && (
                    <span
                      className={`text-[12px] font-medium ${daysPending >= 3 ? "text-red-400" : "text-amber-600"}`}
                    >
                      {daysPending}d pending
                    </span>
                  )}
                </div>
              );
            },
          },
          {
            key: "estimate",
            header: "Estimate",
            headerClassName: "hidden lg:table-cell",
            className: "hidden lg:table-cell",
            cell: (job) => {
              const estimate = getClientBill(job);
              return typeof estimate === "number" ? (
                <span className="text-xs font-semibold text-[var(--ink)]">
                  {formatMoney(estimate, currency)}
                </span>
              ) : (
                <span className="text-xs text-[var(--ink-muted)]">Not set</span>
              );
            },
          },
          {
            key: "sent",
            header: "Sent",
            headerClassName: "hidden lg:table-cell",
            className: "hidden lg:table-cell text-[12px] text-[var(--ink-muted)]",
            cell: (job) =>
              job.quotedAt ? (
                <span className="text-emerald-600">✓ {formatEATDate(job.quotedAt)}</span>
              ) : (
                <span className="italic">Not sent</span>
              ),
          },
        ]}
        actions={(job) => {
          const issuedAt = job.quotedAt ?? job.updatedAt;
          const quoteNumber = formatQuotationNumber(
            job.jobNumber,
            issuedAt,
            branding.quotePrefix,
            branding.quoteFormat,
            branding.sequencePadLength,
          );
          const canGenerate = canGenerateQuotationForStatus(job.status);
          const persistedQuotation = job.quotations[0] ?? null;
          const estimate = getClientBill(job);
          const pdfUrl = `${appUrl}/api/jobs/${job.id}/quotation`;
          const pdfHref = `/api/jobs/${job.id}/quotation`;
          const clientPhone = (job.client.phone ?? "").replace(/\D/g, "");
          const waPhone = clientPhone.startsWith("0")
            ? "256" + clientPhone.slice(1)
            : clientPhone;
          const waQuoteText = encodeURIComponent(
            `Hi ${job.client.fullName}, your repair quote is ready.\n\nQuote #: ${quoteNumber}\nDevice: ${job.brand} ${job.model}\nEstimate: ${typeof estimate === "number" ? formatMoney(estimate, currency) : "TBD"}\n\nReply YES to approve and we'll begin the repair immediately.`,
          );
          const canOpenPersistedQuote = Boolean(persistedQuotation);
          const canEditDraftQuote = Boolean(
            persistedQuotation &&
            persistedQuotation.status === "DRAFT" &&
            !persistedQuotation.convertedToInvoiceId &&
            can.createQuotations(user),
          );
          const canSendPersistedQuote = Boolean(
            persistedQuotation &&
            persistedQuotation.status === "DRAFT" &&
            can.createQuotations(user),
          );
          const canAcceptPersistedQuote = Boolean(
            persistedQuotation &&
            persistedQuotation.status === "SENT" &&
            can.approveQuotations(user),
          );
          const canRejectPersistedQuote = Boolean(
            persistedQuotation &&
            persistedQuotation.status === "SENT" &&
            can.createQuotations(user),
          );
          const canConvertPersistedQuote = Boolean(
            persistedQuotation &&
            persistedQuotation.status === "ACCEPTED" &&
            !persistedQuotation.convertedToInvoiceId &&
            (can.createInvoices(user) || can.approveInvoices(user)),
          );

          return (
            <>
                        {canSendQuoteFollowUps &&
                        job.status === "AWAITING_APPROVAL" &&
                        job.clientApproved === null ? (
                          <QuoteFollowUpButton jobId={job.id} context={followUpContext} compact />
                        ) : null}
                        {canGenerate ? (
                          <>
                            {/* Primary: PDF */}
                            <a
                              href={pdfHref}
                              target="_blank"
                              rel="noreferrer"
                              title="Open quotation PDF"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            </a>

                            {/* Overflow: share, mark sent, convert */}
                            <RowActionsMenu label="Quotation actions">
                              <div className="py-1 text-left">
                                {canOpenPersistedQuote ? (
                                  <MenuActionLink href={`/sales/quotations/${persistedQuotation!.id}`} icon="open">
                                    Open Quotation
                                  </MenuActionLink>
                                ) : null}
                                <MenuActionLink href={`/jobs/${job.id}`} icon="job">
                                  Open Job
                                </MenuActionLink>
                                <MenuActionLink href={pdfHref} external icon="quote" tone="accent">
                                  Download Quotation PDF
                                </MenuActionLink>
                              </div>
                              <MenuSection label="Share" />
                              <form action={sendQuotationWhatsAppAction}>
                                <input type="hidden" name="jobId" value={job.id} />
                                <MenuActionButton icon="whatsapp" tone="success">
                                  Send via WhatsApp
                                </MenuActionButton>
                              </form>
                              {job.client.email ? (
                                <form action={sendQuotationEmailAction}>
                                  <input type="hidden" name="jobId" value={job.id} />
                                  <input type="hidden" name="quoteNumber" value={persistedQuotation?.quoteNumber ?? quoteNumber} />
                                  <MenuActionButton icon="open">
                                    Email quotation
                                  </MenuActionButton>
                                </form>
                              ) : (
                                <span className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[var(--ink-muted)]">Email unavailable</span>
                              )}
                              <MenuActionLink href={`https://wa.me/${waPhone}?text=${waQuoteText}`} external icon="whatsapp" tone="success">
                                Open WhatsApp Link
                              </MenuActionLink>
                              <div className="px-3 py-1">
                                <CopyButton
                                  text={pdfUrl}
                                  label="Copy PDF link"
                                  title="Copy quotation PDF link"
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
                                />
                              </div>
                              {canEditDraftQuote ? (
                                <>
                                  <MenuSection label="Edit Draft" />
                                  <form action={updateQuotationDetailsAction} className="space-y-2 p-3">
                                    <input type="hidden" name="quotationId" value={persistedQuotation!.id} />
                                    <input
                                      type="date"
                                      name="validUntil"
                                      defaultValue={persistedQuotation!.validUntil ? persistedQuotation!.validUntil.toISOString().slice(0, 10) : ""}
                                      className="w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none"
                                    />
                                    <textarea
                                      name="notes"
                                      defaultValue={persistedQuotation!.notes ?? ""}
                                      placeholder="Notes"
                                      className="min-h-14 w-full rounded-md border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-xs outline-none"
                                    />
                                    <MenuActionButton icon="save" tone="accent">
                                      Save Draft
                                    </MenuActionButton>
                                  </form>
                                </>
                              ) : null}
                              {(!job.quotedAt || canSendPersistedQuote || canAcceptPersistedQuote || canRejectPersistedQuote) && (
                                <>
                                  <MenuSection label="Status" />
                                  {!job.quotedAt ? (
                                    <form action={markSent} className="px-3 py-1.5">
                                      <input type="hidden" name="jobId" value={job.id} />
                                      <MenuActionButton icon="save" tone="accent">
                                        Mark as sent
                                      </MenuActionButton>
                                    </form>
                                  ) : null}
                                  {canSendPersistedQuote ? (
                                    <form action={updateQuotationStatusAction} className="px-3 py-1.5">
                                      <input type="hidden" name="quotationId" value={persistedQuotation!.id} />
                                      <input type="hidden" name="status" value="SENT" />
                                      <MenuActionButton icon="save" tone="accent">
                                        Send to Client
                                      </MenuActionButton>
                                    </form>
                                  ) : null}
                                  {canAcceptPersistedQuote ? (
                                    <form action={updateQuotationStatusAction} className="px-3 py-1.5">
                                      <input type="hidden" name="quotationId" value={persistedQuotation!.id} />
                                      <input type="hidden" name="status" value="ACCEPTED" />
                                      <MenuActionButton icon="save" tone="success">
                                        Mark Accepted
                                      </MenuActionButton>
                                    </form>
                                  ) : null}
                                  {canRejectPersistedQuote ? (
                                    <form action={updateQuotationStatusAction} className="px-3 py-1.5">
                                      <input type="hidden" name="quotationId" value={persistedQuotation!.id} />
                                      <input type="hidden" name="status" value="REJECTED" />
                                      <MenuActionButton icon="close" tone="danger">
                                        Mark Rejected
                                      </MenuActionButton>
                                    </form>
                                  ) : null}
                                </>
                              )}
                              <MenuSection label="Convert" />
                              {canConvertPersistedQuote ? (
                                <form action={convertQuotationToInvoiceAction} className="px-3 py-1.5">
                                  <input type="hidden" name="quotationId" value={persistedQuotation!.id} />
                                  <MenuActionButton icon="invoice" tone="accent">
                                    Convert to Invoice
                                  </MenuActionButton>
                                </form>
                              ) : persistedQuotation?.convertedToInvoiceId ? (
                                <MenuActionLink href="/documents/invoices" icon="invoice" tone="success">
                                  Invoice Created
                                </MenuActionLink>
                              ) : (
                                <span className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[var(--ink-muted)]">
                                  Accept quotation before converting
                                </span>
                              )}
                              {canEditDraftQuote ? (
                                <>
                                  <MenuSection label="Delete" />
                                  <form action={deleteQuotationRowAction} className="px-3 py-1.5">
                                    <input type="hidden" name="quotationId" value={persistedQuotation!.id} />
                                    <ConfirmSubmitButton
                                      message={`Delete draft quotation ${persistedQuotation!.quoteNumber}? This cannot be undone.`}
                                      confirmLabel="Delete"
                                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-500/10 hover:text-red-700"
                                    >
                                      Delete Draft
                                    </ConfirmSubmitButton>
                                  </form>
                                </>
                              ) : null}
                            </RowActionsMenu>
                          </>
                        ) : (
                          <span className="text-[13px] text-[var(--ink-muted)]">
                            {["RECEIVED"].includes(job.status) ? "Needs diagnosis" : "No estimate yet"}
                          </span>
                        )}

                        {/* Always: view job */}
                        <Link
                          href={`/jobs/${job.id}`}
                          title="Open job"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        </Link>
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
        unit="quotations"
        hrefForPage={quotationsHref}
      />
    </section>
  );
}
