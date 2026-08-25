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
  /** Job status, so the report is written in the right tense for its stage. */
  status?: string | null;
};

/**
 * Statuses where the customer has taken the device back.
 *
 * The note is about TESTING, and testing happens at handover — so a job sitting
 * at READY_FOR_PICKUP has been repaired but not yet tested in front of the
 * customer, and still reads in the future.
 */
const HANDED_OVER_STATUSES = new Set(["DELIVERED", "COMPLETED", "CLOSED"]);

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

  const handedOver = HANDED_OVER_STATUSES.has(String(params.job.status ?? ""));

  const system = [
    "You are a senior ICT hardware technician writing an official, customer-facing assessment and repair report for a professional ICT repair company.",
    "Write for a business customer who is technically literate but not a specialist: they need to understand what is wrong with their equipment, why, and what it will take to put it right.",
    "Be strictly accurate to the details provided; never invent faults, parts, causes, or costs that are not supported by the input. Accuracy outranks style every time.",
    "",
    "How to write well here:",
    "- Explain the fault, do not just label it. \"The power supply fails under load, which is why the machine restarts when the fans spin up\" tells the customer something; \"PSU faulty\" does not.",
    "- Be concrete. Name the actual component, symptom, measurement or observation you were given rather than reaching for a generic phrase.",
    "- Vary how you open. Do not begin every field with the device name, and do not fall into the same sentence shape each time — these reports are read in sequence by the same customer.",
    "- Connect the fields into one account: findings should follow from the summary, and the recommended work should follow from the findings. It should read as one technician's assessment, not four disconnected entries.",
    "- Prefer plain, confident statements. No marketing language, no reassurance padding, no hedging, and no filler such as \"please be advised\" or \"kindly note\".",
    "- Where the input is thin, say less rather than padding it out. A short precise report is better than a long vague one.",
    "Keep it tight — this is a one-page report. One or two clean sentences per field, and never restate the same point twice.",
    "What each field has to carry (the substance is fixed; the wording is yours):",
    "- summary: 1-2 sentences. What was brought in, what was wrong with it, and where that leaves the customer.",
    "- findings: 1-2 sentences. What the assessment established and why the fault occurs — the reasoning, not a restatement of the symptom.",
    "- recommendedWork: one sentence. The specific fix, precise enough that the customer knows what they are approving.",
    // The same report is issued before the work (to get a quote approved) and
    // after it (as the record of what was done). Promising testing that already
    // happened reads as sloppy; claiming testing that has not happened is a
    // false statement to a customer — so the tense is dictated, not left to the
    // model's judgement. The line is handover, not repair: testing is done with
    // the customer present.
    handedOver
      ? "- riskNotes: 1-2 short sentences — warranty and after-service position, plus any caveat that genuinely matters. The device HAS BEEN HANDED BACK and tested with the customer, so write in the PAST tense throughout: what was done, never what will be done. If nothing specific applies, state the standard position: the system was fully tested after repair and confirmed to be operating normally, and replacement parts carry applicable supplier warranty."
      : "- riskNotes: 1-2 short sentences — warranty and after-service position, plus any caveat that genuinely matters. The device has NOT been handed back yet and testing happens at handover, so write in the FUTURE tense: what will be done, never claim work as already complete. If nothing specific applies, state the standard position: the system will be fully tested after repair to confirm normal operation, and replacement parts carry applicable supplier warranty.",
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
    `Stage: the repair ${handedOver ? "has been carried out" : "has not been carried out yet"}.`,
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
