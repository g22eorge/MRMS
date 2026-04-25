import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/session";

type InventoryRow = {
  id: string;
  sku: string;
  name: string;
  manufacturer: string | null;
  qtyOnHand: number;
  reorderLevel: number;
  unitCost: number | null;
};

export default async function InventoryPage() {
  const { user } = await getCurrentUserRole();
  if (!["ADMIN", "OPS", "TECHNICIAN_INTERNAL"].includes(user.role)) {
    redirect("/dashboard");
  }

  const [parts, reservationStats] = await Promise.all([
    prisma.part
      .findMany({
        where: { isActive: true },
        select: {
          id: true,
          sku: true,
          name: true,
          manufacturer: true,
          qtyOnHand: true,
          reorderLevel: true,
          unitCost: true,
        },
        orderBy: [{ qtyOnHand: "asc" }, { name: "asc" }],
      })
      .catch(() => [] as InventoryRow[]),
    prisma.partReservation
      .groupBy({
        by: ["status"],
        _count: { status: true },
      })
      .catch(() => []),
  ]);

  const lowStock = parts.filter((part) => part.qtyOnHand <= part.reorderLevel && part.reorderLevel > 0);
  const totalValue = parts.reduce((sum, part) => sum + (part.unitCost ?? 0) * part.qtyOnHand, 0);
  const reservedCount = reservationStats.find((row) => row.status === "RESERVED")?._count.status ?? 0;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <article className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Active Parts</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--ink)]">{parts.length}</p>
        </article>
        <article className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Low Stock</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--accent)]">{lowStock.length}</p>
        </article>
        <article className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Reserved</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--ink)]">{reservedCount}</p>
        </article>
        <article className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">Stock Value</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--ink)]">UGX {Math.round(totalValue).toLocaleString()}</p>
        </article>
      </section>

      <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">Stock Monitor</h2>
            <p className="text-xs text-[var(--ink-muted)]">Parts at or below reorder level are highlighted.</p>
          </div>
          <Link href="/jobs" className="btn-premium-secondary rounded-lg px-3 py-2 text-xs">
            Open Jobs
          </Link>
        </header>

        {parts.length === 0 ? (
          <div className="px-4 py-8 text-sm text-[var(--ink-muted)]">No inventory rows available yet in this environment.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--panel-strong)]/50 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ink-muted)]">
                <tr>
                  <th className="px-4 py-2.5 text-left">Part</th>
                  <th className="px-4 py-2.5 text-left">SKU</th>
                  <th className="px-4 py-2.5 text-left">Maker</th>
                  <th className="px-4 py-2.5 text-right">On Hand</th>
                  <th className="px-4 py-2.5 text-right">Reorder</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((part) => {
                  const isLow = part.reorderLevel > 0 && part.qtyOnHand <= part.reorderLevel;
                  return (
                    <tr key={part.id} className={"border-t border-[var(--line)] transition-colors " + (isLow ? "bg-[var(--accent)]/10" : "hover:bg-[var(--panel-strong)]/40")}>
                      <td className="px-4 py-2.5 text-[var(--ink)]">{part.name}</td>
                      <td className="px-4 py-2.5 text-[var(--ink-muted)]">{part.sku}</td>
                      <td className="px-4 py-2.5 text-[var(--ink-muted)]">{part.manufacturer ?? "-"}</td>
                      <td className="px-4 py-2.5 text-right text-[var(--ink)]">{part.qtyOnHand}</td>
                      <td className="px-4 py-2.5 text-right text-[var(--ink-muted)]">{part.reorderLevel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
