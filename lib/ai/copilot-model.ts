import Anthropic from "@anthropic-ai/sdk";

import type { BusinessDataPack } from "@/lib/ai/business-metrics";

/**
 * The Business Copilot's model call: Claude, over the workspace's own numbers.
 *
 * Ported off Gemini alongside the AI Guide, for the same reason. The Gemini key
 * existed on the care deployment but not on the commercial one, so on app this
 * fell through to the rules-based answer on every question while looking like a
 * model had replied — the worst of the two failure modes, because it was silent.
 *
 * Caching works differently here than it does for the guide, and it is worth
 * being straight about why. The guide sends a ~14k-token corpus that is
 * identical every time, so a cache hit saves most of the input cost. The
 * copilot's input is mostly the live data pack, which changes on every request
 * and can never be cached. What *is* stable is the instruction block and the
 * metric definitions below — and those are worth writing out properly anyway,
 * because a model that does not know what `cashMarginSignal` measures will
 * misread it. Making that block accurate is what gives caching something to
 * bite on; padding it to reach the threshold would not be.
 *
 * So: caching helps less here than in the guide, and the saving is real but
 * smaller. The bigger cost lever for this feature is that the rules-based
 * answer is genuinely good and costs nothing.
 */

const DEFAULT_MODEL = "claude-haiku-4-5";

function supportsEffort(model: string): boolean {
  return !/haiku|sonnet-4-5/i.test(model);
}

export function copilotModel(): string {
  return process.env.ANTHROPIC_COPILOT_MODEL?.trim() || DEFAULT_MODEL;
}

export function copilotConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * The stable half: how to answer, and what the numbers mean.
 *
 * Must not vary between requests — no timestamps, no org name, no question.
 * The data pack carries all of that and goes after the breakpoint.
 */
function cachedSystem(): string {
  return [
    "You are the Business Copilot for Duuka ProMax, answering owners and managers about their own business.",
    "",
    "The manager can already see the raw numbers on screen. Your job is to interpret them:",
    "say what is abnormal, why it matters, and what to do about it.",
    "",
    "Rules:",
    "- Do not restate figures they are already looking at. Lead with the insight, not a recap.",
    "- Use only the supplied metrics. Never invent a number, a client name, or a job note.",
    "- The metrics are aggregates for one workspace. You do not have individual customer records, and should not imply otherwise.",
    "- If something is healthy or zero, skip it. Only raise what needs attention.",
    "- Be specific: name the pattern, the risk, and the action. A manager should be able to act on the answer today.",
    "- If the data cannot answer the question, say so and name the page in the system that holds what is missing.",
    "- If everything is genuinely healthy, say that in one sentence rather than manufacturing a concern.",
    "- Keep it short. Sections only when there is more than one real issue.",
    "",
    "WHAT THE METRICS MEAN",
    "",
    "Period: figures cover the current calendar month unless the field name says otherwise.",
    "Fields ending Prev are the same measure for the previous month; fields ending ChangePct compare the two.",
    "",
    "repairs.openJobs — jobs not yet completed or closed.",
    "repairs.overdueJobs — open jobs older than 7 days. A backlog signal.",
    "repairs.staleJobs — open jobs with no update for 3 or more days. Different from overdue: these are being ignored rather than merely slow.",
    "repairs.awaitingApproval — quoted, waiting on the client to say yes or no. Work is legitimately stopped; the risk is that nobody chases.",
    "repairs.waitingForParts — approved but blocked on stock. Cross-reference inventory.lowStockParts.",
    "repairs.averageTurnaroundDays — receipt to completion, for jobs completed this month.",
    "repairs.statusDistribution — where open work is piled up.",
    "",
    "sales.posCashReceived — counter sales paid on the spot.",
    "sales.invoiceCashReceived — money collected against invoices.",
    "sales.openLeads / wonLeads / pipelineValue — the sales pipeline and its estimated value.",
    "sales.targetProgressPct — progress against the set target, or null if no target exists.",
    "",
    "finance.cashReceived — cash actually collected this month, across all channels.",
    "finance.cashReceivedByChannel — that total split by repairs, products, corporate and unallocated.",
    "finance.expenses — recorded business spending this month.",
    "finance.externalRepairCost — paid to outside technicians.",
    "finance.supplierPaid — cash actually paid to suppliers this month, including transfer fees.",
    "finance.totalCashOut — every way cash left the business this month: expenses + supplierPaid + externalRepairCost. This is the answer to \"how much have I spent\".",
    "finance.cashMarginSignal — cashReceived minus externalRepairCost minus expenses minus supplierPaid. Negative means more went out than came in this month. It is a cash signal, not accounting profit: it counts stock when it is paid for rather than when it is sold, so a big restock month reads negative even when trading is healthy.",
    "finance.receivables — owed to the business by customers.",
    "finance.payables — owed by the business to suppliers.",
    "finance.overdueInvoices — customer invoices past their due date.",
    "finance.overdueSupplierBills — supplier bills past their due date.",
    "",
    "inventory.activeParts — items being tracked.",
    "inventory.lowStockParts — items at or below their reorder level.",
    "inventory.topLowStockParts — the worst of those, with quantity and reorder level.",
    "",
    "today.collected — cash received so far today; today.collectedYesterday is the same figure for yesterday, for comparison.",
    "today.collectedByChannel — today's cash split by repairs, products, corporate and unallocated.",
    "today.spent — cash out today: expensesPaid + supplierPaid.",
    "today.netCash — collected minus spent, today only.",
    "today.date — the day these figures cover, so you can say which day you mean.",
    "Use the today block when asked about today, this morning, or so far. Everything else is the calendar month.",
    "",
    "riskSignals — booleans the system has already evaluated. Treat them as confirmed, not as things to re-derive.",
    "",
    "A profitable month with no cash is an ordinary situation, not a contradiction:",
    "money is tied up in receivables and stock. When cashMarginSignal is negative but",
    "receivables are high, collections is the lever, not cost-cutting.",
  ].join("\n");
}

