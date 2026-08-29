import Link from "next/link";
import React from "react";

import { MonthSelectForm } from "@/components/shared/MonthSelectForm";
import { RevenueLineChart } from "@/components/reports/ReportsCharts";
import { formatMoneyCompact } from "@/lib/currency";
import { normalizeJobStatus } from "@/lib/job-status";
import type { Role } from "@prisma/client";

import { asDateInputValue, type TrendMonth } from "./data";

/** Shared dashboard building blocks — extracted from page.tsx unchanged. */

export type PermissionUser = { role: Role; permissions?: string[] };

/** ── Calm dashboard primitives — the one header/card vocabulary every
 *  dashboard shares (promoted from AdminDashboard so role dashboards use the
 *  same set). Flat card on soft shadow; plain titles, no "→" link clutter. ── */

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`dc-card ${className}`}>{children}</div>;
}

// Executive look: headers are plain titles — no "→ go here" link clutter. The
// tiles/rows inside each card stay clickable for drill-down. href/hrefLabel are
// accepted (and ignored) so call sites can pass them without breaking.
type HeadProps = { title: string; href?: string; hrefLabel?: string; note?: React.ReactNode };

/** Card title — bold, sentence-case, primary ink. Optional trailing `note`
 *  (a badge/link) sits on the baseline beside it. */
export function CardHead({ title, note }: HeadProps) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h4 className="text-[0.78125rem] font-bold tracking-[-0.01em] text-[var(--dc-ink)]">{title}</h4>
      {note}
    </div>
  );
}

/** Section eyebrow — small uppercase label above a group of cards. */
export function SectionHead({ title, note }: HeadProps) {
  return (
    <div className="mb-2.5 flex items-baseline gap-2 px-1">
      <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-[var(--dc-ink-3)]">{title}</h3>
      {note}
    </div>
  );
}

export const statusLabel: Record<ReturnType<typeof normalizeJobStatus>, string> = {
  RECEIVED: "Received",
  DIAGNOSING: "Diagnosing",
  REFERRED: "Referred",
  AWAITING_APPROVAL: "Awaiting Approval",
  IN_REPAIR: "In Repair",
  READY_FOR_PICKUP: "Ready for Pickup",
  COMPLETED: "Completed",
  CLOSED: "Closed",
};

const repairFlowReference = [
  { key: "RECEIVED", label: "Received", href: "/jobs?status=RECEIVED", tone: "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink)]" },
  { key: "DIAGNOSING", label: "Diagnosing", href: "/jobs?status=DIAGNOSING", tone: "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink)]" },
  { key: "REFERRED", label: "Referred", href: "/jobs?status=REFERRED", tone: "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink)]" },
  { key: "AWAITING_APPROVAL", label: "Awaiting Approval", href: "/jobs?status=AWAITING_APPROVAL", tone: "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]" },
  { key: "IN_REPAIR", label: "In Repair", href: "/jobs?status=IN_REPAIR", tone: "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink)]" },
  { key: "READY_FOR_PICKUP", label: "Ready for Pickup", href: "/jobs?status=READY_FOR_PICKUP", tone: "border-[var(--accent)] bg-[var(--accent)] text-black" },
  { key: "COMPLETED", label: "Completed", href: "/jobs?status=COMPLETED", tone: "border-[var(--accent)] bg-[var(--accent)] text-black" },
  { key: "CLOSED", label: "Closed", href: "/jobs?status=CLOSED", tone: "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]" },
] as const;

