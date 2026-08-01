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
  { key: "READY_FOR_PICKUP", label: "Ready for Pickup", href: "/jobs?status=READY_FOR_PICKUP", tone: "border-[var(--accent)] bg-[var(--accent)] text-white" },
  { key: "COMPLETED", label: "Completed", href: "/jobs?status=COMPLETED", tone: "border-[var(--accent)] bg-[var(--accent)] text-white" },
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
    <section className="panel-shadow overflow-hidden rounded-xl border border-[var(--line)] bg-[linear-gradient(135deg,rgba(212,175,55,0.06),rgba(212,175,55,0.02))]">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">Repair Status Guide</p>
        <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{title}</p>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">{guidance}</p>
      </div>
      <div className="flex snap-x gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:thin]">
        {repairFlowReference.map((step, index) => (
          <div key={step.key} className="flex shrink-0 items-center gap-2">
            <Link href={step.href} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition hover:-translate-y-[1px] ${step.tone}`}>
              {step.label}
            </Link>
            {index < repairFlowReference.length - 1 ? <span className="text-[12px] text-[var(--ink-muted)]">→</span> : null}
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
    <div className="panel-shadow flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
      {/* Period toggle */}
      <div className="flex items-center gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-1">
        <Link
          href={monthHref}
          className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-all ${
            period === "month"
              ? "bg-[var(--accent)] text-white shadow-sm"
              : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          Monthly
        </Link>
        <Link
          href={yearHref}
          className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-all ${
            period === "year"
              ? "bg-[var(--accent)] text-white shadow-sm"
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
        selectClassName="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2.5 py-1.5 text-[12px] outline-none focus:border-[var(--accent)]/50"
      />
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="ml-auto rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-[13px] font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)]/30 hover:text-[var(--accent)]"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function DashboardHero({
  title,
  summary: _summary,
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
    <div className="panel-shadow flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-2.5">
      <p className="text-[13px] font-bold text-[var(--ink)]">{title}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={primaryHref} className="btn-premium rounded-lg px-3 py-1.5 text-[12px]">
          {primaryLabel}
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="inline-flex items-center rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
          >
            {secondaryLabel}
          </Link>
        ) : null}
        {extraActions?.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="inline-flex items-center rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
          >
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
    <section className="panel-shadow rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
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
                <p className="text-[13px] uppercase tracking-[0.1em] text-[var(--ink-muted)]">{m.key.slice(5)}</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--accent)]">{formatMoneyCompact(m.revenue, currency)}</p>
                <p className={`text-[12px] ${m.margin >= 0 ? "text-emerald-600" : "text-[var(--ink)]"}`}>{formatMoneyCompact(m.margin, currency)}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
