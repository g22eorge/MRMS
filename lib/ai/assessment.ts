import Anthropic from "@anthropic-ai/sdk";

import { getAiSettings, logAiPrompt, redactPii } from "@/lib/ai-governance";

export type AssessmentDraft = {
  summary: string;
  findings: string;
  recommendedWork: string;
  riskNotes: string;
};

export type AssessmentJobInput = {
  jobNumber: string;
  brand: string;
  model: string;
  deviceType: string;
  issueDescription: string;
  diagnosisNotes?: string | null;
  recommendedRepair?: string | null;
  partsNeeded?: string | null;
  technicianNotes?: string | null;
};

// Structured-output schema: guarantees Claude returns exactly the four
// string fields the report expects, so no fence-stripping / lenient parsing.
const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    findings: { type: "string" },
    recommendedWork: { type: "string" },
    riskNotes: { type: "string" },
  },
  required: ["summary", "findings", "recommendedWork", "riskNotes"],
} as const;

/**
 * Draft a customer-facing assessment report from a repair's real details using
 * Anthropic's Claude. Returns a structured draft that STAFF then review/edit
 * before publishing to the customer — never auto-published. Degrades gracefully
 * (no API key / AI disabled / model error / refusal) so staff can always fall
 * back to writing the report by hand.
 *
 * Model defaults to `claude-sonnet-5`; override with `ANTHROPIC_MODEL` (e.g.
 * `claude-opus-5` for top-tier prose, `claude-haiku-4-5` for lowest cost).
 */
export async function generateAssessmentDraft(params: {
  orgId: string;
  userId: string;
  job: AssessmentJobInput;
}): Promise<{ ok: true; draft: AssessmentDraft } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "AI is not configured (ANTHROPIC_API_KEY missing) — write the report manually below." };
  }

  const settings = await getAiSettings(params.orgId);
  if (!settings.aiEnabled) {
    return { ok: false, error: "AI is disabled for this workspace — write the report manually below." };
  }

  // Note: settings.model holds a Gemini model name (used by the AI Guide chat),
  // so it must NOT be passed to Anthropic. Use a dedicated Claude model.
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
  // `effort` is rejected (400) on Haiku 4.5 / Sonnet 4.5; it's a cost knob on
  // the newer models. Send it only where it's supported.
  const supportsEffort = !/haiku|sonnet-4-5/i.test(model);
  const j = params.job;

  const system = [
    "You are a senior device-repair technician writing an official, customer-facing hardware assessment and repair report for a professional repair business.",
    "Write for a non-technical business customer: clear, confident, and reassuring, in a professional consultancy tone.",
    "Be strictly accurate to the details provided — never invent faults, parts, causes, or costs that are not supported by the input.",
    "Expand the raw technician notes into well-structured, well-expounded professional prose (not terse one-liners), but stay grounded in the facts given.",
    "Field guidance:",
    "- summary: a concise 2-4 sentence overview of the device, the reported problem, and the overall outcome/conclusion of the assessment.",
    "- findings: the diagnostic findings written out fully — what was observed, tested, and confirmed, and the likely root cause. Multiple sentences or short paragraphs are welcome.",
    "- recommendedWork: the recommended solution and the scope of work to restore the device, explained clearly with the reasoning behind it.",
    "- riskNotes: warranty, after-service, and any risks, caveats, or preventative advice the customer should be aware of.",
    "Do not use markdown headings, bullet characters, or code fences inside the field values — plain prose only.",
  ].join("\n");

  const prompt = [
    `Repair job number: ${j.jobNumber}`,
    `Device: ${j.brand} ${j.model} (${j.deviceType})`,
    `Reported issue: ${j.issueDescription}`,
    `Technician diagnosis: ${j.diagnosisNotes ?? "n/a"}`,
    `Recommended repair: ${j.recommendedRepair ?? "n/a"}`,
    `Parts involved: ${j.partsNeeded ?? "n/a"}`,
    `Technician notes: ${j.technicianNotes ?? "n/a"}`,
    "",
    "Write the assessment report for this repair.",
  ].join("\n");

  await logAiPrompt({
    orgId: params.orgId,
    userId: params.userId,
    feature: "ASSESSMENT",
    model,
    question: redactPii(prompt),
    mode: "anthropic",
  }).catch(() => {});

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system,
      output_config: {
        format: { type: "json_schema", schema: DRAFT_SCHEMA },
        ...(supportsEffort ? { effort: "low" as const } : {}),
      },
      messages: [{ role: "user", content: prompt }],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "The AI declined to draft this report — write it manually below." };
    }

    const raw = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const parsed = JSON.parse(raw) as Partial<AssessmentDraft>;
    return {
      ok: true,
      draft: {
        summary: String(parsed.summary ?? "").trim(),
        findings: String(parsed.findings ?? "").trim(),
        recommendedWork: String(parsed.recommendedWork ?? "").trim(),
        riskNotes: String(parsed.riskNotes ?? "").trim(),
      },
    };
  } catch {
    return { ok: false, error: "The AI draft could not be generated — write the report manually below." };
  }
}
