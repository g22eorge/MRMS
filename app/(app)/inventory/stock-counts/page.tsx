// @ts-nocheck
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/session";

import { prisma } from "@/lib/prisma";
import { orgDb } from "@/lib/db";
import { can } from "@/lib/permissions";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { HubTabs } from "@/components/shared/HubTabs";
import { INVENTORY_TABS } from "@/lib/inventory/routes";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";

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
  const db = orgDb(user.orgId);
  if (!can.manageInventory(user)) redirect("/inventory");

  const params = (((await searchParams?.catch(() => ({}))) ?? {}) as Record<string, string | string[] | undefined>);
  const page = parsePage(params.page);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [counts, countsTotal, inProgressCount, completedThisMonth, varianceItems] = await Promise.all([
    db.stockCount.findMany({
      where: {},
      include: { location: { select: { name: true, code: true } }, createdBy: { select: { name: true, email: true } }, _count: { select: { items: true } } },
      orderBy: { countedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }).catch(() => []),
    db.stockCount.count({ where: {} }).catch(() => 0),
    db.stockCount.count({ where: { status: { in: ["DRAFT", "SUBMITTED"] } } }).catch(() => 0),
    db.stockCount.count({ where: { status: "APPROVED", countedAt: { gte: monthStart } } }).catch(() => 0),
    // StockCountItem has no orgId of its own — scope through its parent count.
    prisma.stockCountItem.count({ where: { varianceQty: { not: 0 }, stockCount: { orgId: user.orgId } } }).catch(() => 0),
  ]);

  const varianceCount = varianceItems;
  const pageView = paginationView(page, countsTotal);
  const hrefForPage = pageHrefBuilder("/inventory/stock-counts", {});

  const fmt = (d: Date) => d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });

  return (
    <ListPageLayout
      topBar={<HubTabs items={INVENTORY_TABS} />}
      header={{
        eyebrow: "Inventory",
        title: "Stock Counts",
        description: `${countsTotal} counts`,
        actions: (
          <Link href="/inventory/stock-counts/new" className="btn-premium rounded-lg px-3 py-1.5 text-[12px]">New Count</Link>
        ),
        kpis: [
          { label: "Total Counts", value: countsTotal, sub: "all time" },
          { label: "In Progress", value: inProgressCount, sub: "draft or submitted" },
          { label: "Completed This Month", value: completedThisMonth, sub: "approved counts" },
          { label: "Variance Items", value: varianceCount, sub: "counted ≠ expected" },
        ],
      }}
    >
      <DataTable
        rows={counts}
        getRowKey={(count) => count.id}
        pagination={{ page: pageView.page, pageSize: PAGE_SIZE, total: countsTotal, hrefForPage, unit: "counts" }}
        empty="No stock counts yet."
        columns={[
          {
            key: "count",
            header: "Count",
            cell: (count) => (
              <>
                <p className="mono font-bold text-[var(--ink)]">{count.countNumber}</p>
                <p className="text-[12px] text-[var(--ink-muted)]">{count.createdBy.name || count.createdBy.email}</p>
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
