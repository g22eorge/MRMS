import { NextResponse } from "next/server";

import { assertPlatformAdmin } from "@/lib/platform-admin";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import {
  getAnthropicApiKey,
  getGuideModel,
  getCopilotModel,
  probePlatformSettingStore,
} from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

/**
 * Do the stored Anthropic credentials actually work?
 *
 * The Anthropic settings form can store a key in platform settings and show a
 * green tick because that value was written — never that it was accepted. The
 * same lie this system had already told twice about payments and SMS: a stored
 * value is not a working credential.
 *
 * The provider settles it. Anthropic's Messages API accepts a tiny request and
 * returns usage metadata. If it answers with 200 and non-empty usage, the key
 * is real and the route handlers will be able to call it. If it refuses, the
 * message says why.
 *
 * Read-only, platform-admin only, and no secret is returned — only whether one
 * resolved, from where, and what the provider said about it.
 *
 * Cost: a single tiny request with ~1 output token. The system prompt is kept
 * minimal on purpose so this check itself does not burn tokens.
 */

type Verdict =
  | "READY"
  | "NO CREDENTIALS"
  | "CREDENTIALS REJECTED"
  | "SETTINGS UNREADABLE"
  | "PROVIDER ERROR";

const MINIMAL_SYSTEM = "You are a health-check probe. Respond with exactly one word: OK.";
const MINIMAL_USER = "health check";
const MINIMAL_MODEL = "claude-haiku-4-5";
const MAX_OUTPUT_TOKENS = 1;

export async function GET() {
  const admin = await assertPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rl = await rateLimit.platformAdmin(admin.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many admin operations. Wait a moment and retry." },
      { status: 429, headers: rateLimitHeaders(rl.retryAfterMs) },
    );
  }

  const store = await probePlatformSettingStore();

  const [dbKey, dbGuideModel, dbCopilotModel] = await Promise.all([
    getAnthropicApiKey().catch(() => null),
    getGuideModel().catch(() => null),
    getCopilotModel().catch(() => null),
  ]);

  const envKey = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
  const effectiveKey = dbKey ?? envKey;
  const source = dbKey ? "platform settings" : envKey ? "environment" : "none";

  let verdict: Verdict;
  let providerError: string | null = null;
  let providerUsage: {
    cacheRead: number;
    cacheWrite: number;
    input: number;
    output: number;
  } | null = null;
  let askedModel: string | null = null;

  if (!effectiveKey) {
    verdict = store.readable ? "NO CREDENTIALS" : "SETTINGS UNREADABLE";
  } else {
    // The provider is the only authority on whether a key is real.
    try {
      const client = new (await import("@anthropic-ai/sdk")).Anthropic({ apiKey: effectiveKey });
      const model = (dbGuideModel ?? process.env.ANTHROPIC_GUIDE_MODEL ?? MINIMAL_MODEL).trim() || MINIMAL_MODEL;
      askedModel = model;

      const res = await client.messages.create({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: MINIMAL_SYSTEM,
        messages: [{ role: "user", content: MINIMAL_USER }],
      });

      if (res.stop_reason === "refusal") {
        providerError = "Anthropic refused the request (stop_reason=refusal).";
        verdict = "CREDENTIALS REJECTED";
      } else {
        providerUsage = {
          cacheRead: res.usage.cache_read_input_tokens ?? 0,
          cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
          input: res.usage.input_tokens ?? 0,
          output: res.usage.output_tokens ?? 0,
        };
        verdict = "READY";
      }
    } catch (err) {
      providerError = err instanceof Error ? err.message.slice(0, 300) : "Anthropic did not answer";
      verdict = "CREDENTIALS REJECTED";
    }
  }

  const blockers: string[] = [];
  if (verdict === "NO CREDENTIALS") {
    blockers.push(
      "No Anthropic API key resolves, so the AI Guide and Business Copilot will not call the model.",
    );
  }
  if (verdict === "CREDENTIALS REJECTED") {
    blockers.push(
      `Anthropic rejected the configured key. ${providerError ? "Provider said: " + providerError : "Check the key in the Anthropic dashboard."}`,
    );
  }
  if (verdict === "READY" && dbGuideModel && !process.env.ANTHROPIC_GUIDE_MODEL) {
    blockers.push(
      "A guide model is stored in platform settings but ANTHROPIC_GUIDE_MODEL is not set in the environment. The stored value is used, but if this deployment is redeployed without the settings table, the guide will fall back to its built-in default.",
    );
  }

  return NextResponse.json({
    readOnly: true,
    verdict,
    canCallAnthropic: verdict === "READY",
    credentials: {
      resolved: Boolean(effectiveKey),
      source,
      /** Distinguishes "never configured" from "configured but unreadable". */
      absenceIsTrustworthy: store.readable,
      storedInDatabase: {
        apiKey: Boolean(dbKey),
        guideModel: dbGuideModel ?? null,
        copilotModel: dbCopilotModel ?? null,
      },
      /** The environment variable, if any, is never returned. Only whether it exists. */
      environmentVariablePresent: Boolean(envKey),
    },
    provider: {
      name: "Anthropic",
      checkedWith: "POST /v1/messages — a single tiny request",
      askedModel,
      accepted: verdict === "READY",
      usage: providerUsage,
      error: providerError,
    },
    note:
      "A green tick on the settings page means a value was stored, not that it works. " +
      "This asks the provider.",
  });
}
