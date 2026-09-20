import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/session";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { orgDb } from "@/lib/db";
import { can } from "@/lib/permissions";
import { icontains } from "@/lib/db/search";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { HubTabs } from "@/components/shared/HubTabs";
import { INVENTORY_TABS } from "@/lib/inventory/routes";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder, parsePageSize, sizeHrefBuilder } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  SUBMITTED: "sky",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export default async function StockCountsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await getCurrentUserRole();
  if (!can.manageInventory(user)) redirect("/inventory");
  if (!user.orgId) redirect("/inventory");
  const db = orgDb(user.orgId);

  const params = (((await searchParams?.catch(() => ({}))) ?? {}) as Record<string, string | string[] | undefined>);
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.size);
  const q = String(params.q ?? "").trim();
  const statusFilter = String(params.status ?? "all").trim().toLowerCase();
  const sort = params.sort === "oldest" ? "oldest" : "newest";

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const where: Prisma.StockCountWhereInput = {
    ...(statusFilter === "open"
      ? { status: { in: ["DRAFT", "SUBMITTED"] } }
      : statusFilter !== "all" && ["draft", "submitted", "approved", "rejected", "cancelled"].includes(statusFilter)
        ? { status: statusFilter.toUpperCase() as never }
        : {}),
    ...(q
      ? {
          OR: [
            { countNumber: icontains(q) },
            { location: { name: icontains(q) } },
          ],
        }
      : {}),
  };
  const orderBy = sort === "oldest" ? { countedAt: "asc" as const } : { countedAt: "desc" as const };

  const [counts, countsTotal, inProgressCount, completedThisMonth, varianceItems] = await Promise.all([
    db.stockCount.findMany({
      where,
      include: { location: { select: { name: true, code: true } }, createdBy: { select: { name: true, email: true } }, _count: { select: { items: true } } },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }).catch(() => []),
    db.stockCount.count({ where }).catch(() => 0),
    db.stockCount.count({ where: { status: { in: ["DRAFT", "SUBMITTED"] } } }).catch(() => 0),
    db.stockCount.count({ where: { status: "APPROVED", countedAt: { gte: monthStart } } }).catch(() => 0),
    // StockCountItem has no orgId of its own — scope through its parent count.
    prisma.stockCountItem.count({ where: { varianceQty: { not: 0 }, stockCount: { orgId: user.orgId } } }).catch(() => 0),
  ]);

  const varianceCount = varianceItems;
  const pageView = paginationView(page, countsTotal, pageSize);
  const hrefForPageFilters = { q: q || "", status: statusFilter !== "all" ? statusFilter : "", sort: sort !== "newest" ? sort : "", size: pageSize !== PAGE_SIZE ? pageSize : "" };
  const hrefForPage = pageHrefBuilder("/inventory/stock-counts", hrefForPageFilters);
  const hrefForPageSize = sizeHrefBuilder("/inventory/stock-counts", hrefForPageFilters);

  const fmt = (d: Date) => d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });

  return (
    <ListPageLayout
      topBar={<HubTabs items={INVENTORY_TABS} />}
      header={{
        title: "Stock Counts",
        description: `${countsTotal} counts`,
        actions: (
          <Link href="/inventory/stock-counts/new" className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem]">New Count</Link>
        ),
        kpis: [
          { label: "Total Counts", value: countsTotal, sub: "all time" },
          { label: "In Progress", value: inProgressCount, sub: "draft or submitted" },
          { label: "Completed This Month", value: completedThisMonth, sub: "approved counts" },
          // A variance is stock the books cannot account for. It is the one
          // figure on this page that asks for someone's attention.
          { label: "Variance Items", value: varianceCount, sub: "counted ≠ expected", tone: varianceCount > 0 ? "warn" as const : "good" as const, muted: varianceCount === 0 },
        ],
      }}
      filters={
        <form method="GET" action="/inventory/stock-counts" className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: "all", label: "All" },
              { key: "open", label: "In progress" },
              { key: "approved", label: "Approved" },
              { key: "cancelled", label: "Cancelled" },
            ].map((s) => (
              <Link
                key={s.key}
                href={`/inventory/stock-counts?status=${s.key}${q ? `&q=${encodeURIComponent(q)}` : ""}${sort !== "newest" ? `&sort=${sort}` : ""}`}
                className={`rounded-full px-3 py-1 text-[0.75rem] font-semibold transition ${
                  statusFilter === s.key
                    ? "border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border border-transparent text-[var(--ink-muted)] hover:border-[var(--line)] hover:text-[var(--ink)]"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
          <input type="hidden" name="status" value={statusFilter} />
          <label className="sr-only" htmlFor="count-search">Search counts</label>
          <input
            id="count-search"
            name="q"
            defaultValue={q}
            placeholder="Count #, location…"
            className="ml-auto h-8 w-52 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50"
          />
          <select name="sort" defaultValue={sort} className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.8125rem] text-[var(--ink-muted)] outline-none focus:border-[var(--accent)]/50">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <button type="submit" className="h-8 rounded-lg border border-[var(--line)] px-3 text-[0.8125rem] font-semibold text-[var(--ink-muted)] transition hover:text-[var(--ink)]">
            Filter
          </button>
          {q || statusFilter !== "all" || sort !== "newest" ? (
            <Link href="/inventory/stock-counts" className="h-8 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.8125rem] font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink)]">Reset</Link>
          ) : null}
        </form>
      }
    >
      <DataTable
        rows={counts}
        getRowKey={(count) => count.id}
        pagination={{ page: pageView.page, pageSize, total: countsTotal, hrefForPage, hrefForSize: hrefForPageSize, unit: "counts" }}
        empty={
          q || statusFilter !== "all" ? (
            <>No counts match these filters. <Link href="/inventory/stock-counts" className="text-[var(--accent)] hover:underline">Clear filters</Link></>
          ) : (
            "No stock counts yet."
          )
        }
        columns={[
          {
            key: "count",
            header: "Count",
            cell: (count) => (
              <>
                <p className="mono font-bold text-[var(--ink)]">{count.countNumber}</p>
                <p className="text-[0.75rem] text-[var(--ink-muted)]">{count.createdBy.name || count.createdBy.email}</p>
              </>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (count) => (
              <StatusBadge tone={toneFor(STATUS_TONES, count.status)}>{count.status}</StatusBadge>
            ),
          },
          {
            key: "location",
            header: "Location",
            headerClassName: "hidden sm:table-cell",
            className: "hidden text-[var(--ink-muted)] sm:table-cell",
            cell: (count) => `${count.location.name}${count.location.code ? ` (${count.location.code})` : ""}`,
          },
          {
            key: "items",
            header: "Items",
            align: "center",
            className: "whitespace-nowrap tabular-nums text-[var(--ink-muted)]",
            cell: (count) => count._count.items,
          },
          {
            key: "date",
            header: "Date",
            align: "right",
            className: "whitespace-nowrap text-[var(--ink-muted)]",
            cell: (count) => fmt(count.countedAt),
          },
        ]}
        renderMobileCard={(count) => (
          <Link href={`/inventory/stock-counts/${count.id}`} className="flex items-center justify-between gap-3 px-4 py-3 active:opacity-70">
            <div className="min-w-0">
              <p className="mono truncate font-bold text-[var(--ink)]">{count.countNumber}</p>
              <p className="mt-0.5 truncate text-[var(--ink-muted)]">{count.location.name}{count.location.code ? ` (${count.location.code})` : ""} · {count._count.items} item{count._count.items === 1 ? "" : "s"}</p>
            </div>
            <StatusBadge tone={toneFor(STATUS_TONES, count.status)}>{count.status}</StatusBadge>
          </Link>
        )}
        actions={(count) => (
          <Link href={`/inventory/stock-counts/${count.id}`} className="inline-flex items-center rounded-lg border border-[var(--line)] px-2.5 py-1.5 font-medium text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">View</Link>
        )}
      />
    </ListPageLayout>
  );
}
