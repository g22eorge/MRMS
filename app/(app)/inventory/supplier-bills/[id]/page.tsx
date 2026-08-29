import Link from "next/link";
import { landedCost } from "@/lib/inventory/landed-cost";
import { formatMoney } from "@/lib/currency";
import { notFound, redirect } from "next/navigation";

import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { RecordActionBar } from "@/components/record/RecordActionBar";
import { RowActionsMenu, MenuDestructiveRow } from "@/components/shared/RowActionsMenu";
import { ConfirmSubmitButton } from "@/components/shared/ConfirmSubmitButton";
import { RecordPreviewButton } from "@/components/record/RecordPreviewButton";
import { cancelSupplierBillAction, createSupplierPaymentAction, deleteSupplierPaymentAction } from "../actions";

import { SubmitButton } from "@/components/ui/SubmitButton";
export const dynamic = "force-dynamic";

export default async function SupplierBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, orgId, org } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const bill = await prisma.supplierBill.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      po: { select: { id: true, reference: true } },
      grn: { select: { id: true, grnNumber: true } },
      createdBy: { select: { name: true, email: true } },
      items: { orderBy: { createdAt: "asc" } },
      payments: {
        include: { createdBy: { select: { name: true, email: true } } },
        orderBy: { paidAt: "desc" },
      },
    },
  }).catch(() => null);
  if (!bill || bill.orgId !== orgId) notFound();

  const fmt = (d: Date | null) => d ? d.toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" }) : "-";
  const balance = bill.totalAmount - bill.paidAmount;

  // Landed cost, for pricing. The books treat a transfer charge as a finance
  // cost so that cost of sales stays the cost of the goods; pricing needs the
  // opposite view, because an item bought abroad cost the goods plus the spread
  // plus the bank's charge, and pricing off the invoice value alone sells at a
  // loss on every consignment. Computed here and never written back over a
  // stored unit cost, which would rewrite the margin on stock already sold.
  const baseCurrency = org.baseCurrency ?? "UGX";
  const feesBase = bill.payments.reduce((sum, p) => sum + (p.feeAmount ?? 0), 0);
  // The rate that was actually settled, taken from the payments made on this
  // bill; a bill already in base currency needs none.
  const settledRate = bill.currency === baseCurrency
    ? null
    : (bill.payments.find((p) => p.exchangeRateToBase && p.exchangeRateToBase > 0)?.exchangeRateToBase
        ?? bill.exchangeRateToBase
        ?? null);
  const landed = landedCost({
    baseCurrency,
    currency: bill.currency,
    exchangeRateToBase: settledRate,
    feesBase,
    lines: bill.items.map((i) => ({ id: i.id, quantity: i.quantity, lineTotal: i.lineTotal })),
  });
  const landedById = new Map(landed.lines.map((l) => [l.id, l]));
  const showLanded = feesBase > 0 || bill.currency !== baseCurrency;

  return (
    <div className="max-w-4xl space-y-6">
      <RecordActionBar
        backHref="/inventory/supplier-bills"
        eyebrow="Inventory · Supplier Bill"
        title={bill.billNumber}
        status={{ label: bill.status, tone: bill.status === "PAID" ? "success" : bill.status === "CANCELLED" ? "danger" : bill.status === "PART_PAID" ? "warning" : "sky" }}
        secondary={
          <>
            <RecordPreviewButton variant="button" label="Preview" pdfUrl={`/api/procurement/documents/supplier-bill/${bill.id}`} title={`Supplier Bill ${bill.billNumber}`} />
            <Link href={`/api/procurement/documents/supplier-bill/${bill.id}`} target="_blank" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">
              Print / PDF
            </Link>
          </>
        }
        overflow={
          bill.status !== "CANCELLED" && bill.paidAmount === 0 ? (
            <RowActionsMenu label={`Supplier bill actions for ${bill.billNumber}`} size="compact">
              <MenuDestructiveRow>
                <form action={cancelSupplierBillAction}>
                  <input type="hidden" name="id" value={bill.id} />
                  <ConfirmSubmitButton message="Cancel this supplier bill? This can't be undone." confirmLabel="Cancel bill" className="w-full text-left text-[0.75rem] text-red-600">Cancel Bill</ConfirmSubmitButton>
                </form>
              </MenuDestructiveRow>
            </RowActionsMenu>
          ) : undefined
        }
      />
      <p className="text-sm text-[var(--ink-muted)]">Supplier: <Link href={`/inventory/suppliers/${bill.supplier.id}`} className="text-[var(--accent)] hover:underline">{bill.supplier.name}</Link></p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2"><p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Issued</p><p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{fmt(bill.issuedAt)}</p></div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2"><p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Due</p><p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{fmt(bill.dueAt)}</p></div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2"><p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Total</p><p className="mt-0.5 text-sm font-semibold text-[var(--ink)] tabular-nums">{bill.currency} {bill.totalAmount.toLocaleString()}</p></div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2"><p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Balance</p><p className="mt-0.5 text-sm font-semibold text-[var(--ink)] tabular-nums">{bill.currency} {balance.toLocaleString()}</p></div>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
        {showLanded ? (
          <div className="border-b border-[var(--line)] bg-[var(--panel-strong)] px-5 py-3">
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Landed cost · for pricing</p>
            <p className="mt-1 text-[0.8125rem] text-[var(--ink)]">
              Goods <span className="font-semibold tabular-nums">{formatMoney(landed.goodsBase, baseCurrency)}</span>
              {" + "}charges <span className="font-semibold tabular-nums">{formatMoney(landed.feesBase, baseCurrency)}</span>
              {" = "}<span className="font-semibold tabular-nums text-[var(--accent)]">{formatMoney(landed.landedBase, baseCurrency)}</span>
            </p>
            <p className="mt-1 text-[0.75rem] text-[var(--ink-muted)]">
              {settledRate
                ? `Settled at ${settledRate.toLocaleString()} ${baseCurrency} per ${bill.currency}, derived from what left the account.`
                : `Charges apportioned across lines by value.`}
              {" "}The books post charges as a finance cost, so this figure is deliberately higher than cost of sales.
            </p>
          </div>
        ) : null}
        <div className="px-5 py-3 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Bill Lines</p>
          <div className="flex gap-2 text-xs font-semibold">
            {bill.po ? <Link href={`/inventory/purchase-orders/${bill.po.id}`} className="text-[var(--accent)] hover:underline">{bill.po.reference ?? "Purchase Order"}</Link> : null}
            {bill.grn ? <Link href={`/inventory/goods-received/${bill.grn.id}`} className="text-[var(--accent)] hover:underline">{bill.grn.grnNumber}</Link> : null}
          </div>
        </div>
        <DataTable
          frameless
          rows={bill.items}
          getRowKey={(item) => item.id}
          empty="No lines on this bill."
          columns={[
            { key: "description", header: "Description", className: "text-[var(--ink)]", cell: (item) => item.description },
            { key: "qty", header: "Qty", align: "right", className: "tabular-nums text-[var(--ink-muted)]", cell: (item) => item.quantity },
            { key: "unitCost", header: "Unit Cost", align: "right", className: "tabular-nums text-[var(--ink-muted)]", cell: (item) => item.unitCost.toLocaleString() },
            { key: "total", header: "Total", align: "right", className: "tabular-nums font-semibold text-[var(--ink)]", cell: (item) => item.lineTotal.toLocaleString() },
            // Only shown when it differs from the invoice value — on a
            // base-currency bill with no charges the two are the same number
            // and a second column of it is noise.
            ...(showLanded
              ? [{
                  key: "landed",
                  header: `Landed / unit (${baseCurrency})`,
                  align: "right" as const,
                  className: "tabular-nums font-semibold text-[var(--accent)]",
                  cell: (item: (typeof bill.items)[number]) => {
                    const l = landedById.get(item.id);
                    return l ? formatMoney(l.landedUnitBase, baseCurrency) : "—";
                  },
                }]
              : []),
          ]}
          tableFooter={
            <>
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-[0.75rem] font-semibold text-[var(--ink-muted)]">Subtotal</td>
                <td className="px-4 py-2 text-right font-bold text-[var(--ink)] tabular-nums">{bill.subtotal.toLocaleString()}</td>
              </tr>
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-[0.75rem] font-semibold text-[var(--ink-muted)]">Tax</td>
                <td className="px-4 py-2 text-right font-bold text-[var(--ink)] tabular-nums">{bill.taxAmount.toLocaleString()}</td>
              </tr>
            </>
          }
        />
      </div>

      {bill.notes ? <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4"><p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)] mb-1">Notes</p><p className="text-sm text-[var(--ink)] whitespace-pre-wrap">{bill.notes}</p></div> : null}

      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--line)] flex items-center justify-between gap-2">
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Payments ({bill.payments.length})</p>
          <p className="text-xs font-semibold text-[var(--ink-muted)]">Paid {bill.currency} {bill.paidAmount.toLocaleString()}</p>
        </div>
        {balance > 0 && bill.status !== "CANCELLED" ? (
          <form action={createSupplierPaymentAction} className="grid gap-2 border-b border-[var(--line)] p-4 sm:grid-cols-[0.8fr_0.8fr_1fr_1fr_auto]">
            <input type="hidden" name="billId" value={bill.id} />
            <input name="amount" type="number" min={0.01} max={balance} step={0.01} placeholder={`Max ${balance.toLocaleString()}`} required className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-right text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
            <select name="method" defaultValue="BANK_TRANSFER" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60">
              <option value="CASH">Cash</option>
              <option value="MOBILE_MONEY">Mobile money</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
            <input name="reference" placeholder="Reference" className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
            <input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
            <SubmitButton bare className="btn-premium rounded-lg px-4 py-1.5 text-[0.8125rem] font-semibold">Record</SubmitButton>
            <input name="note" placeholder="Payment note" className="sm:col-span-5 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] outline-none focus:border-[var(--accent)]/60" />
          </form>
        ) : null}
        <DataTable
          frameless
          rows={bill.payments}
          getRowKey={(payment) => payment.id}
          empty="No payments recorded yet."
          columns={[
            { key: "date", header: "Date", className: "text-[var(--ink)]", cell: (payment) => fmt(payment.paidAt) },
            { key: "method", header: "Method", className: "text-[0.75rem] font-semibold text-[var(--ink-muted)]", cell: (payment) => payment.method },
            {
              key: "reference",
              header: "Reference",
              className: "hidden sm:table-cell text-[0.75rem] text-[var(--ink-muted)]",
              headerClassName: "hidden sm:table-cell",
              cell: (payment) => payment.reference ?? "-",
            },
            { key: "amount", header: "Amount", align: "right", className: "font-semibold tabular-nums text-[var(--ink)]", cell: (payment) => `${payment.currency} ${payment.amount.toLocaleString()}` },
          ]}
          actions={(payment) => (
            <form action={deleteSupplierPaymentAction}>
              <input type="hidden" name="id" value={payment.id} />
              <input type="hidden" name="billId" value={bill.id} />
              <ConfirmSubmitButton message="Delete this payment? The recorded amount will be reversed and this can't be undone." confirmLabel="Delete payment" className="font-semibold text-red-600 hover:text-red-700">Delete</ConfirmSubmitButton>
            </form>
          )}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ink-muted)]">
        <p>Posted by {bill.createdBy.name || bill.createdBy.email}.</p>
      </div>
    </div>
  );
}
