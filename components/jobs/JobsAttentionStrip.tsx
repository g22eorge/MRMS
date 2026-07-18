import Link from "next/link";

/**
 * JobsAttentionStrip — the action-first band at the top of the jobs list.
 * Data-driven: pass a list of cards (label, count, tone, href) and it renders
 * clickable severity cards. Kept presentational and free of data-loading so it
 * stays reusable and easy to test; the counts are computed by the server page.
 */

export type AttentionTone = "crit" | "warn" | "good" | "accent";

export type AttentionCard = {
  key: string;
  label: string;
  count: number;
  sub?: string;
  tone: AttentionTone;
  href: string;
};

const TONE: Record<AttentionTone, { rail: string; value: string }> = {
  crit: { rail: "bg-[var(--dc-crit)]", value: "text-[var(--dc-crit)]" },
  warn: { rail: "bg-[var(--dc-warn)]", value: "text-[var(--dc-warn)]" },
  good: { rail: "bg-[var(--dc-good)]", value: "text-[var(--dc-good)]" },
  accent: { rail: "bg-[var(--dc-accent)]", value: "text-[var(--dc-accent-2)]" },
};

export function JobsAttentionStrip({ cards }: { cards: AttentionCard[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="hidden gap-3 lg:grid lg:grid-cols-4">
      {cards.map((card) => {
        const zero = card.count === 0;
        const tone = TONE[card.tone];
        return (
          <Link
            key={card.key}
            href={card.href}
            className="dc-card relative overflow-hidden px-4 py-3.5 transition hover:shadow-[var(--dc-shadow-hover)]"
          >
            <span className={`absolute inset-y-0 left-0 w-[3px] ${zero ? "bg-[var(--dc-line)]" : tone.rail}`} aria-hidden="true" />
            <p className="text-[11px] font-semibold text-[var(--dc-ink-3)]">{card.label}</p>
            <p className={`mt-1 text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums ${zero ? "text-[var(--dc-ink-3)]" : tone.value}`}>
              {card.count}
            </p>
            {card.sub ? <p className="mt-1 text-[10.5px] text-[var(--dc-ink-3)]">{card.sub}</p> : null}
          </Link>
        );
      })}
    </div>
  );
}
