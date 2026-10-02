import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { icontains } from "@/lib/db/search";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { HubTabs } from "@/components/shared/HubTabs";
import { INVENTORY_TABS } from "@/lib/inventory/routes";
import { RowActionsMenu, MenuActionLink } from "@/components/shared/RowActionsMenu";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder, parsePageSize, sizeHrefBuilder } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function GoodsReceivedPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, orgId } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const params = (((await searchParams?.catch(() => ({}))) ?? {}) as Record<string, string | string[] | undefined>);
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.size);
  const q = String(params.q ?? "").trim();
  const statusFilter = String(params.status ?? "all").trim().toLowerCase();
  const sort = params.sort === "oldest" ? "oldest" : "newest";

  const where = {
    orgId,
    ...(statusFilter !== "all" && ["posted", "cancelled"].includes(statusFilter)
      ? { status: statusFilter.toUpperCase() as never }
      : {}),
    ...(q
      ? {
          OR: [
            { grnNumber: icontains(q) },
            { supplier: { name: icontains(q) } },
            { po: { reference: icontains(q) } },
          ],
        }
      : {}),
  };
  const orderBy = sort === "oldest" ? { receivedAt: "asc" as const } : { receivedAt: "desc" as const };

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [notes, notesTotal, receivedThisMonth] = await Promise.all([
    prisma.goodsReceived.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        po: { select: { id: true, reference: true } },
        location: { select: { name: true, code: true } },
        items: { select: { quantity: true, unitCost: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }).catch(() => []),
    prisma.goodsReceived.count({ where }).catch(() => 0),
    prisma.goodsReceived.count({ where: { orgId, receivedAt: { gte: monthStart } } }).catch(() => 0),
  ]);

  const pageView = paginationView(page, notesTotal, pageSize);
  const hrefForPageFilters = { q: q || "", status: statusFilter !== "all" ? statusFilter : "", sort: sort !== "newest" ? sort : "", size: pageSize !== PAGE_SIZE ? pageSize : "" };
  const hrefForPage = pageHrefBuilder("/inventory/goods-received", hrefForPageFilters);
  const hrefForPageSize = sizeHrefBuilder("/inventory/goods-received", hrefForPageFilters);

  const fmt = (d: Date) => d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" });

  return (
    <ListPageLayout
      topBar={<HubTabs items={INVENTORY_TABS} />}
      header={{
        title: "Goods Received",
        kpis: [
          { label: "Total GRNs", value: notesTotal, sub: "received notes" },
          { label: "This Month", value: receivedThisMonth, sub: "received", valueClass: "text-emerald-600" },
        ],
        actions: (
          <>
            <Link href="/api/procurement/export?type=goods-received" className="inline-flex items-center rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
              Export CSV
            </Link>
            <Link href="/inventory/purchase-orders" className="inline-flex items-center rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
              Receive from PO
            </Link>
          </>
        ),
      }}
      filters={
        <form method="GET" action="/inventory/goods-received" className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: "all", label: "All" },
              { key: "posted", label: "Posted" },
              { key: "cancelled", label: "Cancelled" },
            ].map((s) => (
              <Link
                key={s.key}
                href={`/inventory/goods-received?status=${s.key}${q ? `&q=${encodeURIComponent(q)}` : ""}${sort !== "newest" ? `&sort=${sort}` : ""}`}
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
          <label className="sr-only" htmlFor="grn-search">Search receipts</label>
          <input
            id="grn-search"
            name="q"
            defaultValue={q}
            placeholder="GRN #, supplier, PO…"
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
            <Link href="/inventory/goods-received" className="h-8 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.8125rem] font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink)]">Reset</Link>
          ) : null}
        </form>
      }
    >
      <DataTable
        rows={notes}
        getRowKey={(grn) => grn.id}
        pagination={{ page: pageView.page, pageSize, total: notesTotal, hrefForPage, hrefForSize: hrefForPageSize, unit: "notes" }}
        empty={
          q || statusFilter !== "all" ? (
            <>No receipts match these filters. <Link href="/inventory/goods-received" className="text-[var(--accent)] hover:underline">Clear filters</Link></>
          ) : (
            "No goods received yet. Open a purchase order to receive stock."
          )
        }
        columns={[
          {
            key: "grn",
            header: "GRN",
            cell: (grn) => (
              <Link href={`/inventory/goods-received/${grn.id}`} className="font-semibold text-[var(--ink)] hover:text-[var(--accent)]">
                {grn.grnNumber}
              </Link>
            ),
          },
          {
            key: "supplier",
            header: "Supplier",
            className: "text-[var(--ink)]",
            cell: (grn) => grn.supplier.name,
          },
          {
            key: "po",
            header: "PO",
            headerClassName: "hidden md:table-cell",
            className: "hidden text-[0.75rem] text-[var(--ink-muted)] md:table-cell",
            cell: (grn) => grn.po ? (
              <Link href={`/inventory/purchase-orders/${grn.po.id}`} className="hover:text-[var(--accent)]">
                {grn.po.reference ?? `PO-${grn.po.id.slice(-6).toUpperCase()}`}
              </Link>
            ) : "—",
          },
          {
            key: "location",
            header: "Location",
            headerClassName: "hidden sm:table-cell",
            className: "hidden text-[0.75rem] text-[var(--ink-muted)] sm:table-cell",
            cell: (grn) => `${grn.location.name}${grn.location.code ? ` (${grn.location.code})` : ""}`,
          },
          {
            key: "value",
            header: "Value",
            align: "right",
            className: "font-semibold tabular-nums text-[var(--ink)]",
            cell: (grn) => grn.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0).toLocaleString(),
          },
          {
            key: "received",
            header: "Received",
            align: "right",
            className: "whitespace-nowrap text-[0.75rem] text-[var(--ink-muted)]",
            cell: (grn) => fmt(grn.receivedAt),
          },
        ]}
        actions={(grn) => (
          <RowActionsMenu label={`GRN ${grn.grnNumber}`}>
            <MenuActionLink href={`/inventory/goods-received/${grn.id}`} icon="open">View</MenuActionLink>
            <MenuActionLink href={`/api/procurement/documents/goods-received/${grn.id}`} external icon="download">Print / PDF</MenuActionLink>
          </RowActionsMenu>
        )}
        renderMobileCard={(grn) => (
          <Link href={`/inventory/goods-received/${grn.id}`} className="flex items-center justify-between gap-3 px-4 py-3 active:opacity-70">
            <div className="min-w-0">
              <p className="truncate font-bold text-[var(--ink)]">{grn.grnNumber}</p>
              <p className="mt-0.5 truncate text-[var(--ink-muted)]">{grn.supplier.name} · {fmt(grn.receivedAt)}</p>
            </div>
            <span className="shrink-0 font-semibold tabular-nums text-[var(--ink)]">{grn.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0).toLocaleString()}</span>
          </Link>
        )}
      />
    </ListPageLayout>
  );
}
