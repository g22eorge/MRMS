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
    "You are a senior ICT hardware technician writing an official, customer-facing assessment and repair report for a professional ICT repair company.",
    "Write for a business customer: clear, precise, and professional. Use correct technical terms but keep every point straightforward — no filler, no marketing language, no reassurance padding, no hedging.",
    "Be strictly accurate to the details provided; never invent faults, parts, causes, or costs that are not supported by the input.",
    "Keep it concise — this is a one-page report. Prefer one or two clean sentences per field over paragraphs. Do not restate the same point twice.",
    "Field guidance (match this length exactly):",
    "- summary: 1-2 sentences — the device, the reported problem, and the assessment conclusion.",
    "- findings: 1-2 sentences — what the diagnostic assessment established and the root cause.",
    "- recommendedWork: one sentence — the specific fix required to restore normal operation.",
    "- riskNotes: 1-2 short sentences — warranty / after-service position and any essential caveat. If nothing specific applies, state the standard position: the system is tested after repair and replacement parts carry applicable supplier warranty.",
    "Plain prose only — no markdown, headings, bullet characters, or code fences inside field values.",
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
  } catch (err) {
    // Surface the real cause server-side (model/param/SDK/network) instead of
    // silently swallowing it — the customer-facing message stays generic.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[assessment] AI draft failed (model=${model}): ${msg}`);
    return { ok: false, error: "The AI draft could not be generated — write the report manually below." };
  }
}
