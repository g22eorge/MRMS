import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma, LeadStatus, LeadSource } from "@prisma/client";
import { getCurrentUserRole } from "@/lib/session";

import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatEATDate } from "@/lib/date-eat";
import { formatMoney, formatMoneyCompact, getAppCurrency } from "@/lib/currency";
import { RowActionsMenu, MenuActionLink, MenuActionButton, MenuSection } from "@/components/shared/RowActionsMenu";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { Button, buttonClasses } from "@/components/ui/Button";
import { DisclosureProvider, DisclosureTrigger, DisclosurePanel, DisclosureClose } from "@/components/shared/DisclosureRegion";
import { PAGE_SIZE, parsePage, parsePageSize, paginationView, pageHrefBuilder, sizeHrefBuilder } from "@/lib/pagination";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { createLead, advanceLeadStageAction } from "./actions";
import { clientDisplayName } from "@/lib/client-name";

import { SubmitButton } from "@/components/ui/SubmitButton";
const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL_SENT: "Proposal Sent",
  WON: "Won",
  LOST: "Lost",
  STALE: "Stale",
};

/** Shorter labels for the tight mobile chip grid. */
const LEAD_STATUS_SHORT: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL_SENT: "Proposal",
  WON: "Won",
  LOST: "Lost",
  STALE: "Stale",
};

const LEAD_STATUS_TONES: Record<string, BadgeTone> = {
  NEW:           "info",
  CONTACTED:     "purple",
  QUALIFIED:     "warning",
  PROPOSAL_SENT: "orange",
  WON:           "success",
  LOST:          "danger",
  STALE:         "neutral",
};

/** Avatar tint per stage — mirrors the clients list tile. */
const LEAD_TILE_TONES: Record<string, string> = {
  NEW:           "bg-sky-500/15 text-sky-600",
  CONTACTED:     "bg-slate-500/15 text-slate-600",
  QUALIFIED:     "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  PROPOSAL_SENT: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  WON:           "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  LOST:          "bg-red-500/15 text-red-600",
  STALE:         "bg-[var(--panel-strong)] text-[var(--ink-muted)]",
};

const QUOTATION_STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT:    "neutral",
  SENT:     "info",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED:  "slate",
};

/** Weighted-forecast probability per active stage. */
const STAGE_PROBABILITY: Record<string, number> = {
  NEW: 0.10, CONTACTED: 0.25, QUALIFIED: 0.40, PROPOSAL_SENT: 0.65, WON: 1.0,
};

const NEXT_STAGE: Partial<Record<LeadStatus, LeadStatus>> = {
  NEW: "CONTACTED", CONTACTED: "QUALIFIED",
  QUALIFIED: "PROPOSAL_SENT", PROPOSAL_SENT: "WON",
};

const LOST_REASONS = ["Price too high", "Chose competitor", "No budget", "Bad timing", "Unreachable", "Other"];

const TERMINAL_STATUSES: LeadStatus[] = ["WON", "LOST", "STALE"];

