import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

import { guideModel, guideConfigured } from "@/lib/ai/guide-model";
import { copilotModel, copilotConfigured } from "@/lib/ai/copilot-model";

/**
 * One provider, and a cache that actually engages.
 *
 * Both the AI Guide and the Business Copilot ran on Gemini while assessment
 * drafting ran on Claude — two vendors, two keys, two ways to be misconfigured.
 *
 * The two deployments were configured differently, which is what made the
 * split expensive. care (mrms) had GEMINI_API_KEY and ANTHROPIC_API_KEY, so
 * everything worked there. app (mrms-apga), the commercial product, had
 * neither: the guide told paying customers to ask an administrator for a key,
 * and the copilot silently returned a keyword-matched canned answer with no
 * indication that no model had been called. One provider means one variable to
 * get right per environment instead of two, and one failure mode instead of
 * a matrix of them.
 *
 * These tests hold the port in place. The caching assertions matter most: a
 * cache breakpoint is easy to break by accident and the failure is invisible —
 * everything keeps working and every request quietly pays full price for the
 * whole prefix.
 */

const GUIDE_MODEL_SRC = readFileSync("lib/ai/guide-model.ts", "utf8");
const COPILOT_MODEL_SRC = readFileSync("lib/ai/copilot-model.ts", "utf8");
const GUIDE_ROUTE = readFileSync("app/api/ai-guide/route.ts", "utf8");
const COPILOT_ROUTE = readFileSync("app/api/ai-business-copilot/route.ts", "utf8");
const PKG = readFileSync("package.json", "utf8");

describe("there is one AI provider", () => {
  it("has no Gemini SDK left in the AI routes or their model modules", () => {
    for (const src of [GUIDE_MODEL_SRC, COPILOT_MODEL_SRC, COPILOT_ROUTE]) {
      expect(src).not.toContain("GoogleGenerativeAI");
      expect(src).not.toContain("@google/generative-ai");
      expect(src).not.toContain("GEMINI_API_KEY");
    }
    // The guide route keeps historical comments explaining why the stored chat
    // history still uses Gemini's "model" role name. Code, not prose, is what
    // must be clean.
    expect(GUIDE_ROUTE).not.toContain("GoogleGenerativeAI");
    expect(GUIDE_ROUTE).not.toContain("GEMINI_API_KEY");
  });

  it("no longer depends on the Gemini package at all", () => {
    expect(PKG).not.toContain("@google/generative-ai");
  });

  it("uses the official Anthropic SDK in both modules", () => {
    expect(GUIDE_MODEL_SRC).toContain('from "@anthropic-ai/sdk"');
    expect(COPILOT_MODEL_SRC).toContain('from "@anthropic-ai/sdk"');
  });

  it("reads one key, so there is one thing to configure and one to fail", () => {
    expect(guideConfigured()).toBe(Boolean(process.env.ANTHROPIC_API_KEY));
    expect(copilotConfigured()).toBe(Boolean(process.env.ANTHROPIC_API_KEY));
  });
});

describe("the model is a deliberate, overridable choice", () => {
  it("defaults to Haiku for both surfaces", () => {
    // Grounded question-answering over supplied context. The corpus and the
    // metric definitions do the hard part; this is not a reasoning task, and
    // the entry subscription tier is small.
    expect(guideModel()).toBe("claude-haiku-4-5");
    expect(copilotModel()).toBe("claude-haiku-4-5");
  });

  it("can be raised per surface without touching code", () => {
    const prevGuide = process.env.ANTHROPIC_GUIDE_MODEL;
    const prevCopilot = process.env.ANTHROPIC_COPILOT_MODEL;
    try {
      process.env.ANTHROPIC_GUIDE_MODEL = "claude-opus-5";
      process.env.ANTHROPIC_COPILOT_MODEL = "claude-opus-5";
      expect(guideModel()).toBe("claude-opus-5");
      expect(copilotModel()).toBe("claude-opus-5");
    } finally {
      if (prevGuide === undefined) delete process.env.ANTHROPIC_GUIDE_MODEL;
      else process.env.ANTHROPIC_GUIDE_MODEL = prevGuide;
      if (prevCopilot === undefined) delete process.env.ANTHROPIC_COPILOT_MODEL;
      else process.env.ANTHROPIC_COPILOT_MODEL = prevCopilot;
    }
  });

  it("sends effort only where the model accepts it", () => {
    // `effort` is rejected with a 400 on Haiku 4.5 and Sonnet 4.5. The
    // assessment module already learned this; both new modules follow it.
    for (const src of [GUIDE_MODEL_SRC, COPILOT_MODEL_SRC]) {
      expect(src).toContain("supportsEffort");
      expect(src).toContain("/haiku|sonnet-4-5/i");
    }
  });

  it("sends no deprecated thinking budget", () => {
    // budget_tokens is removed on current models and returns a 400.
    for (const src of [GUIDE_MODEL_SRC, COPILOT_MODEL_SRC]) {
      expect(src).not.toContain("budget_tokens");
    }
  });
});

