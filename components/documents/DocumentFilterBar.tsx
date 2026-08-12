import Link from "next/link";
import type { ReactNode } from "react";

import {
  DOCUMENT_PERIOD_OPTIONS,
  DOCUMENT_PERIOD_OPTIONS_SHORT,
  type DocumentPeriodKey,
} from "@/lib/documents/period-filters";

type PeriodOption = { key: DocumentPeriodKey; label: string };

type PeriodFilterChipsProps = {
  active: string;
  options?: PeriodOption[];
  /** `pill` — rounded-full links (delivery notes). `button` — form submit buttons (receipts). */
  style?: "pill" | "button";
  buildHref?: (period: DocumentPeriodKey) => string;
};

export function PeriodFilterChips({
  active,
  options = DOCUMENT_PERIOD_OPTIONS_SHORT,
  style = "pill",
  buildHref,
}: PeriodFilterChipsProps) {
  if (style === "button") {
    return (
      <div className="flex gap-1">
        {options.map(({ key, label }) => (
          <button
            key={key}
            type="submit"
            name="period"
            value={key}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              active === key
                ? "bg-[var(--accent)] text-black"
                : "bg-[var(--panel-strong)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  if (!buildHref) {
    throw new Error("PeriodFilterChips with style=pill requires buildHref");
  }

  return (
    <div className="flex gap-1">
      {options.map(({ key, label }) => (
        <Link
          key={key}
          href={buildHref(key)}
          className={`rounded-full border px-3 py-1.5 text-[0.75rem] font-semibold transition ${
            active === key
              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
              : "border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export { DOCUMENT_PERIOD_OPTIONS, DOCUMENT_PERIOD_OPTIONS_SHORT };

type DocumentFilterBarProps = {
  /** Page path for reset link and period hrefs, e.g. `/documents/receipts` */
  basePath: string;
  q: string;
  period: string;
  searchPlaceholder: string;
  /** `form` — single form with submit period buttons. `link` — GET search + link chips. */
  mode?: "form" | "link";
  periodOptions?: PeriodOption[];
  extraQuery?: Record<string, string>;
  showReset?: boolean;
  children?: ReactNode;
};

function buildQueryString(params: Record<string, string | undefined>) {
  const parts = Object.entries(params)
    .filter(([, value]) => value && value !== "all")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value!)}`);
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export function DocumentFilterBar({
  basePath,
  q,
  period,
  searchPlaceholder,
  mode = "link",
  periodOptions = DOCUMENT_PERIOD_OPTIONS,
  extraQuery = {},
  showReset = true,
  children,
}: DocumentFilterBarProps) {
  const hasFilters = Boolean(q) || period !== "all" || Object.values(extraQuery).some((v) => v && v !== "all");
  const resetHref = basePath;

  if (mode === "form") {
    return (
      <form className="panel-shadow flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
        <input
          name="q"
          defaultValue={q}
          placeholder={searchPlaceholder}
          className="min-w-[160px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-1.5 text-sm outline-none transition focus:border-[var(--accent)]/50 focus:ring-1 focus:ring-[var(--accent)]/20"
        />
        <PeriodFilterChips active={period} options={periodOptions} style="button" />
        {children}
        {showReset && hasFilters ? (
          <Link
            href={resetHref}
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            Reset
          </Link>
        ) : null}
      </form>
    );
  }

  const buildHref = (nextPeriod: DocumentPeriodKey) =>
    `${basePath}${buildQueryString({ ...extraQuery, period: nextPeriod, q: q || undefined })}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PeriodFilterChips active={period} options={periodOptions} buildHref={buildHref} />
      {children}
      <form method="GET" className="flex min-w-[180px] flex-1 gap-2">
        {Object.entries(extraQuery).map(([key, value]) =>
          value && value !== "all" ? <input key={key} type="hidden" name={key} value={value} /> : null,
        )}
        <input type="hidden" name="period" value={period} />
        <input
          name="q"
          defaultValue={q}
          placeholder={searchPlaceholder}
          className="h-8 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-[0.75rem] text-[var(--ink)] outline-none focus:border-[var(--accent)]/50"
        />
        <button
          type="submit"
          className="h-8 rounded-lg border border-[var(--line)] px-3 text-[0.75rem] font-medium hover:bg-[var(--panel-strong)]"
        >
          Search
        </button>
      </form>
      {showReset && hasFilters ? (
        <Link href={resetHref} className="text-[0.75rem] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]">
          Reset
        </Link>
      ) : null}
    </div>
  );
}
