import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { formatMoneyCompact, normalizeCurrency } from "@/lib/currency";
import { formatEATDate } from "@/lib/date-eat";
import { loadCashCollectionsByChannel } from "@/lib/finance/reconciliation";
import { prisma } from "@/lib/prisma";
import { findRecentDuplicate } from "@/lib/dedup";
import { Prisma } from "@prisma/client";
import { orgDb } from "@/lib/db";
import { orgTagFor, maxNumberSequence, composeOrgNumber } from "@/lib/commercial/org-number";
import { can } from "@/lib/permissions";
import { requireOrgSession } from "@/lib/org-context";
import { getDocumentBrandingSettings } from "@/lib/document-branding";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { DataTable, TablePagination } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/StatCards";
import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";

function saleStatusTone(status: string): BadgeTone {
  if (status === "PAID") return "success";
  if (status === "VOID") return "danger";
  return "warning";
}

function monthKey(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function nextSaleNumber(db: ReturnType<typeof orgDb>, orgId: string) {
  const inner = `S-${monthKey(new Date())}-`;
  const [tag, rows] = await Promise.all([
    orgTagFor(orgId),
    db.sale.findMany({
      where: { saleNumber: { contains: inner } },
      select: { saleNumber: true },
    }),
  ]);
  const next = maxNumberSequence(inner, rows.map((r) => r.saleNumber)) + 1;
  return composeOrgNumber(tag, inner, next);
}

const SEGMENTS = ["all", "today", "month", "open"] as const;
type Segment = (typeof SEGMENTS)[number];

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; q?: string; page?: string }>;
}) {
  const { user, orgId, org } = await requireOrgSession();
  const db = orgDb(orgId);
  if (!(can.viewFinancials(user) || ["ADMIN", "OPS", "FRONT_DESK"].includes(user.role))) {
    redirect("/dashboard");
  }

  const { period, q: rawQ, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const currency = org.baseCurrency;
  const segment: Segment = SEGMENTS.includes(period as Segment) ? (period as Segment) : "all";
  const q = (rawQ ?? "").trim();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  function segmentFilter(seg: Segment): Prisma.SaleWhereInput {
    if (seg === "today") return { createdAt: { gte: todayStart } };
    if (seg === "month") return { createdAt: { gte: monthStart } };
    if (seg === "open") return { status: "OPEN" };
    return {};
  }

  const searchFilter: Prisma.SaleWhereInput = q
    ? {
        OR: [
          { saleNumber: { contains: q } },
          { notes: { contains: q } },
          { client: { fullName: { contains: q } } },
        ],
      }
    : {};

  const [
    kpiTodayCollections,
    kpiMonthCollections,
    kpiMonthCount,
    segCountAll,
    segCountToday,
    segCountMonth,
    segCountOpen,
  ] = await Promise.all([
    loadCashCollectionsByChannel({ orgId, baseCurrency: currency, range: { start: todayStart } }).catch(() => ({ products: 0 })),
    loadCashCollectionsByChannel({ orgId, baseCurrency: currency, range: { start: monthStart } }).catch(() => ({ products: 0 })),
    db.payment.count({ where: { saleId: { not: null }, receivedAt: { gte: monthStart }, kind: "PAYMENT" } }).catch(() => 0),
    db.sale.count().catch(() => 0),
    db.sale.count({ where: { createdAt: { gte: todayStart } } }).catch(() => 0),
    db.sale.count({ where: { createdAt: { gte: monthStart } } }).catch(() => 0),
    db.sale.count({ where: { status: "OPEN" } }).catch(() => 0),
  ]);
  const kpiTodayTotal = kpiTodayCollections.products ?? 0;
  const kpiMonthTotal = kpiMonthCollections.products ?? 0;
  const kpiAvgSale = kpiMonthCount > 0 ? kpiMonthTotal / kpiMonthCount : 0;

  let dbNeedsFix = false;

  async function createSaleAction(_formData: FormData) {
    "use server";
    const { user: _u2, orgId: _orgId2 } = await requireOrgSession();
    const db = orgDb(_orgId2);
    if (!(can.viewFinancials(_u2) || ["ADMIN", "OPS", "FRONT_DESK"].includes(_u2.role))) redirect("/dashboard");

    // Double-submit guard: a double-tap on "New Sale" would open two empty tills.
    // Reuse the just-created empty draft (nothing is lost — it has no items yet).
    const recentEmpty = await findRecentDuplicate(db.sale, {
      createdById: _u2.id,
      status: "OPEN",
      totalAmount: 0,
    });
    if (recentEmpty) redirect(`/pos/${recentEmpty.id}`);

    const saleNumber = await nextSaleNumber(db, _orgId2);
    // Seed VAT intent from the org default so a sale only charges VAT when the
    // org has opted in (Settings -> Branding -> VAT). Cashiers can still flip it
    // per-sale on the sale page.
    const branding = await getDocumentBrandingSettings(_orgId2);
    const sale = await db.sale.create({
      data: {
        orgId: _orgId2,
        saleNumber,
        status: "OPEN",
        // currency uses schema default
        taxApplicable: branding.vatDefaultApplicable,
        createdById: _u2.id,
      },
      select: { id: true },
    });

    revalidatePath("/pos");
    redirect(`/pos/${sale.id}`);
  }

  async function deleteSaleAction(formData: FormData) {
    "use server";
    const { user: _u3, orgId: _orgId3 } = await requireOrgSession();
    const db = orgDb(_orgId3);
    if (_u3.role !== "ADMIN") redirect("/dashboard");

    const saleId = String(formData.get("saleId") ?? "").trim();
    if (!saleId) return;

    const sale = await db.sale.findFirst({
      where: { id: saleId },
      select: {
        id: true,
        status: true,
        invoicedAt: true,
        items: { select: { partId: true, quantity: true, description: true } },
        payments: { select: { id: true }, take: 1 },
        creditNotes: { select: { id: true }, take: 1 },
        refunds: { select: { id: true }, take: 1 },
      },
    });
    if (!sale || sale.status !== "OPEN" || sale.invoicedAt || sale.payments.length || sale.creditNotes.length || sale.refunds.length) return;

    await prisma.$transaction(async (tx) => {
      for (const item of sale.items) {
        if (!item.partId) continue;
        const part = await tx.part.findFirst({ where: { id: item.partId }, select: { id: true, qtyOnHand: true } });
        if (!part) continue;
        await tx.part.update({ where: { id: part.id }, data: { qtyOnHand: part.qtyOnHand + Math.abs(item.quantity) } });
        await tx.partStockTransaction.create({
          data: {
            partId: part.id,
            saleId: sale.id,
            type: "IN",
            quantity: Math.abs(item.quantity),
            reason: `POS sale deleted (${item.description})`,
            createdById: _u3.id,
          },
        });
      }
      await tx.sale.deleteMany({ where: { id: sale.id } });
    });

    revalidatePath("/pos");
  }

  let sales: Array<{
    id: string;
    saleNumber: string;
    status: string;
    currency: string | null;
    totalAmount: number;
    paidAmount: number;
    invoicedAt: Date | null;
    createdAt: Date;
    client: { id: string; fullName: string } | null;
    createdBy: { id: string; name: string } | null;
    _count: { payments: number; creditNotes: number; refunds: number };
  }> = [];
  const salesWhere = { ...segmentFilter(segment), ...searchFilter };
  let salesTotal = 0;
  try {
    salesTotal = await db.sale.count({ where: salesWhere });
    sales = await db.sale.findMany({
      where: salesWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        saleNumber: true,
        status: true,
        currency: true,
        totalAmount: true,
        paidAmount: true,
        invoicedAt: true,
        createdAt: true,
        client: { select: { id: true, fullName: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { payments: true, creditNotes: true, refunds: true } },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("no such table") && msg.includes("Sale")) dbNeedsFix = true;
    sales = [];
  }

  const salesPage = paginationView(page, salesTotal);
  const salesHref = pageHrefBuilder("/pos", { period: segment !== "all" ? segment : "", q });
  const hasSaleFilters = Boolean(q) || segment !== "all";

  function filterHref(next: Segment, search = q) {
    const params = new URLSearchParams();
    if (next !== "all") params.set("period", next);
    if (search) params.set("q", search);
    const query = params.toString();
    return query ? `/pos?${query}` : "/pos";
  }
  const segmentHref = (next: Segment) => filterHref(next);

  /** Money for the tight mobile stat strip — currency code lives in the header line. */
  const compactAmount = (value: number) => formatMoneyCompact(value, currency).replace(`${currency} `, "");

  function canDelete(s: (typeof sales)[number]) {
    return (
      user.role === "ADMIN" &&
      s.status === "OPEN" &&
      !s.invoicedAt &&
      s._count.payments === 0 &&
      s._count.creditNotes === 0 &&
      s._count.refunds === 0
    );
  }

  const segmentChips = [
    { seg: "all" as Segment, short: "All", long: `${segCountAll} total`, count: segCountAll },
    { seg: "today" as Segment, short: "Today", long: `${segCountToday} today`, count: segCountToday },
    { seg: "month" as Segment, short: "Month", long: `${segCountMonth} this month`, count: segCountMonth },
    { seg: "open" as Segment, short: "Open", long: `${segCountOpen} open`, count: segCountOpen },
  ];

  // Named so the same actions render in the desktop table AND the mobile card.
  const renderSaleActions = (s: (typeof sales)[number]) => (
    <>
      <Link href={`/pos/${s.id}`} title="Open sale"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </Link>
      <a href={`/api/sales/${s.id}/receipt`} target="_blank" rel="noreferrer" title="Receipt PDF"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] transition hover:border-sky-400/40 hover:text-sky-600">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
      </a>
      {canDelete(s) ? (
        <form action={deleteSaleAction} className="inline">
          <input type="hidden" name="saleId" value={s.id} />
          <ConfirmSubmitButton
            message="Delete this open POS sale? Stock will be restored."
            title="Delete sale"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/20 text-[var(--ink-muted)]/40 transition hover:border-red-400/40 hover:text-red-500"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </ConfirmSubmitButton>
        </form>
      ) : null}
    </>
  );

  return (
    <ListPageLayout
      headerNode={
        <>
          {dbNeedsFix ? (
            <section className="panel-shadow rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-semibold text-amber-50">POS database tables are missing.</p>
              <p className="mt-1 text-amber-100/90">
                Run <span className="mono">/api/admin/db-fix</span> as the platform admin to create <span className="mono">Sale</span> tables.
              </p>
              <Button href="/api/admin/db-fix" external target="_blank" rel="noreferrer" variant="secondary" size="sm" className="mt-3">
                Open DB Fix
              </Button>
            </section>
          ) : null}

          {/* ══ MOBILE HEADER ══ */}
          <div className="space-y-3 lg:hidden">
            {/* Title row + New Sale CTA */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[1.375rem] font-black text-[var(--ink)]">Sales</h1>
                <p className="text-[0.8125rem] text-[var(--ink-muted)]">{segCountAll} total · amounts in {currency}</p>
              </div>
              <form action={createSaleAction}>
                <SubmitButton size="md" pendingLabel="Creating…" className="rounded-xl font-bold">+ New Sale</SubmitButton>
              </form>
            </div>

            {/* Compact 4-number stat row */}
            <div className="grid grid-cols-4 divide-x divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)]">
              {([
                { label: "Today", value: compactAmount(kpiTodayTotal) },
                { label: "Month", value: compactAmount(kpiMonthTotal) },
                { label: "Sales", value: String(kpiMonthCount) },
                { label: "Avg", value: compactAmount(kpiAvgSale) },
              ] as const).map(({ label, value }) => (
                <div key={label} className="min-w-0 px-1.5 py-3 text-center">
                  <p className="truncate text-[1.0625rem] font-black leading-none tabular-nums text-[var(--ink)]">{value}</p>
                  <p className="mt-1 text-[0.6875rem] text-[var(--ink-muted)]">{label}</p>
                </div>
              ))}
            </div>

            {/* 4-chip segment filter — grid fills full width */}
            <div className="grid grid-cols-4 gap-1.5">
              {segmentChips.map(({ seg, short, count }) => (
                <Link
                  key={seg}
                  href={segmentHref(seg)}
                  className={`rounded-full py-1.5 text-center text-[0.75rem] font-bold transition ${
                    segment === seg
                      ? "bg-[var(--accent)] text-black"
                      : "border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]"
                  }`}
                >
                  {short}{count > 0 && segment !== seg ? ` ${count}` : ""}
                </Link>
              ))}
            </div>

            {/* Search — full width, no redundant button */}
            <form method="GET">
              {segment !== "all" ? <input type="hidden" name="period" value={segment} /> : null}
              <div className="relative">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]/50" aria-hidden>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Sale number, client or note..."
                  className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] pl-9 pr-4 text-[0.8125rem] outline-none placeholder:text-[var(--ink-muted)]/50 focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/14"
                />
                {q ? (
                  <Link href={filterHref(segment, "")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]/50">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </Link>
                ) : null}
              </div>
            </form>
          </div>

          {/* ══ DESKTOP HEADER ══ */}
          <div className="hidden lg:block">
            <PageHeader
              eyebrow="Point of Sale"
              title="Sales"
              description="Walk-in and retail transactions"
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
            key: "today",
            label: "Today's sales",
            value: formatMoneyCompact(kpiTodayTotal, currency),
            sub: "click to filter",
            tone: "good",
            muted: kpiTodayTotal === 0,
            active: segment === "today",
            href: segmentHref("today"),
          },
          {
            key: "month",
            label: "This month",
            value: formatMoneyCompact(kpiMonthTotal, currency),
            sub: "click to filter",
            tone: "accent",
            muted: kpiMonthTotal === 0,
            active: segment === "month",
            href: segmentHref("month"),
          },
          {
            key: "count",
            label: "Sales this month",
            value: kpiMonthCount,
            sub: "this month",
            muted: kpiMonthCount === 0,
          },
          {
            key: "avg",
            label: "Avg sale value",
            value: formatMoneyCompact(kpiAvgSale, currency),
            sub: "per transaction",
            muted: kpiAvgSale === 0,
          },
        ]}
      />

      {/* ══ DESKTOP: Stat chips + New Sale ══ */}
      <div className="panel-shadow hidden flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 lg:flex">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {segmentChips.map(({ seg, long }) => (
            <Link
              key={seg}
              href={segmentHref(seg)}
              className={`rounded-full border px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
                segment === seg
                  ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                  : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)] hover:border-[var(--accent)]/40"
              }`}
            >
              {long}
            </Link>
          ))}
        </div>
        <form action={createSaleAction} className="shrink-0">
          <SubmitButton size="sm" pendingLabel="Creating…" className="px-4 font-bold">+ New Sale</SubmitButton>
        </form>
      </div>

      {/* ══ DESKTOP: Filter panel ══ */}
      <div className="panel-shadow hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] lg:block">
        <form className="flex items-center gap-2 p-3">
          {segment !== "all" ? <input type="hidden" name="period" value={segment} /> : null}
          <input
            name="q"
            defaultValue={q}
            aria-label="Search sales"
            placeholder="Search by sale number, client or note..."
            className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-sm outline-none transition placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/15"
          />
          <Button type="submit" variant="secondary" size="sm">Search</Button>
          {hasSaleFilters ? (
            <Link href="/pos" className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.75rem] text-[var(--ink-muted)]">Reset</Link>
          ) : null}
        </form>
      </div>

      {/* ── Sales table / cards ── */}
      {sales.length === 0 ? (
        <div className="panel-shadow flex flex-col items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-6 py-14 text-center">
          <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10 opacity-20" aria-hidden="true">
            <rect x="8" y="5" width="24" height="30" rx="3" stroke="currentColor" strokeWidth="2"/>
            <path d="M14 13h12M14 20h12M14 27h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-sm font-medium text-[var(--ink-muted)]">No sales match this view</p>
          {hasSaleFilters ? (
            <Link href="/pos" className="text-xs text-[var(--accent)] hover:underline">Clear filters</Link>
          ) : null}
        </div>
      ) : (
        <div className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
          <DataTable
            frameless
            rows={sales}
            getRowKey={(s) => s.id}
            renderMobileCard={(s) => {
              const cur = normalizeCurrency(s.currency, "UGX");
              const balance = Math.max(0, s.totalAmount - s.paidAmount);
              return (
                <div className="px-4 py-3">
                  <div className="flex items-center gap-3">
                  <Link href={`/pos/${s.id}`} className="shrink-0">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black ${
                      s.status === "PAID" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : s.status === "VOID" ? "bg-red-500/15 text-red-600"
                      : "bg-[var(--accent)]/15 text-[var(--accent)]"
                    }`}>
                      {(s.client?.fullName?.[0] ?? "W").toUpperCase()}
                    </div>
                  </Link>
                  <Link href={`/pos/${s.id}`} className="min-w-0 flex-1 active:opacity-70">
                    <p className="truncate font-bold text-[var(--ink)]">{s.client?.fullName ?? "Walk-in"}</p>
                    <p className="mt-0.5 truncate text-[var(--ink-muted)]">
                      <span className="mono">{s.saleNumber}</span>
                      {" · "}{formatEATDate(s.createdAt)}
                      {s.createdBy ? <> · {s.createdBy.name}</> : null}
                    </p>
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="text-[0.875rem] font-black tabular-nums whitespace-nowrap text-[var(--ink)]">{formatMoneyCompact(s.totalAmount, cur)}</p>
                    {balance > 0 && s.status !== "VOID" ? (
                      <span className="text-[0.75rem] font-semibold text-amber-600 dark:text-amber-400">{formatMoneyCompact(balance, cur)} due</span>
                    ) : (
                      <StatusBadge tone={saleStatusTone(s.status)}>{s.status}</StatusBadge>
                    )}
                  </div>
                  </div>
                  {/* Actions reachable on mobile (were desktop-table-only). */}
                  <div className="mt-2 flex items-center gap-1.5">{renderSaleActions(s)}</div>
                </div>
              );
            }}
            columns={[
              {
                key: "sale",
                header: "Sale",
                cell: (s) => (
                  <div className="min-w-0">
                    <Link href={`/pos/${s.id}`} className="mono block truncate font-semibold text-[var(--ink)] transition-colors hover:text-[var(--accent)]">
                      {s.saleNumber}
                    </Link>
                    <p className="text-[0.75rem] text-[var(--ink-muted)]">{formatEATDate(s.createdAt)}</p>
                  </div>
                ),
              },
              {
                key: "client",
                header: "Client",
                cell: (s) =>
                  s.client
                    ? <Link href={`/clients/${s.client.id}`} className="font-medium text-[var(--ink)] hover:underline">{s.client.fullName}</Link>
                    : <span className="text-[var(--ink-muted)]">Walk-in</span>,
              },
              {
                key: "createdBy",
                header: "Cashier",
                headerClassName: "hidden xl:table-cell",
                className: "hidden text-[0.75rem] text-[var(--ink-muted)] xl:table-cell",
                cell: (s) => s.createdBy?.name ?? <span className="opacity-30">—</span>,
              },
              {
                key: "total",
                header: "Total",
                className: "whitespace-nowrap font-semibold tabular-nums",
                cell: (s) => formatMoneyCompact(s.totalAmount, normalizeCurrency(s.currency, "UGX")),
              },
              {
                key: "balance",
                header: "Balance",
                className: "whitespace-nowrap tabular-nums",
                cell: (s) => {
                  const cur = normalizeCurrency(s.currency, "UGX");
                  const balance = Math.max(0, s.totalAmount - s.paidAmount);
                  if (s.status === "VOID") return <span className="text-[0.75rem] text-[var(--ink-muted)]/40">—</span>;
                  return balance > 0
                    ? <span className="font-semibold text-amber-600 dark:text-amber-400">{formatMoneyCompact(balance, cur)}</span>
                    : <span className="font-semibold text-emerald-600 dark:text-emerald-400">Cleared</span>;
                },
              },
              { key: "status", header: "Status", cell: (s) => <StatusBadge tone={saleStatusTone(s.status)}>{s.status}</StatusBadge> },
            ]}
            actions={renderSaleActions}
          />
        </div>
      )}

      <TablePagination
        page={salesPage.page}
        totalPages={salesPage.totalPages}
        rangeStart={salesPage.rangeStart}
        rangeEnd={salesPage.rangeEnd}
        total={salesPage.total}
        unit="sales"
        hrefForPage={salesHref}
      />
    </ListPageLayout>
  );
}
