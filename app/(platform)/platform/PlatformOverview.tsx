import Link from "next/link";

import { formatMoney } from "@/lib/currency";
import { PLATFORM_ROUTES } from "@/lib/platform/routes";

/**
 * The top of the platform console: what needs the operator, then how the
 * business is doing, then who is on which plan.
 *
 * It replaced eleven equal tiles (total, paid, trialing, past due, cancelled,
 * users, two revenue figures and a tile per plan). Those answered "how many of
 * each" and left the operator to work out the three things they opened the
 * page for: is anyone about to be lost, what is coming in each month, and is
 * anybody actually using it. Each block below answers one of those.
 *
 * Everything here counts active organisations only; the caller filters.
 */
export type AttentionItem = {
  id: string;
  name: string;
  /** Sorted by severity: 0 first. */
  rank: 0 | 1 | 2;
  reason: string;
  detail: string;
};

export type PlanSlice = { plan: string; count: number };

const PLAN_BAR: Record<string, string> = {
  STARTER: "bg-[var(--ink-muted)]/35",
  STANDARD: "bg-sky-500",
  GROWTH: "bg-amber-500",
  PREMIUM: "bg-violet-500",
  ENTERPRISE: "bg-fuchsia-500",
};
const PLAN_LABEL: Record<string, string> = {
  STARTER: "Starter",
  STANDARD: "Standard",
  GROWTH: "Growth",
  PREMIUM: "Premium",
  ENTERPRISE: "Enterprise",
};
const RANK_MARK = ["bg-red-500", "bg-amber-500", "bg-sky-500"] as const;

function Figure({
  label,
  value,
  lines,
}: {
  label: string;
  value: string;
  lines: Array<string | null>;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3.5">
      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink-muted)]">{label}</p>
      <p className="mt-1.5 text-[1.625rem] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--ink)]">{value}</p>
      <div className="mt-2 space-y-0.5">
        {lines.filter(Boolean).map((line) => (
          <p key={line} className="text-[0.75rem] text-[var(--ink-muted)]">{line}</p>
        ))}
      </div>
    </div>
  );
}

export function PlatformOverview({
  attention,
  mrr,
  payingCount,
  atRiskMrr,
  collectedThisMonth,
  collectedAllTime,
  trialsRunning,
  trialsEndingSoon,
  trialsExpired,
  signedInThisWeek,
  activeOrgCount,
  totalUsers,
  newThisMonth,
  planMix,
}: {
  attention: AttentionItem[];
  mrr: number;
  payingCount: number;
  atRiskMrr: number;
  collectedThisMonth: number;
  collectedAllTime: number;
  trialsRunning: number;
  trialsEndingSoon: number;
  trialsExpired: number;
  signedInThisWeek: number | null;
  activeOrgCount: number;
  totalUsers: number;
  newThisMonth: number;
  planMix: PlanSlice[];
}) {
  const sorted = [...attention].sort((a, b) => a.rank - b.rank);
  const planTotal = planMix.reduce((sum, slice) => sum + slice.count, 0);

  return (
    <div className="space-y-4">
      {/* ── 1. Needs attention ── */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-baseline justify-between border-b border-[var(--line)] px-4 py-2.5">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Needs attention</h2>
          <p className={`text-[0.75rem] font-semibold ${sorted.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {sorted.length > 0 ? `${sorted.length} to look at` : "All clear"}
          </p>
        </div>
        {sorted.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--ink-muted)]">
            No active organisation is past due, and no trial is ending or has lapsed.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {sorted.map((item) => (
              <li key={`${item.id}-${item.reason}`}>
                <Link
                  href={PLATFORM_ROUTES.org(item.id)}
                  className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-[var(--panel-strong)]"
                >
                  <span className={`h-8 w-[3px] shrink-0 rounded-full ${RANK_MARK[item.rank]}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--ink)]">{item.name}</span>
                    <span className="block truncate text-[0.75rem] text-[var(--ink-muted)]">{item.detail}</span>
                  </span>
                  <span className="shrink-0 text-[0.75rem] font-semibold text-[var(--ink)]">{item.reason}</span>
                  <span className="shrink-0 text-[var(--ink-muted)]" aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 2. How the business is doing ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          label="Monthly recurring"
          value={formatMoney(mrr)}
          lines={[
            `${payingCount} paying ${payingCount === 1 ? "customer" : "customers"}`,
            atRiskMrr > 0 ? `${formatMoney(atRiskMrr)} more is past due` : null,
          ]}
        />
        <Figure
          label="Collected this month"
          value={formatMoney(collectedThisMonth)}
          lines={[`${formatMoney(collectedAllTime)} all time`]}
        />
        <Figure
          label="Trials"
          value={String(trialsRunning)}
          lines={[
            trialsEndingSoon > 0 ? `${trialsEndingSoon} end within 7 days` : "none ending this week",
            trialsExpired > 0 ? `${trialsExpired} ended without converting` : null,
          ]}
        />
        <Figure
          label="Signed in this week"
          value={signedInThisWeek === null ? "—" : `${signedInThisWeek} of ${activeOrgCount}`}
          lines={[
            `${totalUsers} users across active organisations`,
            newThisMonth > 0 ? `${newThisMonth} new this month` : "no new organisations this month",
          ]}
        />
      </div>

      {/* ── 3. Plan mix: one bar, not a tile per plan ── */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Plans</h2>
          <p className="text-[0.75rem] text-[var(--ink-muted)]">{planTotal} active</p>
        </div>
        {planTotal > 0 ? (
          <div className="mt-2.5 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Active organisations by plan">
            {planMix.filter((slice) => slice.count > 0).map((slice) => (
              <span
                key={slice.plan}
                className={PLAN_BAR[slice.plan] ?? "bg-[var(--ink-muted)]/35"}
                style={{ width: `${(slice.count / planTotal) * 100}%` }}
              />
            ))}
          </div>
        ) : null}
        <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
          {planMix.map((slice) => (
            <li key={slice.plan} className="flex items-center gap-1.5 text-[0.8125rem]">
              <span className={`h-2 w-2 rounded-full ${PLAN_BAR[slice.plan] ?? "bg-[var(--ink-muted)]/35"}`} aria-hidden />
              <span className="text-[var(--ink-muted)]">{PLAN_LABEL[slice.plan] ?? slice.plan}</span>
              <span className={`font-semibold tabular-nums ${slice.count > 0 ? "text-[var(--ink)]" : "text-[var(--ink-muted)]/50"}`}>{slice.count}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
