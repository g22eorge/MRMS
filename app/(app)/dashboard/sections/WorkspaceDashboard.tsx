import Link from "next/link";

import type { Role } from "@prisma/client";

import { buildSidebarModel } from "@/lib/nav/sidebar-model";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { SalesPosDashboard } from "./SalesPosDashboard";

/**
 * The dashboard for a staff role in a business that has not chosen the repair
 * module.
 *
 * Operations, front desk, manager and the technician roles each have a
 * dashboard built from repair jobs: queues, pickups, payouts. A shop running
 * point of sale and inventory has none of that, and those pages would show a
 * wall of zeros with links that the module gate bounces. This shows what the
 * person can actually open instead, taken from the same model the menus use so
 * the two cannot disagree.
 *
 * It leads with a few counts for the modules the person can reach: stock
 * running low, invoices waiting to be paid, customers added this week. Counts
 * only, never amounts: these roles' own dashboards differ in what money they
 * may see, and a neutral page must not become the widest of them.
 */
export async function WorkspaceDashboard({
  userId,
  orgId,
  userName,
  role,
  permissions,
  enabledModules,
}: {
  userId: string;
  orgId: string;
  userName: string;
  role: Role;
  permissions: string[];
  enabledModules: Set<string>;
}) {
  const model = buildSidebarModel(role, permissions, enabledModules);
  const places = [...model.pinned, ...model.sections.flatMap((section) => section.items)].filter(
    (item) => item.href !== "/dashboard",
  );
  const showPos = places.some((item) => item.href === "/pos");
  const firstName = userName.split(" ")[0];
  const reaches = (href: string) => places.some((item) => item.href === href || item.href.startsWith(`${href}/`));
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [stock, unpaidInvoices, newClients] = await Promise.all([
    reaches("/inventory")
      ? prisma.$queryRaw<Array<{ low: bigint | number; out: bigint | number }>>`
          SELECT count(*) FILTER (WHERE "qtyOnHand" > 0 AND "reorderLevel" > 0 AND "qtyOnHand" <= "reorderLevel") AS low,
                 count(*) FILTER (WHERE "qtyOnHand" <= 0) AS out
          FROM "Part" WHERE "orgId" = ${orgId} AND "isActive" = true
        `.then((rows) => ({ low: Number(rows[0]?.low ?? 0), out: Number(rows[0]?.out ?? 0) })).catch(() => null)
      : Promise.resolve(null),
    reaches("/documents") && can.viewFinancials({ role, permissions })
      ? prisma.invoice.count({ where: { orgId, status: "ISSUED" } }).catch(() => null)
      : Promise.resolve(null),
    reaches("/clients")
      ? prisma.client.count({ where: { orgId, createdAt: { gte: weekAgo } } }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const counts = [
    stock ? { label: "Low on stock", value: stock.low, href: "/inventory?filter=low", warn: stock.low > 0 } : null,
    stock ? { label: "Out of stock", value: stock.out, href: "/inventory?filter=out", warn: stock.out > 0 } : null,
    unpaidInvoices !== null ? { label: "Invoices unpaid", value: unpaidInvoices, href: "/documents/invoices?status=ISSUED", warn: unpaidInvoices > 0 } : null,
    newClients !== null ? { label: "New clients this week", value: newClients, href: "/clients", warn: false } : null,
  ].filter((entry): entry is { label: string; value: number; href: string; warn: boolean } => entry !== null);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[1.25rem] font-bold tracking-[-0.02em] text-[var(--ink)]">Welcome, {firstName}</h2>
        <p className="mt-0.5 text-[0.8125rem] text-[var(--ink-muted)]">Here is what you can work on.</p>
      </div>

      {counts.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {counts.map((entry) => (
            <Link
              key={entry.label}
              href={entry.href}
              className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 transition hover:bg-[var(--panel-strong)]"
            >
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-[var(--ink-muted)]">{entry.label}</p>
              <p className={`mt-1 text-[1.5rem] font-bold leading-none tabular-nums ${entry.warn ? "text-amber-600 dark:text-amber-400" : "text-[var(--ink)]"}`}>
                {entry.value}
              </p>
            </Link>
          ))}
        </div>
      ) : null}

      {showPos ? <SalesPosDashboard userId={userId} /> : null}

      {places.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {places.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3.5 text-[0.875rem] font-semibold text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--ink-muted)]">
          Nothing has been switched on for your role yet. Ask an administrator.
        </p>
      )}
    </div>
  );
}