/**
 * Ask the copilot. Returns the answer text, or null if the model produced none —
 * the caller falls back to the rules-based answer, which is always available.
 */
export async function askCopilot(params: {
  question: string;
  dataPack: BusinessDataPack;
  orgKnowledge?: string;
}): Promise<{ text: string; usage: { cacheRead: number; cacheWrite: number; input: number; output: number } } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");

  const client = new Anthropic({ apiKey });
  const model = copilotModel();

  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: cachedSystem(),
      // An hour rather than the five-minute default: managers ask a few
      // questions in a sitting, then nothing for hours.
      cache_control: { type: "ephemeral", ttl: "1h" },
    },
  ];
  if (params.orgKnowledge?.trim()) {
    system.push({
      type: "text",
      text: `Notes this workspace has written about how it operates:\n\n${params.orgKnowledge.trim()}`,
    });
  }

  const response = await client.messages.create({
    model,
    // Enough for a few short sections. Output is five times the input price,
    // and a manager will not read more than this anyway.
    max_tokens: 1200,
    system,
    messages: [
      {
        role: "user",
        content: [
          `Question: ${params.question}`,
          "",
          "Metrics for this workspace:",
          JSON.stringify(params.dataPack, null, 2),
        ].join("\n"),
      },
    ],
    ...(supportsEffort(model) ? { output_config: { effort: "low" as const } } : {}),
  });

  // A refusal carries no usable content; fall back rather than render an empty
  // answer. Guarded before reading content, because stop_details is only
  // populated on refusal and content may be empty.
  if (response.stop_reason === "refusal") return null;

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) return null;

  return {
    text,
    usage: {
      cacheRead: response.usage.cache_read_input_tokens ?? 0,
      cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
      input: response.usage.input_tokens ?? 0,
      output: response.usage.output_tokens ?? 0,
    },
  };
}

/** Whether the failure is worth telling the user about specifically. */
export function copilotErrorNote(err: unknown): string | null {
  if (err instanceof Anthropic.RateLimitError) return "The copilot is busy — this answer comes from the built-in rules instead.";
  if (err instanceof Anthropic.AuthenticationError) return "The copilot's API key was rejected — this answer comes from the built-in rules instead.";
  return null;
}
