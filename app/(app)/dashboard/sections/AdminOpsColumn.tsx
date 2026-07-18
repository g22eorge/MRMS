import Link from "next/link";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { COMMUNICATIONS_ROUTES } from "@/lib/communications/routes";
import { formatMoneyCompact } from "@/lib/currency";
import { routeLabel } from "@/lib/nav/registry";

import type { AdminDashboardData } from "./admin-data";

/** ADMIN right column: Sales funnel, Inventory, Communications. */
export function AdminOpsColumn({ data }: { data: AdminDashboardData }) {
  const {
    currency,
    leadFunnel, leadCountMap,
    lowStockParts, lowStockItems, outOfStockCount,
    failedOutboxCount, failedOutboxLabel,
  } = data;

  return (
    <div className="flex h-full flex-col gap-4">

      {/* Sales funnel */}
      {(() => {
        const ACTIVE = ["NEW","CONTACTED","QUALIFIED","PROPOSAL_SENT"] as const;
        const SMETA: Record<string, { label: string; dot: string; num: string; href: string }> = {
          NEW:           { label: "New",       dot: "bg-sky-500",    num: "text-sky-500",    href: "/sales/leads?status=NEW" },
          CONTACTED:     { label: "Contacted", dot: "bg-violet-500", num: "text-violet-500", href: "/sales/leads?status=CONTACTED" },
          QUALIFIED:     { label: "Qualified", dot: "bg-amber-500",  num: "text-amber-500",  href: "/sales/leads?status=QUALIFIED" },
          PROPOSAL_SENT: { label: "Proposal",  dot: "bg-orange-500", num: "text-orange-500", href: "/sales/leads?status=PROPOSAL_SENT" },
        };
        const maxC = Math.max(1, ...ACTIVE.map(s => leadCountMap.get(s) ?? 0));
        const pipelineVal = ACTIVE.reduce((sum, s) => {
          const row = (leadFunnel as Array<{ status: string; _sum?: { estimatedValue: number | null } }>).find(r => r.status === s);
          return sum + (row?._sum?.estimatedValue ?? 0);
        }, 0);
        const wonCount  = leadCountMap.get("WON")  ?? 0;
        const lostCount = leadCountMap.get("LOST") ?? 0;
        return (
          <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
              <p className="text-[13px] font-semibold text-[var(--ink)]">Sales funnel</p>
              <Link href="/sales/leads" className="text-[12px] font-semibold text-[var(--accent)]">{routeLabel("/sales/leads")} →</Link>
            </div>
            <div className="grid grid-cols-2 gap-1 p-2">
              {ACTIVE.map((s) => {
                const count = leadCountMap.get(s) ?? 0;
                const m = SMETA[s];
                return (
                  <Link key={s} href={m.href} className="flex flex-col gap-1.5 rounded-lg px-3 py-3 transition hover:bg-[var(--panel-strong)]">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                      <p className="text-[11px] text-[var(--ink-muted)]">{m.label}</p>
                    </div>
                    <p className={`text-[20px] font-bold leading-none tabular-nums ${count === 0 ? "text-[var(--ink-muted)]/40" : m.num}`}>{count}</p>
                    <div className="h-[2px] overflow-hidden rounded-full bg-[var(--panel-strong)]">
                      <div className={`h-full rounded-full ${m.dot} opacity-60`} style={{ width: `${Math.max(4, Math.round(count / maxC * 100))}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="flex items-center gap-4 border-t border-[var(--line)] px-5 py-3">
              <Link href="/sales/leads?status=WON" className="flex items-center gap-1.5 transition hover:opacity-80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <p className={`text-[12px] font-bold ${wonCount > 0 ? "text-emerald-600" : "text-[var(--ink-muted)]"}`}>{wonCount}</p>
                <p className="text-[11px] text-[var(--ink-muted)]">Won</p>
              </Link>
              <Link href="/sales/leads?status=LOST" className="flex items-center gap-1.5 transition hover:opacity-80">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <p className={`text-[12px] font-bold ${lostCount > 0 ? "text-red-500" : "text-[var(--ink-muted)]"}`}>{lostCount}</p>
                <p className="text-[11px] text-[var(--ink-muted)]">Lost</p>
              </Link>
              {pipelineVal > 0 && (
                <div className="ml-auto flex items-center gap-1">
                  <p className="text-[11px] text-[var(--ink-muted)]">Pipeline</p>
                  <p className="text-[12px] font-bold text-[var(--accent)]">{formatMoneyCompact(pipelineVal, currency)}</p>
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* Inventory */}
      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
          <p className="text-[13px] font-semibold text-[var(--ink)]">Inventory</p>
          <Link href="/inventory" className="text-[12px] font-semibold text-[var(--accent)]">View all →</Link>
        </div>
        {/* 3-stat summary row */}
        <div className="grid grid-cols-3 gap-1 p-2">
          {([
            { label: "Tracked", value: lowStockParts.length, tone: "text-[var(--ink)]",                                                              dot: "bg-sky-500",   href: "/inventory" },
            { label: "Low",     value: lowStockItems.length, tone: lowStockItems.length > 0 ? "text-amber-500" : "text-[var(--ink-muted)]",          dot: "bg-amber-500", href: "/inventory?filter=low" },
            { label: "Out",     value: outOfStockCount,      tone: outOfStockCount > 0 ? "text-red-500" : "text-[var(--ink-muted)]",                 dot: "bg-red-500",   href: "/inventory?filter=out" },
          ] as const).map((s) => (
            <Link key={s.label} href={s.href} className="flex flex-col items-center gap-1 rounded-lg py-3.5 transition hover:bg-[var(--panel-strong)]">
              <p className={`text-[20px] font-bold tabular-nums leading-none ${s.tone}`}>{s.value}</p>
              <div className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                <p className="text-[11px] text-[var(--ink-muted)]">{s.label}</p>
              </div>
            </Link>
          ))}
        </div>
        {/* Low-stock alert rows — up to 3 items */}
        {lowStockItems.slice(0, 3).map((part) => {
          const isEmpty = part.qtyOnHand <= 0;
          const pct = part.reorderLevel > 0 ? Math.min(100, Math.round((part.qtyOnHand / part.reorderLevel) * 100)) : 0;
          return (
            <Link key={part.id} href="/inventory"
              className="flex items-center gap-3 border-t border-[var(--line)] px-5 py-3 transition hover:bg-[var(--panel-strong)]">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isEmpty ? "bg-red-500" : "bg-amber-500"}`} />
              <p className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink)]">{part.name}</p>
              <div className="w-12 shrink-0">
                <div className="h-[2px] overflow-hidden rounded-full bg-[var(--panel-strong)]">
                  <div className={`h-full rounded-full ${isEmpty ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${Math.max(2, pct)}%` }} />
                </div>
              </div>
              <p className={`w-6 shrink-0 text-right text-[12px] font-bold tabular-nums ${isEmpty ? "text-red-500" : "text-amber-500"}`}>{part.qtyOnHand}</p>
            </Link>
          );
        })}
        {lowStockItems.length > 3 && (
          <Link href="/inventory" className="block border-t border-[var(--line)] px-5 py-2 text-center text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[var(--panel-strong)]">
            +{lowStockItems.length - 3} more →
          </Link>
        )}
      </section>

      {/* Communications */}
      <section className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <p className="text-[13px] font-semibold text-[var(--ink)]">Communications</p>
            <StatusBadge tone={failedOutboxCount > 0 ? "danger" : "success"} dot>
              {failedOutboxCount > 0 ? failedOutboxLabel : "Healthy"}
            </StatusBadge>
          </div>
          <Link href={COMMUNICATIONS_ROUTES.outbox} className="text-[12px] font-semibold text-[var(--accent)]">Outbox →</Link>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {([
            { dot: "bg-emerald-500", label: "WhatsApp",  href: COMMUNICATIONS_ROUTES.whatsapp },
            { dot: "bg-sky-500",     label: "Outbox",    href: COMMUNICATIONS_ROUTES.outbox },
            { dot: "bg-violet-500",  label: "Templates", href: COMMUNICATIONS_ROUTES.templates },
            { dot: "bg-amber-500",   label: "Policies",  href: COMMUNICATIONS_ROUTES.policies },
          ] as const).map((row) => (
            <Link key={row.label} href={row.href} className="flex items-center gap-3 px-5 py-3 transition hover:bg-[var(--panel-strong)]">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.dot}`} />
              <p className="flex-1 text-[13px] font-medium text-[var(--ink)]">{row.label}</p>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--ink-muted)]/30"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
