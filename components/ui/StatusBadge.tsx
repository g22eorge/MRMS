import type { ReactNode } from "react";

/**
 * Generic status badge — the single way to render a status/category pill.
 *
 * Replaces the per-page `Record<string,string>` Tailwind color maps
 * (STATUS_STYLES, CATEGORY_COLORS, StatusPill, methodBadge, …).
 * Pick a semantic `tone`; do not hand-roll badge class strings in pages.
 */

export type BadgeTone =
  | "neutral"
  | "info"      // blue
  | "success"   // emerald
  | "warning"   // amber
  | "danger"    // red
  | "accent"    // brand gold
  | "violet"
  | "sky"
  | "purple"
  | "pink"
  | "teal"
  | "orange"
  | "slate";

const TONES: Record<BadgeTone, { badge: string; dot: string }> = {
  neutral: { badge: "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--ink-muted)]", dot: "bg-[var(--ink-muted)]/50" },
  info:    { badge: "border-blue-400/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",     dot: "bg-blue-500" },
  success: { badge: "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  warning: { badge: "border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  danger:  { badge: "border-red-400/30 bg-red-500/10 text-red-700 dark:text-red-400",         dot: "bg-red-500" },
  accent:  { badge: "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[#9A7A00] dark:text-[var(--accent)]", dot: "bg-[var(--accent)]" },
  violet:  { badge: "border-violet-400/30 bg-violet-500/10 text-violet-700 dark:text-violet-400", dot: "bg-violet-500" },
  sky:     { badge: "border-sky-400/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",         dot: "bg-sky-500" },
  purple:  { badge: "border-purple-400/30 bg-purple-500/10 text-purple-700 dark:text-purple-400", dot: "bg-purple-500" },
  pink:    { badge: "border-pink-400/30 bg-pink-500/10 text-pink-700 dark:text-pink-400",     dot: "bg-pink-500" },
  teal:    { badge: "border-teal-400/30 bg-teal-500/10 text-teal-700 dark:text-teal-400",     dot: "bg-teal-500" },
  orange:  { badge: "border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  slate:   { badge: "border-slate-400/30 bg-slate-500/10 text-slate-600 dark:text-slate-400", dot: "bg-slate-400" },
};

export type StatusBadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  /** Show a small colored dot before the label. */
  dot?: boolean;
  /** Filled style (solid background) for emphatic states like "Completed". */
  solid?: boolean;
  title?: string;
  className?: string;
};

const SOLID: Partial<Record<BadgeTone, string>> = {
  success: "border-emerald-700 bg-emerald-600 text-white",
  danger:  "border-red-700 bg-red-600 text-white",
  accent:  "border-[var(--accent)] bg-[var(--accent)] text-black",
  warning: "border-amber-600 bg-amber-500 text-black",
  info:    "border-blue-700 bg-blue-600 text-white",
};

export function StatusBadge({ children, tone = "neutral", dot = false, solid = false, title, className = "" }: StatusBadgeProps) {
  const cfg = TONES[tone] ?? TONES.neutral;
  const badge = solid ? (SOLID[tone] ?? cfg.badge) : cfg.badge;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[12px] font-semibold leading-tight ${badge} ${className}`}
    >
      {dot ? <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${solid ? "bg-white/80" : (cfg ?? TONES.neutral).dot}`} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function toneFor(map: Record<string, BadgeTone>, key: string | null | undefined, fallback: BadgeTone = "neutral"): BadgeTone {
  if (!key) return fallback;
  return map[key] ?? fallback;
}

export const toneForInvoice = toneFor;
