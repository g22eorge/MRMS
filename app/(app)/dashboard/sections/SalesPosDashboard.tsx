import Link from "next/link";

import { StickyKpiRow } from "@/components/mobile/StickyKpiRow";
import { formatMoney, getAppCurrency } from "@/lib/currency";
import { prisma } from "@/lib/prisma";

import { DashboardHero } from "./shared";

export async function SalesPosDashboard({ userId }: { userId: string }) {
  const currency = getAppCurrency();
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

  const [openSession, todaySalesAgg] = await Promise.all([
    prisma.posSession.findFirst({
      where: { operatorId: userId, status: "OPEN" },
      select: { id: true, totalSales: true, salesCount: true, openedAt: true },
    }).catch(() => null),
    prisma.posSession.aggregate({
      _sum: { totalSales: true },
      where: { operatorId: userId, openedAt: { gte: todayStart } },
    }).catch(() => ({ _sum: { totalSales: null } })),
  ]);

  const todaySales = todaySalesAgg._sum.totalSales ?? 0;
  const sessionsToday = await prisma.posSession.count({
    where: { operatorId: userId, openedAt: { gte: todayStart } },
  }).catch(() => 0);

  return (
    <div className="space-y-4">
      <DashboardHero
        title="Point of Sale"
        summary="Open a new session to start taking sales, or continue your active session."
        primaryHref="/pos"
        primaryLabel={openSession ? "Continue Session" : "Open New Session"}
      />

      <StickyKpiRow
        items={[
          { label: "Today's Sales", value: formatMoney(todaySales, currency), href: "/pos", tone: "success" },
          { label: "Sessions Today", value: String(sessionsToday), href: "/pos" },
        ]}
      />

      {openSession ? (
        <Link href="/pos" className="panel-shadow block rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">Active Session</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Total Sales</p>
              <p className="mt-1 text-xl font-semibold text-[var(--accent)]">{formatMoney(openSession.totalSales, currency)}</p>
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Sales Count</p>
              <p className="mt-1 text-xl font-semibold text-[var(--ink)]">{openSession.salesCount}</p>
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">Opened At</p>
              <p className="mt-1 text-xl font-semibold text-[var(--ink)]">
                {openSession.openedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs font-medium text-[var(--accent)]">Continue session →</p>
        </Link>
      ) : (
        <Link href="/pos" className="panel-shadow block rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition hover:-translate-y-[2px] sm:p-5">
          <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">No Active Session</p>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">Open a new POS session to start recording sales.</p>
          <p className="mt-3 text-xs font-medium text-[var(--accent)]">Open session →</p>
        </Link>
      )}
    </div>
  );
}
