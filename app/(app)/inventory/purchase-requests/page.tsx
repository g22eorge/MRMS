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
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import {PAGE_SIZE, parsePage, paginationView, pageHrefBuilder, parsePageSize, sizeHrefBuilder} from "@/lib/pagination";
import { RowActionsMenu, MenuSection, MenuActionLink, MenuActionButton } from "@/components/shared/RowActionsMenu";
import { convertPurchaseRequestToPoAction, deletePurchaseRequestAction, reviewPurchaseRequestAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  SUBMITTED: "sky",
  APPROVED: "success",
  REJECTED: "danger",
  CONVERTED: "violet",
  CANCELLED: "neutral",
};

export default async function PurchaseRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string; q?: string; status?: string; sort?: string }>;
}) {
  const { user, orgId } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.size);
  const q = (params.q ?? "").trim();
  const statusFilter = (params.status ?? "all").trim().toLowerCase();
  const sort = params.sort === "needed" ? "needed" : "newest";

  const where = {
    orgId,
    ...(statusFilter !== "all" && ["draft", "submitted", "approved", "rejected", "converted", "cancelled"].includes(statusFilter)
      ? { status: statusFilter.toUpperCase() as never }
      : {}),
    ...(q
      ? {
          OR: [
            { requestNumber: icontains(q) },
            { reason: icontains(q) },
            { supplier: { name: icontains(q) } },
          ],
        }
      : {}),
  };
  const orderBy =
    sort === "needed" ? [{ neededBy: "asc" as const }, { createdAt: "desc" as const }] : { createdAt: "desc" as const };

  const [total, requests, needsReview, approvedCount, convertedCount] = await Promise.all([
    prisma.purchaseRequest.count({ where }).catch(() => 0),
    prisma.purchaseRequest.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        requestedBy: { select: { name: true, email: true } },
        convertedPo: { select: { id: true, reference: true } },
        _count: { select: { items: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }).catch(() => []),
    prisma.purchaseRequest.count({ where: { orgId, status: "SUBMITTED" } }).catch(() => 0),
    prisma.purchaseRequest.count({ where: { orgId, status: "APPROVED" } }).catch(() => 0),
    prisma.purchaseRequest.count({ where: { orgId, status: "CONVERTED" } }).catch(() => 0),
  ]);

  const pageView = paginationView(page, total, pageSize);
  const requestsHrefFilters = {
    q: q || "",
    status: statusFilter !== "all" ? statusFilter : "",
    sort: sort !== "newest" ? sort : "",
    size: pageSize !== PAGE_SIZE ? pageSize : "",
  };
  const requestsHref = pageHrefBuilder("/inventory/purchase-requests", requestsHrefFilters);
  const requestsHrefSize = sizeHrefBuilder("/inventory/purchase-requests", requestsHrefFilters);

  const fmt = (d: Date | null) => d ? d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "-";

  // Named so the same actions render in the desktop table AND the mobile card.
  const renderRequestActions = (request: (typeof requests)[number]) => (
    <RowActionsMenu label={`Request ${request.requestNumber}`}>
      <MenuActionLink href={`/inventory/purchase-requests/${request.id}`} icon="open">View</MenuActionLink>

      {request.status === "SUBMITTED" || request.status === "DRAFT" ? (
        <form action={reviewPurchaseRequestAction}>
          <input type="hidden" name="id" value={request.id} />
          <input type="hidden" name="action" value="APPROVED" />
          <MenuActionButton icon="save" tone="success">Approve</MenuActionButton>
        </form>
      ) : null}

      {request.status === "APPROVED" && !request.convertedPo ? (
        request.supplierId ? (
          <form action={convertPurchaseRequestToPoAction}>
            <input type="hidden" name="id" value={request.id} />
            <input type="hidden" name="supplierId" value={request.supplierId} />
            <MenuActionButton icon="invoice" tone="accent">Convert to PO</MenuActionButton>
          </form>
        ) : (
          <MenuActionLink href={`/inventory/purchase-requests/${request.id}`} icon="invoice" tone="accent">Convert to PO…</MenuActionLink>
        )
      ) : null}

      <MenuSection label="Danger zone" />
      {request.status === "SUBMITTED" || request.status === "DRAFT" ? (
        <form action={reviewPurchaseRequestAction}>
          <input type="hidden" name="id" value={request.id} />
          <input type="hidden" name="action" value="REJECTED" />
          <MenuActionButton icon="delete" tone="danger">Reject</MenuActionButton>
        </form>
      ) : null}
      <form action={deletePurchaseRequestAction}>
        <input type="hidden" name="id" value={request.id} />
        <MenuActionButton icon="delete" tone="danger">Delete</MenuActionButton>
      </form>
    </RowActionsMenu>
  );

  return (
    <ListPageLayout
      topBar={<HubTabs items={INVENTORY_TABS} />}
      header={{
        title: "Purchase Requests",
        description: `${total} requests`,
        actions: (
          <>
            <Link href="/api/procurement/export?type=purchase-requests" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.75rem] font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">Export CSV</Link>
            <Link href="/inventory/purchase-requests/new" className="btn-premium rounded-lg px-3 py-1.5 text-[0.75rem]">New Request</Link>
          </>
        ),
        kpis: [
          { label: "Needs review", value: needsReview, sub: "submitted", tone: needsReview > 0 ? "warn" as const : "good" as const, muted: needsReview === 0 },
          { label: "Approved", value: approvedCount, sub: "ready to convert", muted: approvedCount === 0 },
          { label: "Converted", value: convertedCount, sub: "became POs", muted: convertedCount === 0 },
        ],
      }}
      filters={
        <form method="GET" action="/inventory/purchase-requests" className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: "all", label: "All" },
              { key: "submitted", label: "Submitted" },
              { key: "approved", label: "Approved" },
              { key: "converted", label: "Converted" },
              { key: "rejected", label: "Rejected" },
            ].map((s) => (
              <Link
                key={s.key}
                href={`/inventory/purchase-requests?status=${s.key}${q ? `&q=${encodeURIComponent(q)}` : ""}${sort !== "newest" ? `&sort=${sort}` : ""}`}
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
          <label className="sr-only" htmlFor="pr-search">Search requests</label>
          <input
            id="pr-search"
            name="q"
            defaultValue={q}
            placeholder="#, supplier, reason…"
            className="ml-auto h-8 w-52 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/50"
          />
          <select name="sort" defaultValue={sort} className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.8125rem] text-[var(--ink-muted)] outline-none focus:border-[var(--accent)]/50">
            <option value="newest">Newest</option>
            <option value="needed">Needed first</option>
          </select>
          <button type="submit" className="h-8 rounded-lg border border-[var(--line)] px-3 text-[0.8125rem] font-semibold text-[var(--ink-muted)] transition hover:text-[var(--ink)]">
            Filter
          </button>
          {q || statusFilter !== "all" || sort !== "newest" ? (
            <Link href="/inventory/purchase-requests" className="h-8 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[0.8125rem] font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink)]">Reset</Link>
          ) : null}
        </form>
      }
    >
      <DataTable
        rows={requests}
        getRowKey={(request) => request.id}
        pagination={{ page: pageView.page, pageSize: PAGE_SIZE, total, hrefForPage: requestsHref,
            hrefForSize: requestsHrefSize, unit: "requests" }}
        empty={
          q || statusFilter !== "all" ? (
            <>No requests match these filters. <Link href="/inventory/purchase-requests" className="text-[var(--accent)] hover:underline">Clear filters</Link></>
          ) : (
            "No purchase requests yet."
          )
        }
        columns={[
          {
            key: "request",
            header: "Request",
            cell: (request) => (
              <>
                <p className="mono font-bold text-[var(--ink)]">{request.requestNumber}</p>
                <p className="text-[0.75rem] text-[var(--ink-muted)]">{request.priority} · {fmt(request.createdAt)}</p>
              </>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (request) => (
              <StatusBadge tone={toneFor(STATUS_TONES, request.status, "sky")}>{request.status}</StatusBadge>
            ),
          },
          {
            key: "supplier",
            header: "Supplier",
            headerClassName: "hidden md:table-cell",
            className: "hidden text-[var(--ink-muted)] md:table-cell",
            cell: (request) => request.supplier?.name ?? "No preference",
          },
          {
            key: "needed",
            header: "Needed",
            headerClassName: "hidden sm:table-cell",
            className: "hidden whitespace-nowrap text-[var(--ink-muted)] sm:table-cell",
            cell: (request) => fmt(request.neededBy),
          },
          {
            key: "items",
            header: "Items",
            align: "center",
            className: "text-[var(--ink-muted)]",
            cell: (request) => request._count.items,
          },
        ]}
        renderMobileCard={(request) => (
          <div className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/inventory/purchase-requests/${request.id}`} className="min-w-0 active:opacity-70">
                <p className="mono truncate font-bold text-[var(--ink)]">{request.requestNumber}</p>
                <p className="mt-0.5 truncate text-[var(--ink-muted)]">{request.priority} · {request.supplier?.name ?? "No preference"} · {request._count.items} item{request._count.items === 1 ? "" : "s"}</p>
              </Link>
              <StatusBadge tone={toneFor(STATUS_TONES, request.status, "sky")}>{request.status}</StatusBadge>
            </div>
            {/* Actions reachable on mobile (were desktop-table-only). */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.75rem]">{renderRequestActions(request)}</div>
          </div>
        )}
        actions={renderRequestActions}
      />
    </ListPageLayout>
  );
}