describe("the cached prefix is set up to actually cache", () => {
  it("marks a cache breakpoint on the stable system block", () => {
    for (const src of [GUIDE_MODEL_SRC, COPILOT_MODEL_SRC]) {
      expect(src).toContain('cache_control: { type: "ephemeral"');
    }
  });

  it("uses the hour TTL, because questions arrive sporadically", () => {
    // At the five-minute default most questions in a working day would miss
    // the cache and pay full price for the whole prefix.
    for (const src of [GUIDE_MODEL_SRC, COPILOT_MODEL_SRC]) {
      expect(src).toContain('ttl: "1h"');
    }
  });

  it("puts everything volatile AFTER the breakpoint", () => {
    // This is the expensive mistake: anything per-org, per-question or
    // time-dependent inside the cached block invalidates it on every request.
    //
    // Comments are stripped first. Both modules explain in prose *why*
    // orgKnowledge sits outside the cached block, and matching that sentence
    // would fail the very file that documents the rule correctly.
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/[^\n]*$/gm, "");
    for (const src of [GUIDE_MODEL_SRC, COPILOT_MODEL_SRC]) {
      const body = stripComments(src);
      const cached = body.slice(body.indexOf("function cachedSystem"), body.indexOf("export async function ask"));
      expect(cached).not.toContain("orgKnowledge");
      expect(cached).not.toContain("params.question");
      expect(cached).not.toContain("Date.now");
      expect(cached).not.toContain("new Date");
      expect(cached).not.toContain("dataPack");
    }
  });

  it("puts the how-to corpus inside the guide's cached block, where the saving is", () => {
    const cached = GUIDE_MODEL_SRC.slice(
      GUIDE_MODEL_SRC.indexOf("function cachedSystem"),
      GUIDE_MODEL_SRC.indexOf("export async function askGuide"),
    );
    expect(cached).toContain("corpusForModel()");
  });

  it("reports cache usage, so a silently-broken cache is visible", () => {
    for (const src of [GUIDE_MODEL_SRC, COPILOT_MODEL_SRC]) {
      expect(src).toContain("cache_read_input_tokens");
    }
    for (const route of [GUIDE_ROUTE, COPILOT_ROUTE]) {
      expect(route).toContain("cacheRead=");
    }
  });
});

describe("the free path is preferred, and failure degrades rather than errors", () => {
  it("the guide answers from the corpus before it pays for a model", () => {
    const matchAt = GUIDE_ROUTE.indexOf("matchProcedure(message)");
    const askAt = GUIDE_ROUTE.indexOf("askGuide({");
    expect(matchAt).toBeGreaterThan(-1);
    expect(askAt).toBeGreaterThan(matchAt);
  });

  it("the guide attributes a matched answer to its procedure", () => {
    // So feedback lands on the entry that produced the answer.
    expect(GUIDE_ROUTE).toContain('"x-ai-guide-procedure"');
  });

  it("the copilot falls back to its rules on no key, no answer, or an error", () => {
    const calls = COPILOT_ROUTE.match(/fallbackAnswer\(question, dataPack\)/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });

  it("neither surface leaks provider detail into a user-facing error", () => {
    for (const src of [GUIDE_MODEL_SRC, COPILOT_MODEL_SRC]) {
      expect(src).not.toContain("aistudio.google.com");
    }
    expect(GUIDE_MODEL_SRC).toContain("guideErrorMessage");
  });
});