type SearchParams = {
  tab?: string;
  status?: string;
  overdue?: string;
  q?: string;
  createError?: string;
  page?: string;
  size?: string;
};

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user } = await getCurrentUserRole();

  if (!can.viewAllSales(user) && !can.createLeads(user)) {
    redirect("/dashboard");
  }
  if (!user.orgId) {
    redirect("/dashboard");
  }

  const filters = await searchParams;
  const activeTab    = filters.tab === "quotations" ? "quotations" : "leads";
  const overdueOnly  = filters.overdue === "1";
  const statusFilter = overdueOnly ? undefined : (filters.status as LeadStatus | undefined);
  const searchQ      = (filters.q ?? "").trim();
  const page         = parsePage(filters.page);
  const pageSize     = parsePageSize(filters.size);
  const currency     = getAppCurrency();

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const onlyOwn = !can.viewAllSales(user) && can.createLeads(user);
  const ownLeadAccess: Prisma.LeadWhereInput = onlyOwn
    ? { OR: [{ assignedToId: user.id }, { createdById: user.id }] }
    : {};

  const quotationWhere: Prisma.QuotationWhereInput = {
    orgId: user.orgId,
    ...(!can.viewAllSales(user) ? { createdById: user.id } : {}),
    ...(searchQ
      ? {
          OR: [
            { quoteNumber: { contains: searchQ } },
            { lead:   { fullName: { contains: searchQ } } },
            { client: { OR: [{ fullName: { contains: searchQ } }, { organization: { contains: searchQ } }] } },
          ],
        }
      : {}),
  };

  const overdueLeadFilter: Prisma.LeadWhereInput = {
    status: { notIn: TERMINAL_STATUSES },
    followUpAt: { lte: now },
  };

  const leadsWhere: Prisma.LeadWhereInput = {
    orgId: user.orgId,
    ...ownLeadAccess,
    ...(overdueOnly ? overdueLeadFilter : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(searchQ
      ? {
          OR: [
            { fullName: { contains: searchQ } },
            { phone:    { contains: searchQ } },
            { organization: { contains: searchQ } },
          ],
        }
      : {}),
  };

  const activeLeadsWhere: Prisma.LeadWhereInput = {
    orgId: user.orgId,
    ...ownLeadAccess,
    status: { notIn: TERMINAL_STATUSES },
  };

  const [
    leads,
    quotations,
    leadCounts,
    pipelineStats,
    stageValueGroups,
    wonThisMonth,
    quotationStats,
    acceptedQuoteStats,
    followupsDue,
    leadsTotal,
    quotationsTotal,
  ] = await Promise.all([
    activeTab === "leads"
      ? prisma.lead.findMany({
          where: leadsWhere,
          include: {
            assignedTo: { select: { id: true, name: true } },
          },
          orderBy: { updatedAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }).catch(() => [])
      : Promise.resolve([]),

    activeTab === "quotations"
      ? prisma.quotation.findMany({
          where: quotationWhere,
          include: {
            lead:   { select: { id: true, fullName: true } },
            client: { select: { id: true, fullName: true, organization: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }).catch(() => [])
      : Promise.resolve([]),

    prisma.lead
      .groupBy({
        by: ["status"],
        where: { orgId: user.orgId, ...ownLeadAccess },
        _count: true,
      })
      .catch(() => []),

    // Pipeline value — active leads only
    prisma.lead.aggregate({
      where: { ...activeLeadsWhere, estimatedValue: { not: null } },
      _sum:   { estimatedValue: true },
      _count: true,
    }).catch(() => ({ _sum: { estimatedValue: 0 }, _count: 0 })),

    // Value per stage — feeds the weighted forecast
    prisma.lead.groupBy({
      by: ["status"],
      where: { orgId: user.orgId, ...ownLeadAccess, estimatedValue: { not: null } },
      _sum: { estimatedValue: true },
    }).catch(() => []),

    prisma.lead.count({
      where: {
        orgId: user.orgId,
        ...ownLeadAccess,
        status: "WON",
        updatedAt: { gte: thisMonthStart },
      },
    }).catch(() => 0),

    prisma.quotation.aggregate({
      where: { orgId: user.orgId, ...(!can.viewAllSales(user) ? { createdById: user.id } : {}) },
      _sum:   { totalAmount: true },
      _count: true,
    }).catch(() => ({ _sum: { totalAmount: 0 }, _count: 0 })),

    prisma.quotation.aggregate({
      where: {
        orgId: user.orgId,
        ...(!can.viewAllSales(user) ? { createdById: user.id } : {}),
        status: "ACCEPTED",
      },
      _sum:   { totalAmount: true },
      _count: true,
    }).catch(() => ({ _sum: { totalAmount: 0 }, _count: 0 })),

    // Follow-ups overdue or due today
    prisma.lead.count({
      where: { orgId: user.orgId, ...ownLeadAccess, ...overdueLeadFilter },
    }).catch(() => 0),

    activeTab === "leads"
      ? prisma.lead.count({ where: leadsWhere }).catch(() => 0)
      : Promise.resolve(0),

    activeTab === "quotations"
      ? prisma.quotation.count({ where: quotationWhere }).catch(() => 0)
      : Promise.resolve(0),
  ]);

  // ── KPIs ────────────────────────────────────────────────────────────────
  const statusCounts: Partial<Record<LeadStatus, number>> = {};
  for (const row of leadCounts as Array<{ status: LeadStatus; _count: number }>) {
    statusCounts[row.status] = row._count;
  }
  const totalLeads = Object.values(statusCounts).reduce((a, b) => a + (b ?? 0), 0);
  const conversionRate = totalLeads > 0 ? Math.round(((statusCounts["WON"] ?? 0) / totalLeads) * 100) : 0;

  const pipelineValue  = pipelineStats._sum.estimatedValue ?? 0;
  const activePipeline = (pipelineStats as { _count: number })._count;
  const quoteCount     = (quotationStats as { _count: number })._count;
  const quoteTotal     = quotationStats._sum.totalAmount ?? 0;
  const acceptedTotal  = acceptedQuoteStats._sum.totalAmount ?? 0;
  const acceptanceRate = quoteCount > 0
    ? Math.round(((acceptedQuoteStats as { _count: number })._count / quoteCount) * 100)
    : 0;

  let forecastedRevenue = 0;
  for (const row of stageValueGroups as Array<{ status: string; _sum: { estimatedValue: number | null } }>) {
    forecastedRevenue += (row._sum.estimatedValue ?? 0) * (STAGE_PROBABILITY[row.status] ?? 0);
  }

  const listTotal = activeTab === "leads" ? leadsTotal : quotationsTotal;
  const listUnit = activeTab === "leads" ? "leads" : "quotations";
  const pageView = paginationView(page, listTotal, pageSize);
  const listFilters = {
    tab: activeTab,
    status: statusFilter ?? "",
    overdue: overdueOnly ? "1" : "",
    q: searchQ,
    size: pageSize !== PAGE_SIZE ? pageSize : "",
  };
  const listHref = pageHrefBuilder("/sales", listFilters);
  const listSizeHref = sizeHrefBuilder("/sales", listFilters);

  const hasLeadFilters = Boolean(searchQ) || Boolean(statusFilter) || overdueOnly;

  // Org users for the assign-to dropdown
  const orgUsers = can.viewAllSales(user)
    ? await prisma.user.findMany({
        where: { orgId: user.orgId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }).catch(() => [])
    : [];

  async function createLeadAction(formData: FormData) {
    "use server";
    const rawSource = String(formData.get("source") ?? "WALK_IN");
    const validSources: LeadSource[] = ["WALK_IN", "REFERRAL", "PHONE", "SOCIAL_MEDIA", "WEBSITE", "OTHER"];
    const source = validSources.includes(rawSource as LeadSource) ? (rawSource as LeadSource) : "WALK_IN";
    const followUpRaw = String(formData.get("followUpAt") ?? "");
    try {
      await createLead({
        fullName:       String(formData.get("fullName") ?? ""),
        phone:          String(formData.get("phone") ?? ""),
        email:          String(formData.get("email") ?? "") || undefined,
        organization:   String(formData.get("organization") ?? "") || undefined,
        interest:       String(formData.get("interest") ?? "") || undefined,
        source,
        notes:          String(formData.get("notes") ?? "") || undefined,
        estimatedValue: formData.get("estimatedValue") ? Number(formData.get("estimatedValue")) : undefined,
        assignedToId:   String(formData.get("assignedToId") ?? "") || undefined,
        followUpAt:     followUpRaw || undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create lead";
      redirect(`/sales?tab=leads&createError=${encodeURIComponent(msg)}&failed=${encodeURIComponent(msg)}`);
    }
    // Say so. A save that repaints the page in silence is indistinguishable
    // from one that was dropped, which is why people tap the button twice.
    redirect(`/sales?tab=leads&saved=${encodeURIComponent("Lead created")}`);
  }

  // ── Hrefs ───────────────────────────────────────────────────────────────
  function href(next: { tab?: "leads" | "quotations"; status?: LeadStatus | null; overdue?: boolean; q?: string }) {
    const tab = next.tab ?? activeTab;
    const status = next.status === undefined ? statusFilter : next.status;
    const overdue = next.overdue === undefined ? overdueOnly : next.overdue;
    const q = next.q === undefined ? searchQ : next.q;
    const params = new URLSearchParams();
    if (tab === "quotations") params.set("tab", "quotations");
    if (tab === "leads") {
      if (overdue) params.set("overdue", "1");
      else if (status) params.set("status", status);
    }
    if (q) params.set("q", q);
    const query = params.toString();
    return query ? `/sales?${query}` : "/sales";
  }

  const compactAmount = (value: number) => formatMoneyCompact(value, currency).replace(`${currency} `, "");
  const field =
    "w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none transition placeholder:text-[var(--ink-muted)]/60 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15";

  const statusChips: Array<{ key: string; short: string; long: string; count: number; url: string; active: boolean }> = [
    {
      key: "all",
      short: "All",
      long: `${totalLeads} all`,
      count: totalLeads,
      url: href({ tab: "leads", status: null, overdue: false }),
      active: !statusFilter && !overdueOnly,
    },
    {
      key: "overdue",
      short: "Due",
      long: `${followupsDue} due`,
      count: followupsDue,
      url: href({ tab: "leads", status: null, overdue: true }),
      active: overdueOnly,
    },
    ...(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => ({
      key: s,
      short: LEAD_STATUS_SHORT[s],
      long: `${statusCounts[s] ?? 0} ${LEAD_STATUS_LABELS[s].toLowerCase()}`,
      count: statusCounts[s] ?? 0,
      url: href({ tab: "leads", status: s, overdue: false }),
      active: statusFilter === s,
    })),
  ];

  // Leads open the on-page create form via client state; quotations still route
  // to a dedicated new-quotation page.
  const canNewLead = activeTab === "leads" && can.createLeads(user);
  const newQuotationUrl =
    activeTab === "quotations" && can.createQuotations(user) ? "/sales/quotations/new" : null;

  const tabs = [
    { key: "leads" as const, label: "Leads", count: totalLeads },
    ...(can.createQuotations(user) ? [{ key: "quotations" as const, label: "Quotations", count: quoteCount }] : []),
  ];

  const leadsShownValue = leads.reduce((s, l) => s + (l.estimatedValue ?? 0), 0);

  // Named so the quotation actions are reachable in the table AND the mobile card.
  const renderQuotationActions = (q: (typeof quotations)[number]) => (
    <RowActionsMenu label={`Quotation ${q.quoteNumber}`} size="compact">
      <MenuActionLink href={`/sales/quotations/${q.id}`} icon="open">Open quotation</MenuActionLink>
      <MenuActionLink href={`/api/quotations/${q.id}`} icon="download">Download PDF</MenuActionLink>
    </RowActionsMenu>
  );

  return (
    <DisclosureProvider defaultOpen={Boolean(filters.createError)}>
    <ListPageLayout
      headerNode={
        <>
          {/* ══ MOBILE HEADER ══ */}
          <div className="space-y-3 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[1.375rem] font-black text-[var(--ink)]">Sales</h1>
                <p className="text-[0.8125rem] text-[var(--ink-muted)]">
                  {totalLeads} leads · {quoteCount} quotations · {currency}
                </p>
              </div>
              {canNewLead ? (
                <DisclosureTrigger
                  className={buttonClasses("primary", "md", { className: "rounded-xl font-bold" })}
                  label="+ New Lead"
                  openLabel="Close"
                />
              ) : newQuotationUrl ? (
                <Button href={newQuotationUrl} size="md" className="rounded-xl font-bold">+ New Quotation</Button>
              ) : null}
            </div>

            {/* Compact 4-number stat row */}
            <div className="grid grid-cols-4 divide-x divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)]">
              {([
                { label: "Pipeline", value: compactAmount(pipelineValue) },
                { label: "Won", value: String(wonThisMonth) },
                { label: "Forecast", value: compactAmount(forecastedRevenue) },
                { label: "Due", value: String(followupsDue) },
              ] as const).map(({ label, value }) => (
                <div key={label} className="min-w-0 px-1.5 py-3 text-center">
                  <p className="truncate text-[1.0625rem] font-black leading-none tabular-nums text-[var(--ink)]">{value}</p>
                  <p className="mt-1 text-[0.6875rem] text-[var(--ink-muted)]">{label}</p>
                </div>
              ))}
            </div>

            {/* Tab switch */}
            {tabs.length > 1 ? (
              <div className="grid grid-cols-2 gap-1.5">
                {tabs.map((t) => (
                  <Link
                    key={t.key}
                    href={href({ tab: t.key, status: null, overdue: false })}
                    className={`rounded-full py-1.5 text-center text-[0.75rem] font-bold transition ${
                      activeTab === t.key
                        ? "bg-[var(--accent)] text-black"
                        : "border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]"
                    }`}
                  >
                    {t.label} {t.count}
                  </Link>
                ))}
              </div>
            ) : null}

            {/* Stage chips (leads only) */}
            {activeTab === "leads" ? (
              <div className="grid grid-cols-3 gap-1.5">
                {statusChips.map(({ key, short, count, url, active }) => (
                  <Link
                    key={key}
                    href={url}
                    className={`rounded-full py-1.5 text-center text-[0.75rem] font-bold transition ${
                      active
                        ? "bg-[var(--accent)] text-black"
                        : "border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]"
                    }`}
                  >
                    {short}{count > 0 && !active ? ` ${count}` : ""}
                  </Link>
                ))}
              </div>
            ) : null}

            {/* Search */}
            <form method="GET">
              {activeTab === "quotations" ? <input type="hidden" name="tab" value="quotations" /> : null}
              {overdueOnly ? <input type="hidden" name="overdue" value="1" /> : null}
              {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
              <div className="relative">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]/50" aria-hidden>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  name="q"
                  defaultValue={searchQ}
                  placeholder={activeTab === "leads" ? "Name, phone or organization..." : "Quote number or name..."}
                  className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] pl-9 pr-4 text-[0.8125rem] outline-none placeholder:text-[var(--ink-muted)]/50 focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/14"
                />
                {searchQ ? (
                  <Link href={href({ q: "" })} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]/50">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </Link>
                ) : null}
              </div>
            </form>
          </div>

          {/* ══ DESKTOP HEADER ══ */}
          <div className="hidden lg:block">
            <PageHeader
              eyebrow="CRM"
              title="Sales"
              description="Leads pipeline and quotations"
              actions={
                canNewLead ? (
                  <DisclosureTrigger
                    className={buttonClasses("primary", "sm", { className: "px-4 font-bold" })}
                    label="+ New Lead"
                    openLabel="Close"
                  />
                ) : newQuotationUrl ? (
                  <Button href={newQuotationUrl} size="sm" className="px-4 font-bold">+ New Quotation</Button>
                ) : undefined
              }
            />
          </div>
        </>
      }
    >
      {/* ══ DESKTOP: KPI cards ══ */}
      <StatCards
        columns={4}
        cards={[
          {
            key: "pipeline",
            label: "Active pipeline",
            value: formatMoneyCompact(pipelineValue, currency),
            sub: `${activePipeline} open lead${activePipeline !== 1 ? "s" : ""}`,
            muted: pipelineValue === 0,
          },
          {
            key: "won",
            label: "Won this month",
            value: wonThisMonth,
            sub: `${conversionRate}% conversion`,
            tone: "good",
            muted: wonThisMonth === 0,
          },
          {
            key: "forecast",
            label: "Weighted forecast",
            value: formatMoneyCompact(forecastedRevenue, currency),
            sub: "stage-weighted pipeline",
            tone: "accent",
            muted: forecastedRevenue === 0,
          },
          {
            key: "followups",
            label: "Follow-ups due",
            value: followupsDue,
            sub: followupsDue > 0 ? "click to filter" : "all clear",
            tone: "warn",
            muted: followupsDue === 0,
            active: overdueOnly,
            href: href({ tab: "leads", status: null, overdue: true }),
          },
        ]}
      />

      {/* ══ DESKTOP: Tabs + primary action ══ */}
      {tabs.length > 1 ? (
        <div className="dc-card hidden flex-wrap items-center gap-2 px-4 py-3 lg:flex">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={href({ tab: t.key, status: null, overdue: false })}
              className={`rounded-full border px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
                activeTab === t.key
                  ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                  : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] hover:border-[var(--accent)]/40"
              }`}
            >
              {t.label} {t.count}
            </Link>
          ))}
          {activeTab === "quotations" && quoteCount > 0 ? (
            <p className="ml-auto text-[0.75rem] text-[var(--ink-muted)]">
              {formatMoneyCompact(quoteTotal, currency)} quoted ·{" "}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatMoneyCompact(acceptedTotal, currency)} accepted</span> ({acceptanceRate}%)
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ══ DESKTOP: Stage chips + search ══ */}
      <div className="dc-card hidden lg:block">
        {activeTab === "leads" ? (
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[var(--line)] px-3 py-2 [scrollbar-width:none]">
            {statusChips.map(({ key, short, count, url, active }) => (
              <Link
                key={key}
                href={url}
                className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-[0.75rem] font-semibold transition-colors ${
                  active
                    ? "bg-[var(--accent)] text-black"
                    : "border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] hover:border-[var(--accent)]/40"
                }`}
              >
                {short} {count}
              </Link>
            ))}
          </div>
        ) : null}
        <form className="flex items-center gap-2 p-3">
          {activeTab === "quotations" ? <input type="hidden" name="tab" value="quotations" /> : null}
          {overdueOnly ? <input type="hidden" name="overdue" value="1" /> : null}
          {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
          <input
            name="q"
            defaultValue={searchQ}
            aria-label={activeTab === "leads" ? "Search leads" : "Search quotations"}
            placeholder={activeTab === "leads" ? "Search by name, phone or organization..." : "Search by quote number or name..."}
            className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-sm outline-none transition placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15"
          />
          <SubmitButton variant="secondary" size="sm">Search</SubmitButton>
          {(activeTab === "leads" ? hasLeadFilters : Boolean(searchQ)) ? (
            <Link href={href({ status: null, overdue: false, q: "" })} className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.75rem] text-[var(--ink-muted)]">Reset</Link>
          ) : null}
        </form>
      </div>

      {/* ── New lead form ── */}
      {activeTab === "leads" && can.createLeads(user) ? (
        <DisclosurePanel>
        <div className="dc-card overflow-hidden">
          <div className="border-b border-[var(--line)] px-4 py-2.5">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">New Lead</p>
          </div>
          <form action={createLeadAction} noValidate className="p-3">
            {filters.createError ? (
              <p className="mb-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                {filters.createError}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <input name="fullName" required placeholder="Full name *" className={field} />
              <input name="phone" required placeholder="Phone *" className={field} />
              <input name="email" placeholder="Email" className={field} />
              <input name="organization" placeholder="Organization" className={field} />
              <input name="interest" placeholder="Interest / product" className={field} />
              <input name="estimatedValue" type="number" placeholder={`Est. value (${currency})`} className={field} />
              <select name="source" aria-label="Source" className={field}>
                <option value="WALK_IN">Walk-in</option>
                <option value="REFERRAL">Referral</option>
                <option value="PHONE">Phone</option>
                <option value="SOCIAL_MEDIA">Social Media</option>
                <option value="WEBSITE">Website</option>
                <option value="OTHER">Other</option>
              </select>
              {orgUsers.length > 0 ? (
                <select name="assignedToId" aria-label="Assign to" className={field}>
                  <option value="">Assign to...</option>
                  {orgUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              ) : null}
              <input name="followUpAt" type="date" title="Follow-up date" aria-label="Follow-up date" className={field} />
              <textarea name="notes" placeholder="Notes" rows={2} className={`${field} sm:col-span-2 lg:col-span-3`} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <SubmitButton size="sm" className="px-4 font-bold" pendingLabel="Creating…">Create Lead</SubmitButton>
              <DisclosureClose className="text-xs font-medium text-[var(--ink-muted)] underline-offset-2 hover:underline">Cancel</DisclosureClose>
            </div>
          </form>
        </div>
        </DisclosurePanel>
      ) : null}

      {/* ── Leads ── */}
      {activeTab === "leads" ? (
        leads.length === 0 ? (
          <div className="dc-card flex flex-col items-center gap-2 px-6 py-14 text-center">
            <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10 opacity-20" aria-hidden="true">
              <circle cx="20" cy="14" r="7" stroke="currentColor" strokeWidth="2"/>
              <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p className="text-sm font-medium text-[var(--ink-muted)]">No leads match this view</p>
            {hasLeadFilters ? (
              <Link href={href({ status: null, overdue: false, q: "" })} className="text-xs text-[var(--accent)] hover:underline">Clear filters</Link>
            ) : null}
          </div>
        ) : (
          <div className="dc-card overflow-hidden">
            <DataTable
              frameless
              rows={leads}
              getRowKey={(lead) => lead.id}
              renderMobileCard={(lead) => {
                const isOverdue = lead.followUpAt != null && lead.followUpAt <= now && !TERMINAL_STATUSES.includes(lead.status);
                return (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Link href={`/sales/leads/${lead.id}`} className="shrink-0">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl font-black ${LEAD_TILE_TONES[lead.status] ?? LEAD_TILE_TONES.STALE}`}>
                        {lead.fullName[0]?.toUpperCase() ?? "?"}
                      </div>
                    </Link>
                    <Link href={`/sales/leads/${lead.id}`} className="min-w-0 flex-1 active:opacity-70">
                      <p className="truncate font-bold text-[var(--ink)]">{lead.fullName}</p>
                      <p className="mt-0.5 truncate text-[var(--ink-muted)]">
                        {lead.phone}
                        {lead.organization ? <> · {lead.organization}</> : null}
                        {lead.assignedTo ? <> · {lead.assignedTo.name}</> : null}
                      </p>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <div className="flex flex-col items-end gap-1">
                        {lead.estimatedValue != null ? (
                          <p className="font-black tabular-nums text-[var(--ink)]">{formatMoneyCompact(lead.estimatedValue, currency)}</p>
                        ) : null}
                        {isOverdue ? (
                          <span className="text-[0.75rem] font-semibold text-amber-600 dark:text-amber-400">
                            {Math.floor((now.getTime() - new Date(lead.followUpAt!).getTime()) / 86400000)}d overdue
                          </span>
                        ) : (
                          <StatusBadge tone={toneFor(LEAD_STATUS_TONES, lead.status)}>{LEAD_STATUS_LABELS[lead.status]}</StatusBadge>
                        )}
                      </div>
                      {!TERMINAL_STATUSES.includes(lead.status) ? (
                        <RowActionsMenu label={`Lead actions for ${lead.fullName}`} size="compact">
                          <div className="py-1 text-left">
                            <MenuActionLink href={`/sales/leads/${lead.id}`} icon="open">Open Lead</MenuActionLink>
                            {NEXT_STAGE[lead.status as LeadStatus] ? (
                              <form action={advanceLeadStageAction}>
                                <input type="hidden" name="leadId" value={lead.id} />
                                <input type="hidden" name="newStatus" value={NEXT_STAGE[lead.status as LeadStatus]!} />
                                <MenuActionButton icon="save" tone="accent">
                                  Advance to {LEAD_STATUS_LABELS[NEXT_STAGE[lead.status as LeadStatus]!]}
                                </MenuActionButton>
                              </form>
                            ) : null}
                          </div>
                          <MenuSection label="Mark Lost" />
                          <div className="w-56 p-3 pt-2 text-left">
                            <form action={advanceLeadStageAction} className="space-y-1.5">
                              <input type="hidden" name="leadId" value={lead.id} />
                              <input type="hidden" name="newStatus" value="LOST" />
                              <select name="lostReason" aria-label="Lost reason" className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5 text-[0.75rem] outline-none">
                                <option value="">Select reason</option>
                                {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                              </select>
                              <MenuActionButton icon="close" tone="danger" className="bg-red-500/8">Confirm Lost</MenuActionButton>
                            </form>
                          </div>
                        </RowActionsMenu>
                      ) : null}
                    </div>
                  </div>
                );
              }}
              columns={[
                {
                  key: "name",
                  header: "Lead",
                  cell: (lead) => (
                    <div className="flex items-center gap-3">
                      <Link href={`/sales/leads/${lead.id}`} className="shrink-0">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl font-black ${LEAD_TILE_TONES[lead.status] ?? LEAD_TILE_TONES.STALE}`}>
                          {lead.fullName[0]?.toUpperCase() ?? "?"}
                        </div>
                      </Link>
                      <div className="min-w-0">
                        <Link href={`/sales/leads/${lead.id}`} className="block truncate font-semibold text-[var(--ink)] transition-colors hover:text-[var(--accent)]">
                          {lead.fullName}
                        </Link>
                        <p className="truncate text-[0.75rem] text-[var(--ink-muted)]">
                          {lead.phone}
                          {lead.organization ? <> · {lead.organization}</> : null}
                        </p>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "Stage",
                  cell: (lead) => (
                    <StatusBadge tone={toneFor(LEAD_STATUS_TONES, lead.status)}>{LEAD_STATUS_LABELS[lead.status]}</StatusBadge>
                  ),
                },
                {
                  key: "assignedTo",
                  header: "Assigned",
                  headerClassName: "hidden xl:table-cell",
                  className: "hidden text-[0.75rem] text-[var(--ink-muted)] xl:table-cell",
                  cell: (lead) => lead.assignedTo?.name ?? <span className="opacity-30">—</span>,
                },
                {
                  key: "estValue",
                  header: "Est. Value",
                  className: "whitespace-nowrap font-semibold tabular-nums",
                  cell: (lead) =>
                    lead.estimatedValue != null
                      ? formatMoney(lead.estimatedValue, currency)
                      : <span className="font-normal opacity-30">—</span>,
                },
                {
                  key: "followUp",
                  header: "Follow-up",
                  className: "whitespace-nowrap",
                  cell: (lead) => {
                    const isOverdue = lead.followUpAt != null && lead.followUpAt <= now && !TERMINAL_STATUSES.includes(lead.status);
                    if (!lead.followUpAt) return <span className="text-[0.75rem] text-[var(--ink-muted)]/40">—</span>;
                    return (
                      <span className={`text-[0.75rem] ${isOverdue ? "font-semibold text-amber-600 dark:text-amber-400" : "text-[var(--ink-muted)]"}`}>
                        {formatEATDate(lead.followUpAt)}
                      </span>
                    );
                  },
                },
              ]}
              actions={(lead) => (
                <RowActionsMenu label={`Lead actions for ${lead.fullName}`}>
                  <div className="py-1 text-left">
                    <MenuActionLink href={`/sales/leads/${lead.id}`} icon="open">Open Lead</MenuActionLink>
                    {!TERMINAL_STATUSES.includes(lead.status) && NEXT_STAGE[lead.status as LeadStatus] ? (
                      <form action={advanceLeadStageAction}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <input type="hidden" name="newStatus" value={NEXT_STAGE[lead.status as LeadStatus]!} />
                        <MenuActionButton icon="save" tone="accent">
                          Advance to {LEAD_STATUS_LABELS[NEXT_STAGE[lead.status as LeadStatus]!]}
                        </MenuActionButton>
                      </form>
                    ) : null}
                  </div>
                  {!TERMINAL_STATUSES.includes(lead.status) ? (
                    <>
                      <MenuSection label="Mark Lost" />
                      <div className="w-56 p-3 pt-2 text-left">
                        <form action={advanceLeadStageAction} className="space-y-1.5">
                          <input type="hidden" name="leadId" value={lead.id} />
                          <input type="hidden" name="newStatus" value="LOST" />
                          <select name="lostReason" aria-label="Lost reason" className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 py-1.5 text-[0.75rem] outline-none">
                            <option value="">Select reason</option>
                            {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <MenuActionButton icon="close" tone="danger" className="bg-red-500/8">Confirm Lost</MenuActionButton>
                        </form>
                      </div>
                    </>
                  ) : null}
                </RowActionsMenu>
              )}
            />
            {leadsShownValue > 0 ? (
              <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-2.5">
                <span className="text-[0.75rem] text-[var(--ink-muted)]">{leads.length} shown</span>
                <span className="text-[0.75rem] text-[var(--ink-muted)]">
                  Pipeline on this page <span className="font-semibold text-[var(--ink)]">{formatMoney(leadsShownValue, currency)}</span>
                </span>
              </div>
            ) : null}
          </div>
        )
      ) : /* ── Quotations ── */
      quotations.length === 0 ? (
        <div className="dc-card flex flex-col items-center gap-2 px-6 py-14 text-center">
          <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10 opacity-20" aria-hidden="true">
            <rect x="8" y="5" width="24" height="30" rx="3" stroke="currentColor" strokeWidth="2"/>
            <path d="M14 13h12M14 20h12M14 27h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-sm font-medium text-[var(--ink-muted)]">
            {searchQ ? "No quotations match this search" : "No quotations yet"}
          </p>
          {searchQ ? (
            <Link href={href({ q: "" })} className="text-xs text-[var(--accent)] hover:underline">Clear search</Link>
          ) : can.createQuotations(user) ? (
            <Link href="/sales/quotations/new" className="text-xs text-[var(--accent)] hover:underline">Create first quotation</Link>
          ) : null}
        </div>
      ) : (
        <div className="dc-card overflow-hidden">
          <DataTable
            frameless
            rows={quotations}
            getRowKey={(q) => q.id}
            renderMobileCard={(q) => {
              const recipientName = (q.client ? clientDisplayName(q.client) : null) ?? q.lead?.fullName ?? null;
              const isExpired = q.status !== "ACCEPTED" && q.validUntil != null && q.validUntil < now;
              return (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Link href={`/sales/quotations/${q.id}`} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                    q.status === "ACCEPTED" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : q.status === "REJECTED" ? "bg-red-500/15 text-red-600"
                    : q.status === "SENT" ? "bg-sky-500/15 text-sky-600"
                    : "bg-[var(--panel-strong)] text-[var(--ink-muted)]"
                  }`}>
                    {(recipientName?.[0] ?? "Q").toUpperCase()}
                  </Link>
                  <Link href={`/sales/quotations/${q.id}`} className="min-w-0 flex-1 active:opacity-70">
                    <p className="truncate font-bold text-[var(--ink)]">{recipientName ?? "No recipient"}</p>
                    <p className="mt-0.5 truncate text-[var(--ink-muted)]">
                      <span className="mono">{q.quoteNumber}</span> · {formatEATDate(q.createdAt)}
                    </p>
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="font-black tabular-nums text-[var(--ink)]">{formatMoneyCompact(q.totalAmount, q.currency)}</p>
                    {isExpired ? (
                      <span className="text-[0.75rem] font-semibold text-amber-600 dark:text-amber-400">expired</span>
                    ) : (
                      <StatusBadge tone={toneFor(QUOTATION_STATUS_TONES, q.status)}>{q.status}</StatusBadge>
                    )}
                  </div>
                  {renderQuotationActions(q)}
                </div>
              );
            }}
            columns={[
              {
                key: "quote",
                header: "Quote",
                cell: (q) => (
                  <div className="min-w-0">
                    <Link href={`/sales/quotations/${q.id}`} className="mono block truncate font-semibold text-[var(--ink)] transition-colors hover:text-[var(--accent)]">
                      {q.quoteNumber}
                    </Link>
                    <p className="text-[0.75rem] text-[var(--ink-muted)]">{formatEATDate(q.createdAt)}</p>
                  </div>
                ),
              },
              {
                key: "recipient",
                header: "Client / Lead",
                cell: (q) =>
                  q.client
                    ? <Link href={`/clients/${q.client.id}`} className="font-medium text-[var(--ink)] hover:underline">{clientDisplayName(q.client)}</Link>
                    : q.lead
                      ? <Link href={`/sales/leads/${q.lead.id}`} className="font-medium text-[var(--ink)] hover:underline">{q.lead.fullName}</Link>
                      : <span className="opacity-30">—</span>,
              },
              {
                key: "total",
                header: "Total",
                className: "whitespace-nowrap font-semibold tabular-nums",
                cell: (q) => formatMoney(q.totalAmount, q.currency),
              },
              {
                key: "validUntil",
                header: "Valid Until",
                className: "whitespace-nowrap",
                cell: (q) => {
                  const isExpired = q.status !== "ACCEPTED" && q.validUntil != null && q.validUntil < now;
                  if (!q.validUntil) return <span className="text-[0.75rem] text-[var(--ink-muted)]/40">—</span>;
                  return (
                    <span className={`text-[0.75rem] ${isExpired ? "font-semibold text-amber-600 dark:text-amber-400" : "text-[var(--ink-muted)]"}`}>
                      {formatEATDate(q.validUntil)}
                    </span>
                  );
                },
              },
              { key: "status", header: "Status", cell: (q) => <StatusBadge tone={toneFor(QUOTATION_STATUS_TONES, q.status)}>{q.status}</StatusBadge> },
            ]}
            actions={renderQuotationActions}
          />
        </div>
      )}

      <TablePagination
        page={pageView.page}
        totalPages={pageView.totalPages}
        rangeStart={pageView.rangeStart}
        rangeEnd={pageView.rangeEnd}
        total={pageView.total}
        unit={listUnit}
        hrefForPage={listHref}
        pageSize={pageSize}
        hrefForSize={listSizeHref}
      />
    </ListPageLayout>
    </DisclosureProvider>
  );
}
