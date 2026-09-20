import { redirect } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { requireModule, OrgModule } from "@/lib/module-access";
import { can } from "@/lib/permissions";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { HubTabs } from "@/components/shared/HubTabs";
import { INVENTORY_TABS } from "@/lib/inventory/routes";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder, parsePageSize, sizeHrefBuilder } from "@/lib/pagination";
import { icontains } from "@/lib/db/search";
import { createStockLocationAction, toggleStockLocationAction, updateStockLocationAction } from "./actions";

import { SubmitButton } from "@/components/ui/SubmitButton";
export const dynamic = "force-dynamic";

export default async function StockLocationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModule(OrgModule.INVENTORY);
  const { user, orgId } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const params = (((await searchParams?.catch(() => ({}))) ?? {}) as Record<string, string | string[] | undefined>);
  const created = String(params.created ?? "") === "1";
  const saved = String(params.saved ?? "") === "1";
  const error = typeof params.error === "string" ? params.error : "";
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.size);
  const q = String(params.q ?? "").trim();
  const statusFilter = String(params.status ?? "all").trim().toLowerCase();
  const sort = params.sort === "newest" ? "newest" : "name";

  const where = {
    orgId,
    ...(statusFilter === "active" ? { isActive: true } : statusFilter === "inactive" ? { isActive: false } : {}),
    ...(q
      ? {
          OR: [
            { name: icontains(q) },
            { code: icontains(q) },
          ],
        }
      : {}),
  };

  const [locations, locationsTotal, branches, stockRows] = await Promise.all([
    prisma.stockLocation.findMany({
      where,
      orderBy: sort === "newest" ? { createdAt: "desc" as const } : [{ isActive: "desc" as const }, { name: "asc" as const }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }).catch(() => []),
    prisma.stockLocation.count({ where }).catch(() => 0),
    prisma.branch.findMany({
      where: { orgId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }).catch(() => []),
    prisma.partLocationStock.groupBy({
      by: ["locationId"],
      where: { orgId },
      _sum: { qtyOnHand: true, qtyReserved: true },
      _count: { partId: true },
    }).catch(() => []),
  ]);
  const activeLocations = await prisma.stockLocation.count({ where: { orgId, isActive: true } }).catch(() => 0);

  const stats = new Map(stockRows.map((row) => [row.locationId, row]));
  const totalOnHand = stockRows.reduce((sum, row) => sum + (row._sum.qtyOnHand ?? 0), 0);
  const branchName = new Map(branches.map((branch) => [branch.id, branch.name]));
  const pageView = paginationView(page, locationsTotal, pageSize);
  const hrefForPageFilters = { q: q || "", status: statusFilter !== "all" ? statusFilter : "", sort: sort !== "name" ? sort : "", size: pageSize !== PAGE_SIZE ? pageSize : "" };
  const hrefForPage = pageHrefBuilder("/inventory/locations", hrefForPageFilters);
  const hrefForPageSize = sizeHrefBuilder("/inventory/locations", hrefForPageFilters);

  // Named so the same actions menu renders in the desktop table AND mobile card.
  const renderLocationActions = (location: (typeof locations)[number]) => (
    <RowActionsMenu label={`Location actions for ${location.name}`}>
      <div className="w-72 p-3">
        <form action={updateStockLocationAction} className="grid gap-2 text-left">
          <input type="hidden" name="id" value={location.id} />
          <input name="name" defaultValue={location.name} required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 outline-none focus:border-[var(--accent)]/60" />
          <input name="code" defaultValue={location.code ?? ""} placeholder="Code" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 uppercase outline-none focus:border-[var(--accent)]/60" />
          <select name="branchId" defaultValue={location.branchId ?? ""} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 outline-none focus:border-[var(--accent)]/60">
            <option value="">No branch</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-[0.75rem] text-[var(--ink-muted)]">
            <input type="checkbox" name="isActive" value="1" defaultChecked={location.isActive} /> Active
          </label>
          <SubmitButton bare className="btn-premium rounded-lg px-3 py-1.5 font-semibold">Save Location</SubmitButton>
        </form>
        <form action={toggleStockLocationAction} className="mt-2 border-t border-[var(--line)] pt-2">
          <input type="hidden" name="id" value={location.id} />
          <input type="hidden" name="isActive" value={location.isActive ? "0" : "1"} />
          <SubmitButton bare className="text-[0.75rem] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]">
            {location.isActive ? "Deactivate" : "Activate"}
          </SubmitButton>
        </form>
      </div>
    </RowActionsMenu>
  );

  return (
    <ListPageLayout
      topBar={<HubTabs items={INVENTORY_TABS} />}
      header={{
        title: "Stock Locations",
        kpis: [
          { label: "Total", value: locationsTotal, sub: "locations" },
          { label: "Active", value: activeLocations, sub: "in use", valueClass: "text-emerald-600" },
          { label: "On Hand", value: totalOnHand.toLocaleString(), sub: "units stocked" },
        ],
      }}
      filters={
        <>
          {created ? <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">Location created.</div> : null}
          {saved ? <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">Location updated.</div> : null}
          {error ? <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div> : null}

          <form method="GET" action="/inventory/locations" className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "all", label: "All" },
                { key: "active", label: "Active" },
                { key: "inactive", label: "Inactive" },
              ].map((s) => (
                <Link
                  key={s.key}
                  href={`/inventory/locations?status=${s.key}${q ? `&q=${encodeURIComponent(q)}` : ""}${sort !== "name" ? `&sort=${sort}` : ""}`}
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
            <label className="sr-only" htmlFor="location-search">Search locations</label>
            <input
              id="location-search"
              name="q"
              defaultValue={q}
              placeholder="Name, code…"
              className="ml-auto h-8 w-52 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50"
            />
            <select name="sort" defaultValue={sort} className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.8125rem] text-[var(--ink-muted)] outline-none focus:border-[var(--accent)]/50">
              <option value="name">Name A–Z</option>
              <option value="newest">Newest</option>
            </select>
            <button type="submit" className="h-8 rounded-lg border border-[var(--line)] px-3 text-[0.8125rem] font-semibold text-[var(--ink-muted)] transition hover:text-[var(--ink)]">
              Filter
            </button>
            {q || statusFilter !== "all" || sort !== "name" ? (
              <Link href="/inventory/locations" className="h-8 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.8125rem] font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink)]">Reset</Link>
            ) : null}
          </form>

          <div className="dc-card px-3 py-2.5">
            <p className="mb-2.5 text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Add Location</p>
            <form action={createStockLocationAction} className="grid gap-2 md:grid-cols-[1.4fr_0.7fr_1fr_auto]">
              <input name="name" placeholder="Location name *" required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
              <input name="code" placeholder="Code" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] uppercase outline-none focus:border-[var(--accent)]/60" />
              <select name="branchId" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60">
                <option value="">No branch</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
              <SubmitButton bare className="btn-premium rounded-lg px-4 py-1.5 text-[0.8125rem] font-semibold">Create</SubmitButton>
            </form>
          </div>
        </>
      }
    >
      <DataTable
        rows={locations}
        getRowKey={(location) => location.id}
        pagination={{ page: pageView.page, pageSize, total: locationsTotal, hrefForPage, hrefForSize: hrefForPageSize, unit: "locations" }}
        empty={
          q || statusFilter !== "all" ? (
            <>No locations match these filters. <Link href="/inventory/locations" className="text-[var(--accent)] hover:underline">Clear filters</Link></>
          ) : (
            "No stock locations yet. Create Main Stock, Store, Van, or Technician locations here."
          )
        }
        columns={[
          {
            key: "location",
            header: "Location",
            className: "font-semibold text-[var(--ink)]",
            cell: (location) => location.name,
          },
          {
            key: "code",
            header: "Code",
            className: "mono text-[var(--ink-muted)]",
            cell: (location) => location.code ?? "—",
          },
          {
            key: "branch",
            header: "Branch",
            headerClassName: "hidden md:table-cell",
            className: "hidden text-[var(--ink-muted)] md:table-cell",
            cell: (location) => location.branchId ? branchName.get(location.branchId) ?? "Linked branch" : "—",
          },
          {
            key: "items",
            header: "Items",
            align: "right",
            className: "whitespace-nowrap tabular-nums text-[var(--ink-muted)]",
            cell: (location) => stats.get(location.id)?._count.partId ?? 0,
          },
          {
            key: "onHand",
            header: "On Hand",
            align: "right",
            className: "whitespace-nowrap font-semibold tabular-nums text-[var(--ink)]",
            cell: (location) => stats.get(location.id)?._sum.qtyOnHand ?? 0,
          },
          {
            key: "reserved",
            header: "Reserved",
            align: "right",
            headerClassName: "hidden md:table-cell",
            className: "hidden whitespace-nowrap tabular-nums text-[var(--ink-muted)] md:table-cell",
            cell: (location) => stats.get(location.id)?._sum.qtyReserved ?? 0,
          },
          {
            key: "status",
            header: "Status",
            cell: (location) => (
              <StatusBadge tone={location.isActive ? "success" : "neutral"}>
                {location.isActive ? "Active" : "Inactive"}
              </StatusBadge>
            ),
          },
        ]}
        actions={renderLocationActions}
        renderMobileCard={(location) => (
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-bold text-[var(--ink)]">{location.name}{location.code ? <span className="ml-1.5 mono text-[0.75rem] text-[var(--ink-muted)]">{location.code}</span> : null}</p>
              <p className="mt-0.5 truncate text-[0.75rem] text-[var(--ink-muted)]">{location.branchId ? branchName.get(location.branchId) ?? "Linked branch" : "No branch"} · {stats.get(location.id)?._sum.qtyOnHand ?? 0} on hand</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <StatusBadge tone={location.isActive ? "success" : "neutral"}>{location.isActive ? "Active" : "Inactive"}</StatusBadge>
              {renderLocationActions(location)}
            </div>
          </div>
        )}
      />
    </ListPageLayout>
  );
}
