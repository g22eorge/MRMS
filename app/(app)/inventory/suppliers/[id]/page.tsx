import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DataTable } from "@/components/ui/DataTable";
import { toneFor, type BadgeTone } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { RecordActionBar } from "@/components/record/RecordActionBar";
import { SupplierEditForm } from "./SupplierEditForm";
import { SupplierActivityFeed, type SupplierActivityItem } from "./SupplierActivityFeed";
import { createSupplierPriceAction, deleteSupplierPriceAction, updateSupplierPriceAction } from "../actions";

export const dynamic = "force-dynamic";

const PO_STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  ORDERED: "info",
  PARTIAL: "warning",
  RECEIVED: "success",
  CANCELLED: "danger",
};

const BILL_STATUS_TONES: Record<string, BadgeTone> = {
  POSTED: "sky",
  PART_PAID: "warning",
  PAID: "success",
  CANCELLED: "danger",
};

const REQUEST_STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  SUBMITTED: "sky",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
  CONVERTED: "violet",
};

const GRN_STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  POSTED: "success",
  CANCELLED: "danger",
};

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const qs = (((await searchParams?.catch(() => ({}))) ?? {}) as Record<string, string | string[] | undefined>);
  const { user, orgId } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const supplier = await prisma.supplier.findFirst({
    where: { id, orgId },
    include: {
      _count: {
        select: {
          purchaseOrders: true,
          purchaseRequests: true,
          supplierBills: true,
          goodsReceivedNotes: true,
        },
      },
      purchaseOrders: {
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          reference: true,
          status: true,
          orderedAt: true,
          expectedAt: true,
          createdAt: true,
          items: { select: { qtyOrdered: true, qtyReceived: true, unitCost: true } },
          _count: { select: { items: true } },
        },
      },
      purchaseRequests: {
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          requestNumber: true,
          status: true,
          priority: true,
          neededBy: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      },
      supplierBills: {
        orderBy: { issuedAt: "desc" },
        take: 8,
        select: {
          id: true,
          billNumber: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          issuedAt: true,
          dueAt: true,
          currency: true,
        },
      },
      goodsReceivedNotes: {
        orderBy: { receivedAt: "desc" },
        take: 6,
        select: {
          id: true,
          grnNumber: true,
          status: true,
          receivedAt: true,
          _count: { select: { items: true } },
        },
      },
    },
  }).catch(() => null);

  if (!supplier) notFound();

  const [prices, parts, billTotals, overdueBillCount, openPoCount] = await Promise.all([
    prisma.supplierPrice.findMany({ where: { orgId, supplierId: supplier.id }, orderBy: { validFrom: "desc" } }),
    prisma.part.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, sku: true, name: true } }),
    prisma.supplierBill.groupBy({
      by: ["currency"],
      where: { orgId, supplierId: supplier.id, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.supplierBill.count({
      where: { orgId, supplierId: supplier.id, dueAt: { lt: new Date() }, status: { notIn: ["PAID", "CANCELLED"] } },
    }),
    prisma.purchaseOrder.count({
      where: { orgId, supplierId: supplier.id, status: { in: ["DRAFT", "ORDERED", "PARTIAL"] } },
    }),
  ]);

  const partLabel = new Map(parts.map((part) => [part.id, `${part.sku} · ${part.name}`]));
  // Balances are per-currency — never sum UGX and USD bills into one figure.
  const balancesByCurrency = billTotals
    .map((row) => ({
      currency: row.currency ?? "UGX",
      balance: Math.max(0, (row._sum.totalAmount ?? 0) - (row._sum.paidAmount ?? 0)),
    }))
    .filter((row) => row.balance > 0);
  const supplierBalance = balancesByCurrency.reduce((sum, row) => sum + row.balance, 0);
  const supplierBalanceLabel = balancesByCurrency.length === 0
    ? formatMoney(0)
    : balancesByCurrency.map((row) => formatMoney(row.balance, row.currency)).join(" + ");
  const leadTimes = prices.map((price) => price.leadTimeDays).filter((days): days is number => days != null);
  const averageLeadDays = leadTimes.length > 0 ? Math.round(leadTimes.reduce((sum, days) => sum + days, 0) / leadTimes.length) : null;
  const recentPoValue = supplier.purchaseOrders.reduce(
    (sum, po) => sum + po.items.reduce((lineSum, item) => lineSum + item.qtyOrdered * item.unitCost, 0),
    0,
  );
  const lastActivityAt = [
    supplier.updatedAt,
    ...supplier.purchaseOrders.map((po) => po.createdAt),
    ...supplier.purchaseRequests.map((request) => request.createdAt),
    ...supplier.supplierBills.map((bill) => bill.issuedAt),
    ...supplier.goodsReceivedNotes.map((grn) => grn.receivedAt),
  ].sort((a, b) => b.getTime() - a.getTime())[0];

  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "-";

  // One time-ordered activity feed across POs, bills, requests and GRNs.
  const activityItems: SupplierActivityItem[] = [
    ...supplier.purchaseOrders.map((po) => {
      const ordered = po.items.reduce((sum, item) => sum + item.qtyOrdered, 0);
      const received = po.items.reduce((sum, item) => sum + item.qtyReceived, 0);
      return {
        key: `po-${po.id}`,
        type: "PO" as const,
        label: po.reference ?? po.id.slice(-6).toUpperCase(),
        href: `/inventory/purchase-orders/${po.id}`,
        dateMs: (po.orderedAt ?? po.createdAt).getTime(),
        dateLabel: fmt(po.orderedAt ?? po.createdAt),
        status: po.status,
        tone: toneFor(PO_STATUS_TONES, po.status),
        amount: formatMoney(po.items.reduce((sum, item) => sum + item.qtyOrdered * item.unitCost, 0)),
        sub: `${received}/${ordered} received`,
      };
    }),
    ...supplier.supplierBills.map((bill) => ({
      key: `bill-${bill.id}`,
      type: "BILL" as const,
      label: bill.billNumber,
      href: `/inventory/supplier-bills/${bill.id}`,
      dateMs: bill.issuedAt.getTime(),
      dateLabel: `${fmt(bill.issuedAt)} · due ${fmt(bill.dueAt)}`,
      status: bill.status,
      tone: toneFor(BILL_STATUS_TONES, bill.status, "sky"),
      amount: formatMoney(bill.totalAmount, bill.currency),
      sub: `bal ${formatMoney(Math.max(0, bill.totalAmount - bill.paidAmount), bill.currency)}`,
    })),
    ...supplier.purchaseRequests.map((request) => ({
      key: `req-${request.id}`,
      type: "REQUEST" as const,
      label: request.requestNumber,
      href: `/inventory/purchase-requests/${request.id}`,
      dateMs: request.createdAt.getTime(),
      dateLabel: `${request.priority} · needed ${fmt(request.neededBy)}`,
      status: request.status,
      tone: toneFor(REQUEST_STATUS_TONES, request.status, "sky"),
      sub: `${request._count.items} lines`,
    })),
    ...supplier.goodsReceivedNotes.map((grn) => ({
      key: `grn-${grn.id}`,
      type: "GRN" as const,
      label: grn.grnNumber,
      href: `/inventory/goods-received/${grn.id}`,
      dateMs: grn.receivedAt.getTime(),
      dateLabel: fmt(grn.receivedAt),
      status: grn.status,
      tone: toneFor(GRN_STATUS_TONES, grn.status, "success"),
      sub: `${grn._count.items} lines`,
    })),
  ].sort((a, b) => b.dateMs - a.dateMs);

  return (
    <div className="space-y-4">
      <RecordActionBar
        backHref="/inventory/suppliers"
        eyebrow="Inventory · Supplier"
        title={supplier.name}
        status={{ label: supplier.isActive ? "Active" : "Inactive", tone: supplier.isActive ? "success" : "neutral" }}
        secondary={
          supplier.isActive ? (
            <>
              <Link href={`/inventory/purchase-orders/new?supplierId=${supplier.id}`} className="btn-premium rounded-lg px-3 py-2 text-xs font-semibold">New PO</Link>
              <Link href={`/inventory/supplier-bills/new?supplierId=${supplier.id}`} className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/15">New Bill</Link>
            </>
          ) : undefined
        }
      />

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Open POs" value={openPoCount.toLocaleString()} hint={`${supplier._count.purchaseOrders.toLocaleString()} total`} tone={openPoCount > 0 ? "amber" : "neutral"} />
        <Metric label="Bill Balance" value={supplierBalanceLabel} hint={`${overdueBillCount} overdue`} tone={supplierBalance > 0 ? "amber" : "green"} />
        <Metric label="Price Lines" value={prices.length.toLocaleString()} hint={averageLeadDays != null ? `${averageLeadDays}d avg lead` : "no lead times"} tone="neutral" />
        <Metric label="Recent PO Value" value={formatMoney(recentPoValue)} hint="latest 12 orders" tone="neutral" />
        <Metric label="Last Activity" value={fmt(lastActivityAt)} hint={`${supplier._count.goodsReceivedNotes} GRNs`} tone="neutral" />
      </section>

      {typeof qs.error === "string" ? <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">{qs.error}</div> : null}
      {String(qs.priceCreated ?? "") === "1" ? <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">Supplier price added.</div> : null}
      {String(qs.priceSaved ?? "") === "1" ? <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">Supplier price updated.</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <section className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Contact</p>
              <span className="rounded-md border border-[var(--line)] px-2 py-1 text-[11px] font-semibold text-[var(--ink-muted)]">Since {fmt(supplier.createdAt)}</span>
            </div>
            <div className="mt-3 divide-y divide-[var(--line)]">
              <InfoRow label="Person">{supplier.contactName || "-"}</InfoRow>
              <InfoRow label="Phone">{supplier.phone ? <a href={`tel:${supplier.phone}`} className="font-semibold text-[var(--ink)] hover:text-[var(--accent)]">{supplier.phone}</a> : "-"}</InfoRow>
              <InfoRow label="Email">{supplier.email ? <a href={`mailto:${supplier.email}`} className="font-semibold text-[var(--ink)] hover:text-[var(--accent)]">{supplier.email}</a> : "-"}</InfoRow>
              <InfoRow label="Address">{supplier.address || "-"}</InfoRow>
            </div>
            {supplier.notes ? (
              <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--ink)]">{supplier.notes}</p>
              </div>
            ) : null}
          </section>

          <SupplierEditForm supplier={supplier} />
        </div>

        <div className="space-y-4">
          <section id="price-list" className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Price List</p>
                <p className="text-[13px] text-[var(--ink-muted)]">{prices.length} supplier terms captured</p>
              </div>
              {averageLeadDays != null ? <span className="rounded-md border border-[var(--line)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-muted)]">{averageLeadDays}d avg lead</span> : null}
            </div>

            <form action={createSupplierPriceAction} className="grid gap-2 border-b border-[var(--line)] p-3 md:grid-cols-[1.2fr_1fr_0.7fr_0.55fr_0.55fr_0.55fr_auto]">
              <input type="hidden" name="supplierId" value={supplier.id} />
              <select name="partId" className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]/60">
                <option value="">No linked item</option>
                {parts.map((part) => <option key={part.id} value={part.id}>{part.sku} · {part.name}</option>)}
              </select>
              <input name="description" placeholder="Description *" required className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]/60" />
              <input name="sku" placeholder="SKU" className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]/60" />
              <input name="unitCost" placeholder="Cost *" required inputMode="decimal" className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]/60" />
              <input name="minQuantity" placeholder="MOQ" inputMode="numeric" className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]/60" />
              <input name="leadTimeDays" placeholder="Lead" inputMode="numeric" className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]/60" />
              <button type="submit" className="btn-premium rounded-lg px-4 py-2 text-[13px] font-semibold">Add</button>
            </form>

            <DataTable
              frameless
              rows={prices}
              getRowKey={(price) => price.id}
              rowClassName={() => "align-top"}
              empty="No supplier prices yet."
              columns={[
                {
                  key: "item",
                  header: "Item",
                  cell: (price) => (
                    <>
                      <p className="font-semibold text-[var(--ink)]">{price.partId ? partLabel.get(price.partId) ?? price.description : price.description}</p>
                      <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">{price.sku ?? "No SKU"} · valid from {fmt(price.validFrom)}</p>
                    </>
                  ),
                },
                { key: "unitCost", header: "Unit Cost", align: "right", className: "font-semibold tabular-nums text-[var(--ink)]", cell: (price) => formatMoney(price.unitCost, price.currency) },
                { key: "moq", header: "MOQ", align: "right", className: "text-[var(--ink-muted)]", cell: (price) => price.minQuantity ?? "-" },
                { key: "lead", header: "Lead", align: "right", className: "text-[var(--ink-muted)]", cell: (price) => (price.leadTimeDays != null ? `${price.leadTimeDays}d` : "-") },
              ]}
              actions={(price) => (
                <RowActionsMenu label={`Supplier price actions for ${price.description}`}>
                  <div className="w-72 p-3">
                    <form action={updateSupplierPriceAction} className="grid gap-2 text-left">
                      <input type="hidden" name="id" value={price.id} />
                      <input type="hidden" name="supplierId" value={supplier.id} />
                      <select name="partId" defaultValue={price.partId ?? ""} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 outline-none focus:border-[var(--accent)]/60">
                        <option value="">No linked item</option>
                        {parts.map((part) => <option key={part.id} value={part.id}>{part.sku} · {part.name}</option>)}
                      </select>
                      <input name="description" defaultValue={price.description} required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 outline-none focus:border-[var(--accent)]/60" />
                      <input name="sku" defaultValue={price.sku ?? ""} placeholder="SKU" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 outline-none focus:border-[var(--accent)]/60" />
                      <input name="unitCost" defaultValue={price.unitCost} required inputMode="decimal" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 outline-none focus:border-[var(--accent)]/60" />
                      <div className="grid grid-cols-2 gap-2">
                        <input name="minQuantity" defaultValue={price.minQuantity ?? ""} placeholder="MOQ" inputMode="numeric" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 outline-none focus:border-[var(--accent)]/60" />
                        <input name="leadTimeDays" defaultValue={price.leadTimeDays ?? ""} placeholder="Lead days" inputMode="numeric" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 outline-none focus:border-[var(--accent)]/60" />
                      </div>
                      <input name="currency" defaultValue={price.currency} placeholder="Currency" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 uppercase outline-none focus:border-[var(--accent)]/60" />
                      <button type="submit" className="btn-premium rounded-lg px-3 py-1.5 font-semibold">Save Price</button>
                    </form>
                    <form action={deleteSupplierPriceAction} className="mt-2 border-t border-[var(--line)] pt-2">
                      <input type="hidden" name="id" value={price.id} />
                      <input type="hidden" name="supplierId" value={supplier.id} />
                      <button type="submit" className="font-semibold text-red-600 hover:text-red-700">Delete</button>
                    </form>
                  </div>
                </RowActionsMenu>
              )}
            />
          </section>

          <SupplierActivityFeed
            items={activityItems}
            newPoHref={`/inventory/purchase-orders/new?supplierId=${supplier.id}`}
            newBillHref={`/inventory/supplier-bills/new?supplierId=${supplier.id}`}
          />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: "neutral" | "amber" | "green" }) {
  const color = tone === "amber" ? "text-amber-600" : tone === "green" ? "text-emerald-600" : "text-[var(--ink)]";
  return (
    <div className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
      <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
      <p className={`mt-1 truncate text-lg font-black tabular-nums ${color}`}>{value}</p>
      <p className="mt-0.5 truncate text-[12px] text-[var(--ink-muted)]">{hint}</p>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-3 py-2 text-sm">
      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">{label}</p>
      <div className="min-w-0 whitespace-pre-wrap text-[var(--ink)]">{children}</div>
    </div>
  );
}