export function RepairStatusReference({
  title,
  guidance,
}: {
  title: string;
  guidance: string;
}) {
  return (
    <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[linear-gradient(135deg,rgba(201, 162, 39,0.06),rgba(201, 162, 39,0.02))]">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Repair Status Guide</p>
        <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{title}</p>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">{guidance}</p>
      </div>
      <div className="flex snap-x gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:thin]">
        {repairFlowReference.map((step, index) => (
          <div key={step.key} className="flex shrink-0 items-center gap-2">
            <Link href={step.href} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition hover:-translate-y-[1px] ${step.tone}`}>
              {step.label}
            </Link>
            {index < repairFlowReference.length - 1 ? <span className="text-[0.75rem] text-[var(--ink-muted)]">→</span> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function DashboardPeriodBar({
  period,
  monthHref,
  yearHref,
  selectorName,
  selectorValue,
  selectorOptions,
  actionHref,
  actionLabel,
}: {
  period: "month" | "year";
  monthHref: string;
  yearHref: string;
  selectorName: "month" | "year";
  selectorValue: string;
  selectorOptions: Array<{ value: string; label: string }>;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="dc-card flex flex-wrap items-center gap-2 px-3 py-2.5">
      {/* Period toggle */}
      <div className="flex items-center gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-1">
        <Link
          href={monthHref}
          className={`rounded-lg px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
            period === "month"
              ? "bg-[var(--accent)] text-black shadow-sm"
              : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          Monthly
        </Link>
        <Link
          href={yearHref}
          className={`rounded-lg px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
            period === "year"
              ? "bg-[var(--accent)] text-black shadow-sm"
              : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          Annual
        </Link>
      </div>
      <MonthSelectForm
        name={selectorName}
        value={selectorValue}
        options={selectorOptions}
        hiddenFields={{ period }}
        className="flex items-center"
        selectClassName="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-[0.75rem] outline-none focus:border-[var(--accent)]/50"
      />
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="ml-auto rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[0.8125rem] font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)]/30 hover:text-[var(--accent)]"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

// The one dashboard header pattern: a calm greeting-style heading + a stat
// summary subtitle + a calm accent primary (dc-btn) and quiet secondary links.
// Matches AdminDashboard's desktop greeting so every role opens the same way —
// no bordered gold-button toolbar. `icon` is kept in the signature for call-site
// compatibility but the calm header doesn't use it.
const heroSecondary =
  "inline-flex items-center rounded-lg border border-[var(--dc-line)] px-3 py-[9px] text-[0.78125rem] font-semibold text-[var(--dc-ink-2)] transition active:scale-[0.98] hover:border-[var(--dc-accent)] hover:text-[var(--dc-ink)]";

export function DashboardHero({
  title,
  summary,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  extraActions,
  icon: _icon,
}: {
  title: string;
  summary: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  extraActions?: { href: string; label: string }[];
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="min-w-0">
        <h2 className="text-[1.25rem] font-bold tracking-[-0.02em] text-[var(--dc-ink)]">{title}</h2>
        {summary ? <p className="mt-0.5 text-[0.78125rem] text-[var(--dc-ink-2)]">{summary}</p> : null}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Link href={primaryHref} className="dc-btn inline-flex items-center gap-1.5 rounded-[10px] px-[15px] py-[9px] text-[0.78125rem] font-semibold active:scale-[0.98]">
          {primaryLabel}
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link href={secondaryHref} className={heroSecondary}>
            {secondaryLabel}
          </Link>
        ) : null}
        {extraActions?.map((action) => (
          <Link key={action.href} href={action.href} className={heroSecondary}>
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function RevenueMarginTrendSection({
  trendMonths,
  revenueTrend,
  currency,
  label = "Revenue & Margin Trend",
  emptyMessage = "No revenue yet for this period.",
}: {
  trendMonths: TrendMonth[];
  revenueTrend: { key: string; revenue: number; margin: number }[];
  currency: string;
  label?: string;
  emptyMessage?: string;
}) {
  return (
    <section className="dc-card px-3 py-2.5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--ink)]">{label}</p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">
            {trendMonths[0]?.key} – {trendMonths[trendMonths.length - 1]?.key}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--ink-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-full bg-[var(--accent)]" />
            Revenue
          </span>
          {revenueTrend.some((m) => m.revenue > 0 || m.margin > 0) && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-emerald-400/90" />
              Margin
            </span>
          )}
        </div>
      </div>

      {revenueTrend.every((m) => m.revenue === 0 && m.margin === 0) ? (
        <div className="mb-3 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-[var(--ink-muted)]">
          {emptyMessage}
        </div>
      ) : null}

      <RevenueLineChart data={revenueTrend} currency={currency} />
      <div className="-mx-1 mt-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <div className="flex w-max gap-2">
          {revenueTrend.map((m) => {
            const range = trendMonths.find((t) => t.key === m.key);
            const href = range
              ? `/jobs?status=COMPLETED&dateField=completedAt&from=${asDateInputValue(range.start)}&to=${asDateInputValue(range.end)}`
              : "/jobs?status=COMPLETED";
            return (
              <Link
                key={m.key}
                href={href}
                className="w-[92px] rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-2 text-center transition hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5"
              >
                <p className="text-[0.8125rem] uppercase tracking-[0.1em] text-[var(--ink-muted)]">{m.key.slice(5)}</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--accent)]">{formatMoneyCompact(m.revenue, currency)}</p>
                <p className={`text-[0.75rem] ${m.margin >= 0 ? "text-emerald-600" : "text-[var(--ink)]"}`}>{formatMoneyCompact(m.margin, currency)}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
