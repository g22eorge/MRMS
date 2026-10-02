import { redirect } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { NewSupplierBillForm } from "./NewSupplierBillForm";

export const dynamic = "force-dynamic";

export default async function NewSupplierBillPage({
  searchParams,
}: {
  searchParams: Promise<{ supplierId?: string; poId?: string; grnId?: string }>;
}) {
  const { user, orgId, org } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");
  const params = await searchParams;

  const [suppliers, purchaseOrders, goodsReceived] = await Promise.all([
    prisma.supplier.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.purchaseOrder.findMany({
      where: { orgId, status: { in: ["ORDERED", "PARTIAL", "RECEIVED"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        supplierId: true,
        reference: true,
        items: {
          orderBy: { createdAt: "asc" },
          select: { description: true, qtyOrdered: true, unitCost: true },
        },
      },
    }).catch(() => []),
    prisma.goodsReceived.findMany({
      where: { orgId, status: "POSTED" },
      orderBy: { receivedAt: "desc" },
      select: {
        id: true,
        supplierId: true,
        poId: true,
        grnNumber: true,
        items: {
          orderBy: { createdAt: "asc" },
          select: { description: true, quantity: true, unitCost: true },
        },
      },
    }).catch(() => []),
  ]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Inventory · Supplier Bill</p>
            <h1 className="text-base font-bold text-[var(--ink)]">New supplier bill</h1>
          </div>
          <Link href="/inventory/supplier-bills" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">All bills</Link>
        </div>
      </div>
      <NewSupplierBillForm
        suppliers={suppliers}
        purchaseOrders={purchaseOrders}
        goodsReceived={goodsReceived}
        defaultSupplierId={params.supplierId}
        defaultPoId={params.poId}
        defaultGrnId={params.grnId}
        baseCurrency={org.baseCurrency}
      />
    </div>
  );
}
