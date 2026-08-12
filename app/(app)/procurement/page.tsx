import Link from "next/link";
import { redirect } from "next/navigation";

import { formatMoney } from "@/lib/currency";
import { requireModule, OrgModule } from "@/lib/module-access";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { HubTabs } from "@/components/shared/HubTabs";
import { PROCUREMENT_TABS } from "@/lib/procurement/routes";
import { reviewPurchaseRequestAction, convertPurchaseRequestToPoAction } from "../inventory/purchase-requests/actions";

const EXPORTS = [
  { label: "Requests", href: "/api/procurement/export?type=purchase-requests" },
  { label: "Orders", href: "/api/procurement/export?type=purchase-orders" },
  { label: "Received", href: "/api/procurement/export?type=goods-received" },
  { label: "Bills", href: "/api/procurement/export?type=supplier-bills" },
] as const;

function fmt(date: Date | null) {
  return date ? date.toLocaleDateString("en-UG", { day: "numeric", month: "short" }) : "-";
}

function poRef(order: { id: string; reference: string | null }) {
  return order.reference ?? `PO-${order.id.slice(-6).toUpperCase()}`;
}

export default async function ProcurementPage() {
  await requireModule(OrgModule.INVENTORY);
  const { user, orgId } = await requireOrgSession();

  if (!can.manageInventory(user)) redirect("/dashboard");

  const today = new Date();
  const inSevenDays = new Date(today);
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  const [
    requestCounts,
    orderCounts,
    billCounts,
    openOrderItems,
    openBillsForValue,
    reviewQueue,
    receivingQueue,
    billQueue,
    recentGrns,
  ] = await Promise.all([
    prisma.purchaseRequest.groupBy({
      by: ["status"],
      where: { orgId },
      _count: { _all: true },
    }).catch(() => [] as Array<{ status: string; _count: { _all: number } }>),
    prisma.purchaseOrder.groupBy({
      by: ["status"],
      where: { orgId },
      _count: { _all: true },
    }).catch(() => [] as Array<{ status: string; _count: { _all: number } }>),
    prisma.supplierBill.groupBy({
      by: ["status"],
      where: { orgId },
      _count: { _all: true },
    }).catch(() => [] as Array<{ status: string; _count: { _all: number } }>),
    prisma.purchaseOrderItem.findMany({
      where: { po: { orgId, status: { in: ["DRAFT", "ORDERED", "PARTIAL"] } } },
      select: { qtyOrdered: true, qtyReceived: true, unitCost: true },
    }).catch(() => [] as { qtyOrdered: number; qtyReceived: number; unitCost: number }[]),
    prisma.supplierBill.findMany({
      where: { orgId, status: { in: ["POSTED", "PART_PAID"] } },
      select: { totalAmount: true, paidAmount: true },
    }).catch(() => [] as { totalAmount: number; paidAmount: number }[]),
    prisma.purchaseRequest.findMany({
      where: { orgId, status: { in: ["SUBMITTED", "APPROVED"] } },
      include: {
        supplier: { select: { name: true } },
        requestedBy: { select: { name: true, email: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 6,
    }).catch(() => []),
    prisma.purchaseOrder.findMany({
      where: { orgId, status: { in: ["DRAFT", "ORDERED", "PARTIAL"] } },
      include: {
        supplier: { select: { name: true } },
        items: { select: { qtyOrdered: true, qtyReceived: true, unitCost: true } },
      },
      orderBy: [{ expectedAt: "asc" }, { createdAt: "asc" }],
      take: 6,
    }).catch(() => []),
    prisma.supplierBill.findMany({
      where: { orgId, status: { in: ["POSTED", "PART_PAID"] } },
      include: { supplier: { select: { name: true } } },
      orderBy: [{ dueAt: "asc" }, { issuedAt: "asc" }],
      take: 6,
    }).catch(() => []),
    prisma.goodsReceived.findMany({
      where: { orgId },
      include: { supplier: { select: { name: true } }, po: { select: { id: true, reference: true } } },
      orderBy: { receivedAt: "desc" },
      take: 5,
    }).catch(() => []),
  ]);

  const requestCount = (status: string) => requestCounts.find((item) => item.status === status)?._count._all ?? 0;
  const orderCount = (status: string) => orderCounts.find((item) => item.status === status)?._count._all ?? 0;
  const billCount = (status: string) => billCounts.find((item) => item.status === status)?._count._all ?? 0;
  const openOrderValue = openOrderItems.reduce((sum, item) => sum + Math.max(0, item.qtyOrdered - item.qtyReceived) * item.unitCost, 0);
  const payableBalance = openBillsForValue.reduce((sum, bill) => sum + Math.max(0, bill.totalAmount - bill.paidAmount), 0);

  const submittedRequests = requestCount("SUBMITTED");
  const approvedRequests = requestCount("APPROVED");
  const openOrders = orderCount("DRAFT") + orderCount("ORDERED") + orderCount("PARTIAL");
  const dueOrders = receivingQueue.filter((order) => ["ORDERED", "PARTIAL"].includes(order.status) && order.expectedAt && order.expectedAt <= inSevenDays).length;
  const openBills = billCount("POSTED") + billCount("PART_PAID");
  const dueBills = billQueue.filter((bill) => bill.dueAt && bill.dueAt <= inSevenDays).length;

  return (
    <ListPageLayout
      topBar={<HubTabs items={PROCUREMENT_TABS} />}
      header={{
        eyebrow: "Procurement",
        title: "Buying & suppliers",
        description: `${formatMoney(openOrderValue)} on order · ${formatMoney(payableBalance)} still owed to suppliers`,
        actions: (
          <>
            <Button href="/inventory/purchase-requests/new" size="sm" className="px-4 font-bold">New request</Button>
            <Button href="/inventory/purchase-orders/new" variant="secondary" size="sm">New order</Button>
            <Button href="/inventory/supplier-bills/new" variant="secondary" size="sm">New bill</Button>
          </>
        ),
        kpis: [
          { key: "demand", label: "To review", value: submittedRequests, sub: "requests waiting", tone: submittedRequests > 0 ? "warn" : "neutral", muted: submittedRequests === 0, href: "/inventory/purchase-requests" },
          { key: "approved", label: "Approved", value: approvedRequests, sub: "ready to order", tone: "good", muted: approvedRequests === 0, href: "/inventory/purchase-requests" },
          { key: "ordered", label: "On order", value: openOrders, sub: "open orders", tone: "accent", muted: openOrders === 0, href: "/inventory/purchase-orders" },
          { key: "receiving", label: "To receive", value: dueOrders, sub: "arriving soon", tone: dueOrders > 0 ? "warn" : "neutral", muted: dueOrders === 0, href: "/inventory/purchase-orders" },
          { key: "payables", label: "Bills to pay", value: openBills, sub: `${dueBills} due soon`, tone: dueBills > 0 ? "crit" : "neutral", muted: openBills === 0, href: "/inventory/supplier-bills" },
        ],
      }}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2 px-1 text-[0.75rem] text-[var(--ink-muted)]">
          <span className="font-semibold uppercase tracking-[0.14em]">Export CSV</span>
          {EXPORTS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md border border-[var(--line)] px-2.5 py-1 font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
            >
              {item.label}
            </a>
          ))}
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="dc-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Requests to review</p>
            <Link href="/inventory/purchase-requests" className="text-[0.75rem] font-semibold text-[var(--accent)] hover:underline">All requests</Link>
          </div>
          {reviewQueue.length === 0 ? (
            <p className="px-4 py-8 text-center text-[0.8125rem] text-[var(--ink-muted)]">No requests waiting for review.</p>
          ) : (
          <DataTable
            frameless
            dense
            rows={reviewQueue}
            getRowKey={(request) => request.id}
            columns={[
              {
                key: "request",
                header: "Request",
                cell: (request) => (
                  <>
                    <Link href={`/inventory/purchase-requests/${request.id}`} className="mono font-bold text-[var(--ink)] hover:text-[var(--accent)]">{request.requestNumber}</Link>
                    <p className="text-[0.75rem] text-[var(--ink-muted)]">{request.priority} · {request.status}</p>
                  </>
                ),
              },
              { key: "owner", header: "Owner", className: "text-[var(--ink-muted)]", cell: (request) => request.requestedBy.name ?? request.requestedBy.email },
              { key: "supplier", header: "Supplier", className: "text-[var(--ink-muted)]", cell: (request) => request.supplier?.name ?? "No preference" },
              { key: "items", header: "Items", align: "right", className: "tabular-nums text-[var(--ink-muted)]", cell: (request) => request._count.items },
              {
                key: "action",
                header: "Action",
                align: "right",
                cell: (request) => {
                  if (request.status === "APPROVED") {
                    // One-click convert when a supplier is already chosen; otherwise
                    // fall back to the detail page to pick one.
                    return request.supplierId ? (
                      <form action={convertPurchaseRequestToPoAction} className="inline-flex justify-end">
                        <input type="hidden" name="id" value={request.id} />
                        <input type="hidden" name="supplierId" value={request.supplierId} />
                        <button type="submit" className="rounded-lg border border-slate-500/30 bg-slate-500/10 px-2.5 py-1.5 text-[0.75rem] font-semibold text-slate-700">Convert</button>
                      </form>
                    ) : (
                      <Button href={`/inventory/purchase-requests/${request.id}`} variant="secondary" size="sm">Convert</Button>
                    );
                  }
                  return (
                    <div className="inline-flex justify-end gap-1.5">
                      <form action={reviewPurchaseRequestAction}>
                        <input type="hidden" name="id" value={request.id} />
                        <input type="hidden" name="action" value="APPROVED" />
                        <button type="submit" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[0.75rem] font-semibold text-emerald-700">Approve</button>
                      </form>
                      <form action={reviewPurchaseRequestAction}>
                        <input type="hidden" name="id" value={request.id} />
                        <input type="hidden" name="action" value="REJECTED" />
                        <button type="submit" className="rounded-lg border border-red-500/25 px-2.5 py-1.5 text-[0.75rem] font-semibold text-red-600">Reject</button>
                      </form>
                    </div>
                  );
                },
              },
            ]}
          />
          )}
        </section>

        <section className="dc-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Waiting to arrive</p>
            <Link href="/inventory/purchase-orders" className="text-[0.75rem] font-semibold text-[var(--accent)] hover:underline">All orders</Link>
          </div>
          {receivingQueue.length === 0 ? (
            <p className="px-4 py-8 text-center text-[0.8125rem] text-[var(--ink-muted)]">Nothing waiting to arrive.</p>
          ) : (
          <DataTable
            frameless
            dense
            rows={receivingQueue}
            getRowKey={(order) => order.id}
            columns={[
              {
                key: "po",
                header: "PO",
                cell: (order) => (
                  <>
                    <Link href={`/inventory/purchase-orders/${order.id}`} className="mono font-bold text-[var(--ink)] hover:text-[var(--accent)]">{poRef(order)}</Link>
                    <p className="text-[0.75rem] text-[var(--ink-muted)]">{order.status}</p>
                  </>
                ),
              },
              { key: "supplier", header: "Supplier", className: "text-[var(--ink-muted)]", cell: (order) => order.supplier.name },
              {
                key: "outstanding",
                header: "Outstanding",
                align: "right",
                className: "text-[var(--ink-muted)]",
                cell: (order) => {
                  const outstandingQty = order.items.reduce((sum, item) => sum + Math.max(0, item.qtyOrdered - item.qtyReceived), 0);
                  const outstandingValue = order.items.reduce((sum, item) => sum + Math.max(0, item.qtyOrdered - item.qtyReceived) * item.unitCost, 0);
                  return (
                    <>
                      <span className="font-semibold tabular-nums text-[var(--ink)]">{outstandingQty}</span>
                      <p className="">{formatMoney(outstandingValue)}</p>
                    </>
                  );
                },
              },
              { key: "expected", header: "Expected", className: "text-[var(--ink-muted)]", cell: (order) => fmt(order.expectedAt) },
              {
                key: "action",
                header: "Action",
                align: "right",
                cell: (order) => (
                  <Button href={`/inventory/purchase-orders/${order.id}#receive`} variant="secondary" size="sm">Receive</Button>
                ),
              },
            ]}
          />
          )}
        </section>

      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="dc-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Supplier bills</p>
            <Link href="/inventory/supplier-bills" className="text-[0.75rem] font-semibold text-[var(--accent)] hover:underline">All bills</Link>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {billQueue.map((bill) => (
              <Link key={bill.id} href={`/inventory/supplier-bills/${bill.id}`} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-[var(--panel-strong)]/40">
                <div className="min-w-0">
                  <p className="mono text-sm font-bold text-[var(--ink)]">{bill.billNumber}</p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">{bill.supplier.name} · due {fmt(bill.dueAt)}</p>
                </div>
                <p className="shrink-0 text-right text-xs font-bold tabular-nums text-[var(--ink)]">{bill.currency} {Math.max(0, bill.totalAmount - bill.paidAmount).toLocaleString()}</p>
              </Link>
            ))}
            {billQueue.length === 0 ? <p className="px-4 py-8 text-center text-[0.8125rem] text-[var(--ink-muted)]">No supplier bills due.</p> : null}
          </div>
        </section>

        <section className="dc-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2.5">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-muted)]/70">Recently received</p>
            <Link href="/inventory/goods-received" className="text-[0.75rem] font-semibold text-[var(--accent)] hover:underline">All receipts</Link>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {recentGrns.map((grn) => (
              <Link key={grn.id} href={`/inventory/goods-received/${grn.id}`} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-[var(--panel-strong)]/40">
                <div className="min-w-0">
                  <p className="mono text-sm font-bold text-[var(--ink)]">{grn.grnNumber}</p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">{grn.supplier.name} · {fmt(grn.receivedAt)}</p>
                </div>
                <p className="shrink-0 text-xs text-[var(--ink-muted)]">{grn.po ? poRef(grn.po) : "No PO"}</p>
              </Link>
            ))}
            {recentGrns.length === 0 ? <p className="px-4 py-8 text-center text-[0.8125rem] text-[var(--ink-muted)]">Nothing received yet.</p> : null}
          </div>
        </section>
      </div>
    </ListPageLayout>
  );
}
