import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { HubTabs } from "@/components/shared/HubTabs";
import { PROCUREMENT_TABS } from "@/lib/procurement/routes";
import { StatusBadge, toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { PAGE_SIZE, parsePage, paginationView, pageHrefBuilder } from "@/lib/pagination";
import { deletePurchaseRequestAction, reviewPurchaseRequestAction } from "./actions";

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
  searchParams: Promise<{ page?: string }>;
}) {
  const { user, orgId } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const params = await searchParams;
  const page = parsePage(params.page);

  const [total, requests] = await Promise.all([
    prisma.purchaseRequest.count({ where: { orgId } }).catch(() => 0),
    prisma.purchaseRequest.findMany({
      where: { orgId },
      include: {
        supplier: { select: { name: true } },
        requestedBy: { select: { name: true, email: true } },
        convertedPo: { select: { id: true, reference: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }).catch(() => []),
  ]);

  const pageView = paginationView(page, total);
  const requestsHref = pageHrefBuilder("/inventory/purchase-requests", {});

  const fmt = (d: Date | null) => d ? d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "-";

  // Named so the same actions render in the desktop table AND the mobile card.
  const renderRequestActions = (request: (typeof requests)[number]) => (
    <>
      {request.status === "SUBMITTED" || request.status === "DRAFT" ? (
        <>
          <form action={reviewPurchaseRequestAction}>
            <input type="hidden" name="id" value={request.id} />
            <input type="hidden" name="action" value="APPROVED" />
            <button type="submit" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 font-semibold text-emerald-700">Approve</button>
          </form>
          <form action={reviewPurchaseRequestAction}>
            <input type="hidden" name="id" value={request.id} />
            <input type="hidden" name="action" value="REJECTED" />
            <button type="submit" className="rounded-lg border border-red-500/25 px-2.5 py-1.5 font-semibold text-red-600">Reject</button>
          </form>
        </>
      ) : null}
      <Link href={`/inventory/purchase-requests/${request.id}`} className="inline-flex items-center rounded-lg border border-[var(--line)] px-2.5 py-1.5 font-medium text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">View</Link>
      <form action={deletePurchaseRequestAction}>
        <input type="hidden" name="id" value={request.id} />
        <button type="submit" className="rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-1.5 font-semibold text-red-600">Delete</button>
      </form>
    </>
  );

  return (
    <ListPageLayout
      topBar={<HubTabs items={PROCUREMENT_TABS} />}
      header={{
        eyebrow: "Procurement",
        title: "Purchase Requests",
        description: `${total} requests`,
        actions: (
          <>
            <Link href="/api/procurement/export?type=purchase-requests" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">Export CSV</Link>
            <Link href="/inventory/purchase-requests/new" className="btn-premium rounded-lg px-3 py-1.5 text-[12px]">New Request</Link>
          </>
        ),
      }}
    >
      <DataTable
        rows={requests}
        getRowKey={(request) => request.id}
        pagination={{ page: pageView.page, pageSize: PAGE_SIZE, total, hrefForPage: requestsHref, unit: "requests" }}
        empty="No purchase requests yet."
        columns={[
          {
            key: "request",
            header: "Request",
            cell: (request) => (
              <>
                <p className="mono font-bold text-[var(--ink)]">{request.requestNumber}</p>
                <p className="text-[12px] text-[var(--ink-muted)]">{request.priority} · {fmt(request.createdAt)}</p>
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
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">{renderRequestActions(request)}</div>
          </div>
        )}
        actions={renderRequestActions}
      />
    </ListPageLayout>
  );
}
