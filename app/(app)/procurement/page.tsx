import Link from "next/link";
import { redirect } from "next/navigation";

import { formatMoney } from "@/lib/currency";
import { requireModule, OrgModule } from "@/lib/module-access";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/ui/DataTable";
import { ListPageLayout } from "@/components/ui/ListPageLayout";
import { StatStrip } from "@/components/ui/StatStrip";

const EXPORTS = [
  { label: "Requests", href: "/api/procurement/export?type=purchase-requests" },
  { label: "Orders", href: "/api/procurement/export?type=purchase-orders" },
  { label: "GRNs", href: "/api/procurement/export?type=goods-received" },
  { label: "Bills", href: "/api/procurement/export?type=supplier-bills" },
] as const;

const WORKFLOW_LINKS = [
  { label: "Requests", href: "/inventory/purchase-requests", action: "Review demand" },
  { label: "Purchase Orders", href: "/inventory/purchase-orders", action: "Issue and receive" },
  { label: "Goods Received", href: "/inventory/goods-received", action: "Verify receipts" },
  { label: "Supplier Bills", href: "/inventory/supplier-bills", action: "Match and pay" },
  { label: "Suppliers", href: "/inventory/suppliers", action: "Manage vendors" },
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

  const stages = [
    { label: "Demand", value: submittedRequests, hint: "requests to review", href: "/inventory/purchase-requests" },
    { label: "Approved", value: approvedRequests, hint: "ready for PO", href: "/inventory/purchase-requests" },
    { label: "Ordered", value: openOrders, hint: "open POs", href: "/inventory/purchase-orders" },
    { label: "Receiving", value: dueOrders, hint: "due soon", href: "/inventory/purchase-orders" },
    { label: "Payables", value: openBills, hint: `${dueBills} due soon`, href: "/inventory/supplier-bills" },
  ];

  return (
    <ListPageLayout
      header={{
        eyebrow: "Procurement",
        title: "Control Desk",
        actions: (
          <>
            <Link href="/inventory/purchase-requests/new" className="btn-premium rounded-md px-2.5 py-1.5 text-xs font-semibold">New request</Link>
            <Link href="/inventory/purchase-orders/new" className="rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:text-[var(--accent)]">New PO</Link>
            <Link href="/inventory/supplier-bills/new" className="rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:text-[var(--accent)]">New bill</Link>
          </>
        ),
      }}
    >
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
        <div className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] md:grid-cols-5 md:divide-y-0">
          {stages.map((stage) => (
            <Link key={stage.label} href={stage.href} className="px-3 py-2 hover:bg-[var(--panel-strong)]/45">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">{stage.label}</p>
              <p className="text-sm font-bold tabular-nums text-[var(--ink)]">{stage.value}</p>
              <p className="text-[11px] text-[var(--ink-muted)]">{stage.hint}</p>
            </Link>
          ))}
        </div>
      </div>

      <StatStrip
        variant="cards"
        columns={3}
        tiles={[
          { label: "Open PO Value", value: formatMoney(openOrderValue) },
          { label: "Supplier Balance", value: formatMoney(payableBalance) },
          { label: "Urgent", value: submittedRequests + dueOrders + dueBills },
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-[1.1fr_1.1fr_0.8fr]">
        <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
            <p className="text-sm font-bold text-[var(--ink)]">Review queue</p>
            <Link href="/inventory/purchase-requests" className="text-xs font-semibold text-[var(--accent)] hover:underline">All requests</Link>
          </div>
          <DataTable
            frameless
            dense
            rows={reviewQueue}
            getRowKey={(request) => request.id}
            empty="No pending requests."
            columns={[
              {
                key: "request",
                header: "Request",
                cell: (request) => (
                  <>
                    <Link href={`/inventory/purchase-requests/${request.id}`} className="font-mono font-bold text-[var(--ink)] hover:text-[var(--accent)]">{request.requestNumber}</Link>
                    <p className="text-xs text-[var(--ink-muted)]">{request.priority} · {request.status}</p>
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
                cell: (request) => (
                  <Link href={`/inventory/purchase-requests/${request.id}`} className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-semibold text-[var(--ink)] hover:text-[var(--accent)]">
                    {request.status === "APPROVED" ? "Convert" : "Review"}
                  </Link>
                ),
              },
            ]}
          />
        </section>

        <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
            <p className="text-sm font-bold text-[var(--ink)]">Receiving queue</p>
            <Link href="/inventory/purchase-orders" className="text-xs font-semibold text-[var(--accent)] hover:underline">All POs</Link>
          </div>
          <DataTable
            frameless
            dense
            rows={receivingQueue}
            getRowKey={(order) => order.id}
            empty="No open receiving work."
            columns={[
              {
                key: "po",
                header: "PO",
                cell: (order) => (
                  <>
                    <Link href={`/inventory/purchase-orders/${order.id}`} className="font-mono font-bold text-[var(--ink)] hover:text-[var(--accent)]">{poRef(order)}</Link>
                    <p className="text-xs text-[var(--ink-muted)]">{order.status}</p>
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
                      <p className="text-xs">{formatMoney(outstandingValue)}</p>
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
                  <Link href={`/inventory/purchase-orders/${order.id}#receive`} className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700">Receive</Link>
                ),
              },
            ]}
          />
        </section>

        <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
            <p className="text-sm font-bold text-[var(--ink)]">Exports</p>
            <span className="text-xs text-[var(--ink-muted)]">CSV</span>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            {EXPORTS.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:text-[var(--accent)]">
                {item.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-[var(--line)] px-3 py-2">
            <p className="text-sm font-bold text-[var(--ink)]">Workflow</p>
            <div className="mt-2 space-y-1.5">
              {WORKFLOW_LINKS.map((item) => (
                <Link key={item.href} href={item.href} className="flex items-center justify-between rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs hover:border-[var(--accent)]/40">
                  <span className="font-semibold text-[var(--ink)]">{item.label}</span>
                  <span className="text-[var(--ink-muted)]">{item.action}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
            <p className="text-sm font-bold text-[var(--ink)]">Supplier bills</p>
            <Link href="/inventory/supplier-bills" className="text-xs font-semibold text-[var(--accent)] hover:underline">All bills</Link>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {billQueue.map((bill) => (
              <Link key={bill.id} href={`/inventory/supplier-bills/${bill.id}`} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-[var(--panel-strong)]/40">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-[var(--ink)]">{bill.billNumber}</p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">{bill.supplier.name} · due {fmt(bill.dueAt)}</p>
                </div>
                <p className="shrink-0 text-right text-xs font-bold tabular-nums text-[var(--ink)]">{bill.currency} {Math.max(0, bill.totalAmount - bill.paidAmount).toLocaleString()}</p>
              </Link>
            ))}
            {billQueue.length === 0 ? <p className="px-3 py-6 text-center text-sm text-[var(--ink-muted)]">No supplier bills due.</p> : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
            <p className="text-sm font-bold text-[var(--ink)]">Recent GRNs</p>
            <Link href="/inventory/goods-received" className="text-xs font-semibold text-[var(--accent)] hover:underline">All GRNs</Link>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {recentGrns.map((grn) => (
              <Link key={grn.id} href={`/inventory/goods-received/${grn.id}`} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-[var(--panel-strong)]/40">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-[var(--ink)]">{grn.grnNumber}</p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">{grn.supplier.name} · {fmt(grn.receivedAt)}</p>
                </div>
                <p className="shrink-0 text-xs text-[var(--ink-muted)]">{grn.po ? poRef(grn.po) : "No PO"}</p>
              </Link>
            ))}
            {recentGrns.length === 0 ? <p className="px-3 py-6 text-center text-sm text-[var(--ink-muted)]">No GRNs posted.</p> : null}
          </div>
        </section>
      </div>
    </ListPageLayout>
  );
}
