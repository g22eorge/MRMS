import Anthropic from "@anthropic-ai/sdk";

import { corpusForModel } from "@/lib/ai-knowledge";

/**
 * The AI Guide's model call: Claude, with the how-to corpus cached.
 *
 * Replaces a Gemini path. It worked on the care deployment, which had a Gemini
 * key, and did nothing on the commercial one, which had neither key — so the
 * guide told paying customers to ask an administrator for an API key while the
 * same code answered fine next door. Consolidating on Anthropic leaves one
 * provider and one variable to get right per environment, and removes a live
 * footgun: AiOrgSettings.model holds a *Gemini* model name, and
 * lib/ai/assessment.ts carries a comment warning that it must never be handed
 * to Anthropic.
 *
 * Cost is the whole design here. Three things keep it down:
 *
 *   1. The corpus is a cached prefix. It is ~14k tokens and identical on every
 *      request, so a cache hit costs roughly a tenth of the input price. That
 *      only holds while the prefix is stable byte-for-byte — see below.
 *   2. Haiku is the default. This is grounded question-answering over supplied
 *      context, not reasoning, and the corpus does the hard part.
 *   3. The caller answers well-phrased questions from the corpus directly,
 *      without reaching this module at all.
 *
 * Set ANTHROPIC_GUIDE_MODEL to override the model — `claude-opus-5` if answer
 * quality ever matters more than the bill.
 */

const DEFAULT_MODEL = "claude-haiku-4-5";

/** Effort is rejected on Haiku 4.5 and Sonnet 4.5; it is a knob on newer models. */
function supportsEffort(model: string): boolean {
  return !/haiku|sonnet-4-5/i.test(model);
}

export function guideModel(): string {
  return process.env.ANTHROPIC_GUIDE_MODEL?.trim() || DEFAULT_MODEL;
}

export function guideConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type GuideTurn = { role: "user" | "assistant"; text: string };

/**
 * The cached half of the prompt.
 *
 * Everything here must be identical on every request or the cache never hits
 * and each question pays full price for all ~14k tokens. Nothing
 * per-user, per-org, per-question or time-dependent may appear in this string.
 * `corpusForModel()` is asserted stable by its own test for the same reason.
 */
function cachedSystem(): string {
  return [
    "You are the Duuka ProMax guide. You explain how to use this business management system.",
    "",
    "Answer only from the procedures below. They describe this system as it actually is.",
    "",
    "Rules:",
    "- If a procedure covers the question, give its steps in order, in your own words, and name the route the user starts from.",
    "- If nothing covers it, say so plainly and name the closest area of the system. Do not invent a screen, a button or a menu item.",
    "- Never invent a control label. If the procedure says 'use the row's actions menu', say that rather than guessing a button name.",
    "- Be brief. Someone is standing at a counter with a customer waiting.",
    "- Answer how to use the system. For questions about what is happening in the business — figures, what is overdue, what to prioritise — point the user at AI Insights and the Business Copilot instead.",
    "",
    "PROCEDURES",
    "",
    corpusForModel(),
  ].join("\n");
}

/**
 * Ask the guide. Returns a stream of answer text plus the usage, once known.
 *
 * `orgKnowledge` is the workspace's own articles, retrieved per question. It is
 * deliberately placed AFTER the cache breakpoint: it varies by org and by
 * query, and putting it inside the cached block would invalidate the corpus
 * cache on every request — the single most expensive mistake available here.
 */
export async function askGuide(params: {
  question: string;
  history?: GuideTurn[];
  orgKnowledge?: string;
}): Promise<{
  textStream: AsyncGenerator<string>;
  usage: () => { cacheRead: number; cacheWrite: number; input: number; output: number } | null;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");

  const client = new Anthropic({ apiKey });
  const model = guideModel();

  const history = (params.history ?? [])
    .filter((m) => m.text.trim().length > 0)
    .slice(-8);
  // The API requires the first turn to be from the user.
  while (history.length && history[0]!.role !== "user") history.shift();

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.text }) satisfies Anthropic.MessageParam),
    { role: "user", content: params.question },
  ];

  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: cachedSystem(),
      // An hour, not the five-minute default: questions arrive sporadically
      // through a working day, and at five minutes most of them would miss.
      cache_control: { type: "ephemeral", ttl: "1h" },
    },
  ];
  if (params.orgKnowledge?.trim()) {
    system.push({
      type: "text",
      text: `This workspace has added its own notes. Prefer them where they conflict with the general procedures:\n\n${params.orgKnowledge.trim()}`,
    });
  }

  const stream = client.messages.stream({
    model,
    // A guide answer is a short set of steps. Room for that and no more —
    // output tokens are five times the price of input.
    max_tokens: 1200,
    system,
    messages,
    ...(supportsEffort(model) ? { output_config: { effort: "low" as const } } : {}),
  });

  let seen: { cacheRead: number; cacheWrite: number; input: number; output: number } | null = null;

  async function* textStream(): AsyncGenerator<string> {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
    const final = await stream.finalMessage();
    seen = {
      cacheRead: final.usage.cache_read_input_tokens ?? 0,
      cacheWrite: final.usage.cache_creation_input_tokens ?? 0,
      input: final.usage.input_tokens ?? 0,
      output: final.usage.output_tokens ?? 0,
    };
  }

  return { textStream: textStream(), usage: () => seen };
}

/**
 * Turn an SDK failure into something a person at a counter can act on.
 * Never leak the key, the model id, or a raw stack.
 */
export function guideErrorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "The AI Guide is not set up correctly — its API key was rejected. Ask an administrator to check it.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "The AI Guide is busy right now. Try again in a moment.";
  }
  if (err instanceof Anthropic.APIError) {
    return `The AI Guide could not answer just now (error ${err.status}). Try again, or search the help articles.`;
  }
  return "The AI Guide could not answer just now. Try again in a moment.";
}
