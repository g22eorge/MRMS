import { StatCards, type StatCardTone } from "@/components/ui/StatCards";

/**
 * JobsAttentionStrip — the action-first band at the top of the jobs list.
 * Data-driven: pass a list of cards (label, count, tone, href) and it renders
 * clickable severity cards. Presentation lives in the shared `StatCards`
 * component so every list page's KPI band stays identical; the counts are
 * computed by the server page.
 */

export type AttentionTone = Exclude<StatCardTone, "neutral">;

export type AttentionCard = {
  key: string;
  label: string;
  count: number;
  sub?: string;
  tone: AttentionTone;
  href: string;
};

export function JobsAttentionStrip({ cards }: { cards: AttentionCard[] }) {
  return (
    <StatCards
      columns={4}
      cards={cards.map((card) => ({
        key: card.key,
        label: card.label,
        value: card.count,
        sub: card.sub,
        tone: card.tone,
        href: card.href,
        muted: card.count === 0,
      }))}
    />
  );
}
