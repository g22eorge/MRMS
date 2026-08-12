import Link from "next/link";
import type { ReactNode } from "react";

/**
 * StatCards — the app-wide flat KPI band (the jobs list "attention strip"
 * design, generalized).
 *
 * Flat by design: borderless `dc-card` surface, a 3px tone rail on the left,
 * small label, one big tabular figure, optional sub-line. Do NOT hand-roll
 * bordered `panel-shadow` KPI tiles — use this so every list page reads the
 * same. Cards render from `lg` up; pair them with the compact mobile number
 * strip each list page already has.
 */

export type StatCardTone = "neutral" | "crit" | "warn" | "good" | "accent";

export type StatCard = {
  /** Optional — falls back to `label`. */
  key?: string;
  label: string;
  value: ReactNode;
  sub?: string;
  /** Colours the rail and the figure. Defaults to neutral. */
  tone?: StatCardTone;
  /** Makes the card a filter link. */
  href?: string;
  /** Dim the figure and rail — for "nothing to do here" states (count 0). */
  muted?: boolean;
  /** This card's filter is the active one. */
  active?: boolean;
  /** Legacy `StatTile` compatibility — same as `tone: "accent"`. */
  accent?: boolean;
  /** Legacy `StatTile` compatibility — explicit value colour. */
  valueClass?: string;
};

const TONE: Record<StatCardTone, { rail: string; value: string }> = {
  neutral: { rail: "bg-[var(--dc-line)]", value: "text-[var(--dc-ink)]" },
  crit:    { rail: "bg-[var(--dc-crit)]", value: "text-[var(--dc-crit)]" },
  warn:    { rail: "bg-[var(--dc-warn)]", value: "text-[var(--dc-warn)]" },
  good:    { rail: "bg-[var(--dc-good)]", value: "text-[var(--dc-good)]" },
  accent:  { rail: "bg-[var(--dc-accent)]", value: "text-[var(--dc-accent-2)]" },
};

const COLS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

export function StatCards({ cards, columns }: { cards: StatCard[]; columns?: 2 | 3 | 4 | 5 }) {
  if (cards.length === 0) return null;
  const cols = COLS[columns ?? Math.min(cards.length, 5)] ?? "lg:grid-cols-4";

  return (
    <div className={`hidden gap-3 lg:grid ${cols}`}>
      {cards.map((card) => {
        const key = card.key ?? card.label;
        const tone = TONE[card.tone ?? (card.accent ? "accent" : "neutral")];
        const rail = card.active
          ? TONE.accent.rail
          : card.muted
            ? "bg-[var(--dc-line)]"
            : tone.rail;
        const value = card.muted ? "text-[var(--dc-ink-3)]" : (card.valueClass ?? tone.value);
        const body = (
          <>
            <span className={`absolute inset-y-0 left-0 w-[3px] ${rail}`} aria-hidden="true" />
            <p className={`text-[0.6875rem] font-semibold ${card.active ? "text-[var(--dc-accent-2)]" : "text-[var(--dc-ink-3)]"}`}>
              {card.label}
            </p>
            <p className={`mt-1 truncate text-[1.625rem] font-bold leading-none tracking-[-0.02em] tabular-nums ${value}`}>
              {card.value}
            </p>
            {card.sub ? <p className="mt-1 truncate text-[0.65625rem] text-[var(--dc-ink-3)]">{card.sub}</p> : null}
          </>
        );

        if (!card.href) {
          return (
            <div key={key} className="dc-card relative overflow-hidden px-4 py-3.5">
              {body}
            </div>
          );
        }

        return (
          <Link
            key={key}
            href={card.href}
            className="dc-card relative overflow-hidden px-4 py-3.5 transition hover:shadow-[var(--dc-shadow-hover)]"
          >
            {body}
          </Link>
        );
      })}
    </div>
  );
}
