import { redirect } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { can } from "@/lib/permissions";
import { NewStockCountForm } from "./NewStockCountForm";

export const dynamic = "force-dynamic";

export default async function NewStockCountPage() {
  const { user, orgId } = await requireOrgSession();
  if (!can.manageInventory(user)) redirect("/inventory");

  const [locations, parts] = await Promise.all([
    prisma.stockLocation.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }).catch(() => []),
    prisma.part.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, sku: true, name: true, qtyOnHand: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">Inventory · Stock Count</p>
            <h1 className="text-base font-bold text-[var(--ink)]">New stock count</h1>
          </div>
          <div className="flex items-center gap-2">
            <p className="hidden text-xs text-[var(--ink-muted)] sm:block">Record physical counts and submit variances for approval.</p>
            <Link href="/inventory/stock-counts" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]">All counts</Link>
          </div>
        </div>
      </div>
      <NewStockCountForm locations={locations} parts={parts.map((part) => ({ id: part.id, sku: part.sku, name: part.name, qty: part.qtyOnHand }))} />
    </div>
  );
}
