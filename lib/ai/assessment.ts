import { GoogleGenerativeAI } from "@google/generative-ai";

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

/**
 * Draft a customer-facing assessment report from a repair's real details using
 * the org's configured Gemini model. Returns a structured draft that STAFF then
 * review/edit before publishing to the customer — never auto-published.
 * Degrades gracefully (no API key / AI disabled / model error) so staff can
 * always fall back to writing the report by hand.
 */
export async function generateAssessmentDraft(params: {
  orgId: string;
  userId: string;
  job: AssessmentJobInput;
}): Promise<{ ok: true; draft: AssessmentDraft } | { ok: false; error: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "AI is not configured (GEMINI_API_KEY missing) — write the report manually below." };
  }

  const settings = await getAiSettings(params.orgId);
  if (!settings.aiEnabled) {
    return { ok: false, error: "AI is disabled for this workspace — write the report manually below." };
  }
  const model = settings.model ?? process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const j = params.job;

  const prompt = [
    "You are a device-repair technician writing a professional, customer-facing assessment report.",
    "Write clearly for a non-technical business customer. Be accurate to the details provided; do not invent facts.",
    'Return STRICT JSON only, with exactly these string keys: "summary", "findings", "recommendedWork", "riskNotes".',
    "Keep each field concise (1-3 sentences).",
    "",
    `Device: ${j.brand} ${j.model} (${j.deviceType})`,
    `Reported issue: ${j.issueDescription}`,
    `Technician diagnosis: ${j.diagnosisNotes ?? "n/a"}`,
    `Recommended repair: ${j.recommendedRepair ?? "n/a"}`,
    `Parts involved: ${j.partsNeeded ?? "n/a"}`,
    `Technician notes: ${j.technicianNotes ?? "n/a"}`,
  ].join("\n");

  await logAiPrompt({
    orgId: params.orgId,
    userId: params.userId,
    feature: "ASSESSMENT",
    model,
    question: redactPii(prompt),
    mode: "gemini",
  }).catch(() => {});

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const gModel = genAI.getGenerativeModel({ model });
    const result = await gModel.generateContent(prompt);
    const raw = result.response.text().replace(/```json|```/g, "").trim();
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
