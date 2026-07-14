// @ts-nocheck
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";

import { ensureDefaultAiKnowledge, formatKnowledgeContext, retrieveAiKnowledge } from "@/lib/ai-knowledge";
import { buildBusinessDataPack, changePhrase, type BusinessDataPack } from "@/lib/ai/business-metrics";
import { getAiSettings, logAiPrompt, redactPii } from "@/lib/ai-governance";
import { can } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUserRoleOptional } from "@/lib/session";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are the Duuka ProMax Business Copilot for owners and managers.

The user can already see the raw numbers on their dashboard — do NOT restate them.
Your only job is to INTERPRET the data: spot what is abnormal, explain why it matters,
and recommend specific actions.

Rules:
- Never repeat or summarise numbers the manager already sees on screen.
- Skip generic phrases like "revenue is X" or "you have Y open jobs" — they already know.
- Lead with the most important insight or risk, not a data recap.
- Be direct and specific. Name the pattern, the risk, and the action.
- Use only the supplied tenant-scoped metrics. Never invent data, client names, or job notes.
- If a metric is zero or healthy, skip it — only flag what needs attention.
- Respond in plain language with short sections. Use Risks and Recommended Actions only
  when there are real issues. If everything is healthy, say so in one sentence.
- If data is insufficient, name exactly which Duuka ProMax page has the missing information.`;

function formatAmount(value: number, currency: string) {
  return `${currency} ${Math.round(value).toLocaleString()}`;
}

function riskList(data: BusinessDataPack) {
  return [
    data.repairs.overdueJobs > 0
      ? `${data.repairs.overdueJobs} open repair job(s) are older than 7 days. These are likely client-experience and cash-conversion risks.`
      : null,
    data.repairs.staleJobs > 0
      ? `${data.repairs.staleJobs} open job(s) have not been updated for 3+ days. Require owner updates or status movement.`
      : null,
    data.repairs.awaitingApproval > 0
      ? `${data.repairs.awaitingApproval} job(s) are awaiting approval. These need client follow-up before work can move forward.`
      : null,
    data.repairs.waitingForParts > 0
      ? `${data.repairs.waitingForParts} job(s) are waiting for parts. Connect this with low-stock and open purchase orders.`
      : null,
    data.inventory.lowStockParts > 0
      ? `${data.inventory.lowStockParts} active item(s) are at or below reorder level. Stockouts can delay repairs and sales.`
      : null,
    data.finance.overdueInvoices > 0
      ? `${data.finance.overdueInvoices} invoice(s) are overdue. Receivables outstanding: ${formatAmount(data.finance.receivables, data.currency)}.`
      : null,
    data.finance.overdueSupplierBills > 0
      ? `${data.finance.overdueSupplierBills} supplier bill(s) are overdue. Payables outstanding: ${formatAmount(data.finance.payables, data.currency)}.`
      : null,
    data.finance.cashReceived < data.finance.cashReceivedPrev
      ? `Cash received is ${changePhrase(data.finance.cashReceived, data.finance.cashReceivedPrev)}. Check repair collections, POS sales, invoice payments, and lead conversion.`
      : null,
    data.finance.cashMarginSignal < 0
      ? `Cash margin signal is negative at ${formatAmount(data.finance.cashMarginSignal, data.currency)} after external repair costs and expenses.`
      : null,
    data.sales.targetProgressPct !== null && data.sales.targetProgressPct < 80
      ? `Sales target progress is ${data.sales.targetProgressPct.toFixed(1)}%, below the 80% watch threshold.`
      : null,
  ].filter((item): item is string => Boolean(item));
}

function actionList(data: BusinessDataPack) {
  const actions = [
    data.repairs.overdueJobs > 0 || data.repairs.staleJobs > 0
      ? "Run a repair blocker review today: every overdue/stale job needs an owner, blocker, next action, and client update."
      : null,
    data.repairs.awaitingApproval > 0
      ? "Assign OPS/front desk to call clients awaiting approval and record approve/decline decisions on the job timeline."
      : null,
    data.repairs.waitingForParts > 0 || data.inventory.lowStockParts > 0
      ? "Review Stock Alerts and create purchase requests/orders for items blocking active jobs."
      : null,
    data.finance.overdueInvoices > 0
      ? "Prioritise collections by oldest and largest invoices; send reminders and issue receipts immediately after payment."
      : null,
    data.finance.cashMarginSignal < 0
      ? "Freeze non-essential expenses until collections improve or revenue catches up. Review high external repair costs."
      : null,
    data.sales.openLeads > 0
      ? "Work sales pipeline by value and stage: qualified/proposal leads should get same-day follow-up."
      : null,
    data.sales.targetProgressPct !== null && data.sales.targetProgressPct < 80
      ? "Review sales target gap and run a focused campaign or quote follow-up push this week."
      : null,
    data.finance.overdueSupplierBills > 0
      ? "Negotiate supplier bill timing where cash is tight, but protect suppliers for critical repair items."
      : null,
  ].filter((item): item is string => Boolean(item));

  return actions.length
    ? actions
    : ["No severe risk signal is currently dominant. Keep monitoring daily job movement, collections, low stock, and expense discipline."];
}

function fallbackAnswer(question: string, data: BusinessDataPack) {
  const focus = question.toLowerCase();
  const risks = riskList(data);
  const actions = actionList(data);
  const lines: string[] = [];

  // Only add a focus-specific insight when there is a genuine issue to flag
  if (focus.includes("inventory") || focus.includes("stock") || focus.includes("part")) {
    if (data.inventory.lowStockParts > 0) {
      lines.push(
        "Inventory risk",
        `${data.inventory.lowStockParts} item(s) are at or below reorder level${data.repairs.waitingForParts > 0 ? `, and ${data.repairs.waitingForParts} job(s) are already waiting for parts — these two lists need cross-referencing urgently` : ""}. Top items: ${data.inventory.topLowStockParts.map((p) => `${p.name} (${p.qtyOnHand} left, reorder at ${p.reorderLevel})`).join("; ")}.`,
      );
    } else {
      lines.push("Inventory is healthy - all items are above reorder level.");
    }
  } else if (focus.includes("repair") || focus.includes("job") || focus.includes("technician")) {
    if (data.repairs.overdueJobs > 0 || data.repairs.staleJobs > 0 || data.repairs.awaitingApproval > 0) {
      const blockers = [
        data.repairs.overdueJobs > 0 ? `${data.repairs.overdueJobs} overdue (>7 days)` : null,
        data.repairs.staleJobs > 0 ? `${data.repairs.staleJobs} stale (no update in 3+ days)` : null,
        data.repairs.awaitingApproval > 0 ? `${data.repairs.awaitingApproval} awaiting client approval` : null,
        data.repairs.waitingForParts > 0 ? `${data.repairs.waitingForParts} waiting for parts` : null,
      ].filter(Boolean).join(", ");
      lines.push("Repair bottlenecks", `Jobs are blocked across multiple stages: ${blockers}. Each needs an assigned owner and a specific next action today.`);
    } else {
      lines.push("Repair pipeline is moving — no overdue or stale jobs detected.");
    }
  } else if (focus.includes("cash") || focus.includes("finance") || focus.includes("profit") || focus.includes("expense")) {
    if (data.finance.cashMarginSignal < 0) {
      lines.push("Cash margin warning", `External repair costs (${formatAmount(data.finance.externalRepairCost, data.currency)}) and expenses are consuming more than revenue collected this month. Collections and cost control need immediate attention.`);
    } else if (data.finance.overdueInvoices > 0) {
      lines.push("Collections risk", `${data.finance.overdueInvoices} invoice(s) are overdue. Receivables sitting uncollected reduce available cash even when revenue looks healthy.`);
    } else {
      lines.push("Finance indicators are within normal range this month.");
    }
  } else if (focus.includes("sale") || focus.includes("lead") || focus.includes("target")) {
    if (data.sales.targetProgressPct !== null && data.sales.targetProgressPct < 80) {
      lines.push("Target gap", `Sales target progress is ${data.sales.targetProgressPct.toFixed(1)}% — below the 80% warning threshold. With ${data.sales.openLeads} open leads and pipeline value of ${formatAmount(data.sales.pipelineValue, data.currency)}, the gap needs active pipeline conversion this week.`);
    } else if (data.sales.openLeads > 0) {
      lines.push(`${data.sales.openLeads} open lead(s) in pipeline with ${formatAmount(data.sales.pipelineValue, data.currency)} estimated value. Prioritise qualified and proposal-stage leads for same-day follow-up.`);
    } else {
      lines.push("No open leads detected. Consider whether lead capture is being recorded in Duuka ProMax.");
    }
  }

  if (risks.length > 0) {
    lines.push("", "Risks", ...risks.map((r, i) => `${i + 1}. ${r}`));
  }

  lines.push(
    "",
    "Recommended actions",
    ...actions.map((a, i) => `${i + 1}. ${a}`),
  );

  return lines.filter((l) => l !== undefined).join("\n\n");
}

async function askGemini(apiKey: string, question: string, dataPack: BusinessDataPack, knowledgeContext = "", configuredModel?: string | null) {
  const modelNames = [
    configuredModel,
    process.env.GEMINI_MODEL,
    "gemini-1.5-flash",
    "gemini-2.0-flash",
  ].filter((model, index, models): model is string => Boolean(model) && models.indexOf(model) === index);

  let lastError: unknown;
  for (const modelName of modelNames) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: { temperature: 0.2, maxOutputTokens: 1600 },
      });
      const result = await model.generateContent([
        `Manager question: ${question}`,
        knowledgeContext ? `Relevant Duuka ProMax knowledge base articles:\n${knowledgeContext}` : "",
        `Tenant-scoped aggregate metrics JSON:\n${JSON.stringify(dataPack, null, 2)}`,
      ].filter(Boolean));
      return result.response.text().trim();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkRateLimit(`ai-business-copilot:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) return new Response("Rate limit exceeded. Please wait a moment.", { status: 429 });

  const { user } = await getCurrentUserRoleOptional();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!can.viewAccountsSummary(user)) return new Response("Forbidden", { status: 403 });
  const settings = await getAiSettings(user.orgId);
  if (!settings.aiEnabled || !settings.insightsEnabled) return new Response("AI Insights is disabled for this workspace.", { status: 403 });

  let body: { question?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }

  const question = redactPii(body.question?.trim() ?? "");
  if (!question) return new Response("Question is required.", { status: 400 });
  if (question.length > 1200) return new Response("Question is too long (max 1200 characters).", { status: 400 });

  const dataPack = await buildBusinessDataPack(user.orgId);
  const apiKey = process.env.GEMINI_API_KEY;
  await ensureDefaultAiKnowledge();
  const knowledgeContext = formatKnowledgeContext(await retrieveAiKnowledge(question, user.orgId, 4));

  if (!apiKey) {
    await logAiPrompt({ orgId: user.orgId, userId: user.id, feature: "AI_BUSINESS_COPILOT", question, contextSummary: knowledgeContext, mode: "fallback" });
    return new Response(fallbackAnswer(question, dataPack), {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-ai-mode": "fallback" },
    });
  }

  try {
    await logAiPrompt({ orgId: user.orgId, userId: user.id, feature: "AI_BUSINESS_COPILOT", model: settings.model ?? process.env.GEMINI_MODEL ?? "gemini-1.5-flash", question, contextSummary: knowledgeContext, mode: "gemini" });
    const text = await askGemini(apiKey, question, dataPack, knowledgeContext, settings.model);
    return new Response(text || fallbackAnswer(question, dataPack), {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[ai-business-copilot] Gemini error:", msg);
    const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota");
    if (isQuota) {
      return new Response("The AI Copilot has hit its request limit. Please try again in a minute, or check the Gemini API quota at aistudio.google.com.", {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-ai-mode": "quota" },
      });
    }
    return new Response(fallbackAnswer(question, dataPack), {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-ai-mode": "fallback" },
    });
  }
}
