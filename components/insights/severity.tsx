import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The shared vocabulary for pages that report the state of the business.
 *
 * Built on the AI Insights page and extracted so the rest of the system can
 * speak the same way. Four rules, each of which was a defect before it was a
 * rule:
 *
 *   1. State is never colour alone. A hue is invisible to roughly one man in
 *      twelve, and to anyone scanning rather than reading — which is everyone
 *      opening a page to find out what needs attention. Every level ships with
 *      a stripe, a dot AND a word.
 *   2. The value stays in ink. A coloured number reads as decoration and stops
 *      being a signal the moment several numbers have it; the state belongs
 *      beside the figure, not inside it.
 *   3. A figure that has somewhere to act on it is a link. Reporting "9
 *      invoices overdue" and making the reader find the invoice list is wasting
 *      the insight. A row without a real destination stays plain text — a link
 *      landing on an unfiltered page is a small betrayal each time.
 *   4. Worst first. If the list is sorted by anything else, the reader does the
 *      sorting.
 *
 * These colours are the reserved status palette. They mean state, and are never
 * reused to tell one series apart from another.
 */
export type Severity = "critical" | "serious" | "warning" | "good" | "neutral";

export const SEVERITY: Record<Severity, { label: string; dot: string; stripe: string; chip: string }> = {
  critical: { label: "Act today", dot: "bg-red-500",     stripe: "bg-red-500",     chip: "text-red-600 dark:text-red-400" },
  serious:  { label: "This week", dot: "bg-amber-500",   stripe: "bg-amber-500",   chip: "text-amber-700 dark:text-amber-400" },
  warning:  { label: "Watch",     dot: "bg-sky-500",     stripe: "bg-sky-500",     chip: "text-sky-700 dark:text-sky-400" },
  good:     { label: "Healthy",   dot: "bg-emerald-500", stripe: "bg-emerald-500", chip: "text-emerald-700 dark:text-emerald-400" },
  neutral:  { label: "",          dot: "bg-[var(--ink-muted)]/40", stripe: "bg-[var(--line)]", chip: "text-[var(--ink-muted)]" },
};

export const SEVERITY_ORDER: Severity[] = ["critical", "serious", "warning", "good", "neutral"];

/**
 * A rate graded against two thresholds.
 *
 * Ten places in Reports had written this out as a nested ternary picking a
 * hex — margin, conversion, target attainment, completion rate — each with its
 * own thresholds and each rendering the same sentence in three different
 * colours. The grading is fine; expressing it as a colour is what made it
 * unreadable to anyone who does not see the hue.
 *
 * Returns a Severity so the caller renders through ToneNote and gets the word
 * for free. Note the deliberate absence of "warning": a rate is good, middling
 * or poor, and inventing a fourth band per call site is how ten variants
 * happened in the first place.
 */
export function rateTone(pct: number, good: number, fair: number): Severity {
  if (pct >= good) return "good";
  if (pct >= fair) return "serious";
  return "critical";
}

/**
 * The state, said in words, next to a dot.
 *
 * The caller supplies the word because the right one depends on the sentence:
 * SEVERITY.label is a task ("Act today"), which fits a queue of work but
 * overclaims badly on a measurement — a 38% gross margin is thin, not an
 * emergency. Passing the word in keeps the colour and the language agreeing.
 */
export function ToneNote({ tone, children }: { tone: Severity; children: ReactNode }) {
  const s = SEVERITY[tone];
  return (
    <span className={`flex items-center gap-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] ${s.chip}`}>
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
      {children}
    </span>
  );
}

/** A headline figure, its state, and where to act on it. */
export function KpiCard({
  title, value, caption, tone = "neutral", href,
}: { title: string; value: string; caption?: string; tone?: Severity; href?: string }) {
  const s = SEVERITY[tone];
  const Wrapper = (href ? Link : "section") as React.ElementType;
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className={`dc-card relative block overflow-hidden px-3 py-2.5 pl-4 ${href ? "transition-colors hover:border-[var(--accent)]/40" : ""}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${s.stripe}`} />
      {/* Stacked, not title-and-chip on one row: narrow tiles truncated the
          label to "This w..", and a status label that cannot be read is worse
          than none — it still takes the space and the attention. */}
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">{title}</p>
      <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-[var(--ink)]">{value}</p>
      {s.label ? <span className="mt-1 block"><ToneNote tone={tone}>{s.label}</ToneNote></span> : null}
      {caption ? <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{caption}</p> : null}
    </Wrapper>
  );
}

