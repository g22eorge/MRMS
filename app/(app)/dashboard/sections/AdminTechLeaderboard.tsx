import Link from "next/link";

import { formatMoneyCompact } from "@/lib/currency";
import { monthLabel } from "@/lib/date-ranges";
import { DataTable } from "@/components/ui/DataTable";

import type { AdminDashboardData } from "./admin-data";

/** ADMIN technician leaderboard (mobile cards + desktop table). */
export function AdminTechLeaderboard({ data }: { data: AdminDashboardData }) {
  const { currency, today, techLeaderboard } = data;

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
        <p className="text-[13px] font-semibold text-[var(--ink)]">
          Technicians <span className="font-normal text-[var(--ink-muted)]">· {monthLabel(today.getFullYear(), today.getMonth() + 1)}</span>
        </p>
        <Link href="/technicians" className="text-[12px] font-semibold text-[var(--accent)]">Leaderboard →</Link>
      </div>
      <DataTable
        frameless
        dense
        rows={techLeaderboard}
        getRowKey={(tech) => tech.name}
        empty="No completed jobs this month."
        columns={[
          {
            key: "rank",
            header: "#",
            className: "text-[13px] font-bold text-[var(--ink-muted)]",
            cell: (_tech, i) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`),
          },
          {
            key: "technician",
            header: "Technician",
            cell: (tech) => (
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[13px] font-bold text-[var(--accent)]">
                  {tech.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-[var(--ink)]">{tech.name}</span>
              </div>
            ),
          },
          {
            key: "done",
            header: "Done",
            align: "center",
            className: "text-sm font-bold text-emerald-600",
            cell: (tech) => tech.count,
          },
          {
            key: "active",
            header: "Active",
            align: "center",
            cell: (tech) => (
              <span className={`text-sm font-bold ${tech.pending > 0 ? "text-amber-600" : "text-[var(--ink-muted)]"}`}>
                {tech.pending}
              </span>
            ),
          },
          {
            key: "avgTat",
            header: "Avg TAT",
            align: "center",
            className: "text-xs text-[var(--ink-muted)]",
            cell: (tech) => (tech.count > 0 ? `${(tech.totalDays / tech.count).toFixed(1)}d` : "—"),
          },
          {
            key: "revenue",
            header: "Revenue",
            align: "right",
            className: "text-xs font-semibold text-[var(--ink)]",
            cell: (tech) => formatMoneyCompact(tech.revenue, currency),
          },
          {
            key: "payoutDue",
            header: "Payout Due",
            align: "right",
            cell: (tech) => (
              <span className={`text-xs font-bold ${tech.payoutDue > 0 ? "text-red-500" : "text-[var(--ink-muted)]"}`}>
                {formatMoneyCompact(tech.payoutDue, currency)}
              </span>
            ),
          },
        ]}
        renderMobileCard={(tech, i) => {
          const avgDays = tech.count > 0 ? (tech.totalDays / tech.count).toFixed(1) : null;
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
          return (
            <div className="flex items-center gap-3 px-5 py-3">
              {/* Avatar + rank */}
              <div className="relative shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[13px] font-black text-[var(--accent)]">
                  {tech.name.charAt(0).toUpperCase()}
                </div>
                {medal && (
                  <span className="absolute -right-1 -top-1 text-[12px] leading-none">{medal}</span>
                )}
                {!medal && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--panel-strong)] text-[13px] font-bold text-[var(--ink-muted)]">
                    {i + 1}
                  </span>
                )}
              </div>
              {/* Name + stats */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[var(--ink)]">{tech.name}</p>
                <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
                  <span className="font-bold text-emerald-500">{tech.count}</span> done
                  {tech.pending > 0 && <> · <span className="font-bold text-amber-500">{tech.pending}</span> active</>}
                  {avgDays && <> · {avgDays}d avg</>}
                </p>
              </div>
              {/* Revenue */}
              <div className="shrink-0 text-right">
                <p className="text-[12px] font-bold text-[var(--ink)]">{formatMoneyCompact(tech.revenue, currency)}</p>
                {tech.payoutDue > 0 && (
                  <p className="text-[12px] font-semibold text-red-500">{formatMoneyCompact(tech.payoutDue, currency)} due</p>
                )}
              </div>
            </div>
          );
        }}
      />
    </section>
  );
}
