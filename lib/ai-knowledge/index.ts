import type { Module, Procedure } from "./types";
import { JOB_PROCEDURES } from "./jobs";
import { DOCUMENT_PROCEDURES } from "./documents";
import { INVENTORY_PROCEDURES } from "./inventory";
import { FINANCE_PROCEDURES } from "./finance";
import { OPERATIONS_PROCEDURES } from "./operations";
import { ADMIN_PROCEDURES } from "./admin";
import { GETTING_STARTED_PROCEDURES } from "./getting-started";

export type { Procedure, Module } from "./types";
export { MODULE_ROUTES } from "./types";

/**
 * Everything the assistant knows how to walk someone through.
 *
 * Two readers, one corpus. The matcher answers high-confidence hits for free;
 * the model receives the whole thing as a cached prefix for everything else.
 * Keeping both on the same source is the point — a scripted answer and a
 * generated one should never contradict each other, which they did when the
 * procedures lived inside the guide route as branches.
 */
export const PROCEDURES: Procedure[] = [
  ...JOB_PROCEDURES,
  ...DOCUMENT_PROCEDURES,
  ...INVENTORY_PROCEDURES,
  ...FINANCE_PROCEDURES,
  ...OPERATIONS_PROCEDURES,
  ...ADMIN_PROCEDURES,
  ...GETTING_STARTED_PROCEDURES,
];

/** Ids must be unique — feedback and answer attribution are keyed on them. */
export function duplicateIds(): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const p of PROCEDURES) {
    if (seen.has(p.id)) dupes.add(p.id);
    seen.add(p.id);
  }
  return [...dupes];
}

/** A `next` pointing at nothing is a dead end in the guide. */
export function brokenLinks(): { from: string; to: string }[] {
  const ids = new Set(PROCEDURES.map((p) => p.id));
  const broken: { from: string; to: string }[] = [];
  for (const p of PROCEDURES) {
    for (const n of p.next ?? []) if (!ids.has(n)) broken.push({ from: p.id, to: n });
  }
  return broken;
}

export function byId(id: string): Procedure | undefined {
  return PROCEDURES.find((p) => p.id === id);
}

export function byModule(module: Module): Procedure[] {
  return PROCEDURES.filter((p) => p.module === module);
}

/**
 * High-confidence match only.
 *
 * Answers directly — no model call — when the question clearly is one of these
 * procedures. Deliberately strict: a wrong confident answer is worse than
 * handing the question to the model, so anything short of a strong signal
 * returns null and lets the model handle it with the full corpus.
 */
export function matchProcedure(question: string): Procedure | null {
  const q = question.toLowerCase().trim().replace(/[?.!,]/g, "");
  if (q.length < 4) return null;

  let best: { p: Procedure; score: number } | null = null;
  for (const p of PROCEDURES) {
    for (const phrase of [p.question, ...(p.asks ?? [])]) {
      const c = phrase.toLowerCase().replace(/[?.!,]/g, "");
      let score = 0;
      if (q === c) score = 100;
      else if (q.includes(c) && c.length >= 8) score = 80;
      else if (c.includes(q) && q.length >= 10) score = 70;
      else {
        // Word overlap, ignoring words that carry no signal on their own.
        const stop = new Set(["how", "do", "i", "the", "a", "an", "to", "in", "on", "for", "my", "we", "is", "it", "of", "and", "can", "what"]);
        const qw = q.split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
        const cw = c.split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
        if (qw.length && cw.length) {
          const hits = qw.filter((w) => cw.includes(w)).length;
          const ratio = hits / Math.max(qw.length, cw.length);
          if (ratio >= 0.75 && hits >= 2) score = 60 + ratio * 10;
        }
      }
      if (score && (!best || score > best.score)) best = { p, score };
    }
  }
  return best && best.score >= 70 ? best.p : null;
}

/** Render one procedure as the answer a person reads. */
export function renderProcedure(p: Procedure): string {
  const out: string[] = [p.question, ""];
  if (p.route) out.push(`Where: ${p.route}`);
  if (p.roles?.length) out.push(`Who can do this: ${p.roles.join(", ")}`);
  if (p.route || p.roles?.length) out.push("");
  p.steps.forEach((s, i) => out.push(`${i + 1}. ${s}`));
  if (p.notes?.length) {
    out.push("", "Worth knowing:");
    for (const n of p.notes) out.push(`- ${n}`);
  }
  const nxt = (p.next ?? []).map(byId).filter(Boolean) as Procedure[];
  if (nxt.length) {
    out.push("", "You may also need:");
    for (const n of nxt) out.push(`- ${n.question}`);
  }
  return out.join("\n");
}

/**
 * The whole corpus as the model's cached prefix.
 *
 * Stable byte-for-byte across requests, which is what makes it cacheable — do
 * not interpolate a timestamp, a user name, or anything else that varies.
 */
export function corpusForModel(): string {
  return PROCEDURES.map(
    (p) =>
      [
        `### ${p.id}`,
        `Question: ${p.question}`,
        p.asks?.length ? `Also asked as: ${p.asks.join("; ")}` : "",
        `Module: ${p.module}`,
        p.route ? `Route: ${p.route}` : "",
        p.roles?.length ? `Roles: ${p.roles.join(", ")}` : "",
        "Steps:",
        ...p.steps.map((s, i) => `${i + 1}. ${s}`),
        ...(p.notes?.length ? ["Notes:", ...p.notes.map((n) => `- ${n}`)] : []),
      ]
        .filter(Boolean)
        .join("\n"),
  ).join("\n\n");
}

/** Every module the application has, so coverage can be measured against it. */
const ALL_MODULES: Module[] = [
  "getting-started", "jobs", "clients", "quotations", "invoices", "payments",
  "documents", "pos", "sales", "inventory", "procurement", "finance", "reports",
  "service", "communications", "settings", "portal", "ai", "troubleshooting",
];

/**
 * What is documented and what is not.
 *
 * The point of a trackable corpus: you can answer "which parts of the system
 * can nobody get help with", instead of discovering it when a customer asks.
 */
export function coverage(): {
  total: number;
  approxWords: number;
  byModule: { module: Module; count: number }[];
  undocumented: Module[];
} {
  const counts = ALL_MODULES.map((m) => ({ module: m, count: byModule(m).length }));
  const words = PROCEDURES.reduce(
    (n, p) => n + [p.question, ...p.steps, ...(p.notes ?? [])].join(" ").split(/\s+/).length,
    0,
  );
  return {
    total: PROCEDURES.length,
    approxWords: words,
    byModule: counts.sort((a, b) => b.count - a.count),
    undocumented: counts.filter((c) => c.count === 0).map((c) => c.module),
  };
}

/**
 * The organisation-editable half of the knowledge base.
 *
 * `articles.ts` was `lib/ai-knowledge.ts` until this directory took the name.
 * It holds the six seeded articles and the database-backed retrieval an admin's
 * own articles go through. Re-exported here so `@/lib/ai-knowledge` keeps
 * meaning what it meant to the three files that already import it.
 *
 * The split is deliberate: PROCEDURES are the shipped, versioned, tested
 * how-to corpus; articles are what a workspace adds about its own way of
 * working. The assistant reads both.
 */
export {
  DEFAULT_AI_KNOWLEDGE,
  ensureDefaultAiKnowledge,
  retrieveAiKnowledge,
  formatKnowledgeContext,
} from "./articles";
export type { AiKnowledgeHit } from "./articles";