/** A card of figures whose title goes to the module it summarises. */
export function SummaryCard({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return (
    <div className="dc-card px-3 py-2.5">
      {href ? (
        <Link href={href} className="group inline-flex items-center gap-1 text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)] transition-colors hover:text-[var(--accent)]">
          {title}
          <span aria-hidden className="opacity-0 transition-opacity group-hover:opacity-100">→</span>
        </Link>
      ) : (
        <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">{title}</p>
      )}
      <dl className="mt-2 divide-y divide-[var(--line)]/60">{children}</dl>
    </div>
  );
}

/**
 * One label-and-figure row.
 *
 * Values are right-aligned and tabular so digits form a column the eye can run
 * down; before that each row set its number wherever its text happened to end,
 * which is what made these cards read as a wall. The row is the link target,
 * not the number — a four-character count is a poor thing to ask anyone to hit.
 */
export function Stat({
  label, value, sub, href, tone,
}: { label: string; value: string; sub?: string; href?: string; tone?: Severity }) {
  const s = tone ? SEVERITY[tone] : null;
  const body = (
    <>
      <dt className="flex min-w-0 items-center gap-1.5 truncate text-[0.8125rem] text-[var(--ink-muted)] group-hover:text-[var(--ink)]">
        {s && tone !== "neutral" ? <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} /> : null}
        {label}
      </dt>
      <dd className="shrink-0 text-right">
        <span className="text-[0.8125rem] font-semibold tabular-nums text-[var(--ink)]">{value}</span>
        {sub ? <span className="ml-1.5 text-[0.6875rem] font-medium tabular-nums text-[var(--ink-muted)]">{sub}</span> : null}
      </dd>
    </>
  );
  if (!href) return <div className="flex items-baseline justify-between gap-3 py-1.5">{body}</div>;
  return (
    <Link href={href} className="group -mx-1.5 flex items-baseline justify-between gap-3 rounded-md px-1.5 py-1.5 transition-colors hover:bg-[var(--panel-strong)]">
      {body}
    </Link>
  );
}

/**
 * A magnitude, drawn rather than listed.
 *
 * "12 / 20" makes the reader do arithmetic on every row. The bar shows the
 * shape before anything is read. `max` is the largest value in the set for a
 * distribution, or the threshold for a value measured against a limit — in
 * which case a full bar means "at the line", not "plenty".
 */
export function BarRow({
  label, value, max, tone = "neutral", note, href,
}: { label: string; value: number; max: number; tone?: Severity; note?: string; href?: string }) {
  const s = SEVERITY[tone];
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const inner = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[0.8125rem] text-[var(--ink)]">{label}</span>
        <span className="shrink-0 text-[0.75rem] font-semibold tabular-nums text-[var(--ink-muted)]">{note ?? value}</span>
      </div>
      <span className="mt-1 block h-2 w-full overflow-hidden rounded-full bg-[var(--panel-strong)] ring-1 ring-inset ring-[var(--line)]">
        {/* Full strength. At 70% alpha these read as switched off rather than
            as data, and a zero-width bar is indistinguishable from one that
            failed to render — so an empty value still shows its track. */}
        <span
          className={`block h-full rounded-full ${tone === "neutral" ? "bg-[var(--accent)]" : s.dot}`}
          style={{ width: `${value > 0 ? Math.max(4, pct) : 0}%` }}
        />
      </span>
    </>
  );
  if (!href) return <div className="text-sm">{inner}</div>;
  return (
    <Link href={href} className="-mx-1.5 block rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-[var(--panel-strong)]">
      {inner}
    </Link>
  );
}
