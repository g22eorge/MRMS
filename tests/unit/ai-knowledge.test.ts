import { describe, it, expect } from "bun:test";
import {
  PROCEDURES,
  duplicateIds,
  brokenLinks,
  coverage,
  matchProcedure,
  renderProcedure,
  corpusForModel,
  byId,
} from "@/lib/ai-knowledge";

/**
 * The knowledge base is a product surface, not a config file: it decides
 * whether the assistant can answer anything at all. These tests exist so it
 * degrades loudly rather than quietly.
 *
 * The failure this guards against is specific. The procedures used to live as
 * branches inside app/api/ai-guide/route.ts, reachable only through fifteen
 * keyword conditions — so a question phrased any other way got nothing, and
 * nobody could tell which parts of the system were undocumented. Moving them
 * into data makes both answerable.
 */

describe("the corpus is internally consistent", () => {
  it("has no duplicate ids", () => {
    // Feedback and answer attribution are keyed on id. A duplicate silently
    // sends one procedure's ratings to another.
    expect(duplicateIds()).toEqual([]);
  });

  it("has no dead 'you may also need' links", () => {
    expect(brokenLinks()).toEqual([]);
  });

  it("gives every procedure an id, a question and at least two steps", () => {
    const thin = PROCEDURES.filter((p) => !p.id || !p.question || p.steps.length < 2);
    expect(thin.map((p) => p.id)).toEqual([]);
  });

  it("uses kebab-case ids, so they stay stable and greppable", () => {
    const bad = PROCEDURES.filter((p) => !/^[a-z][a-z0-9-]*$/.test(p.id));
    expect(bad.map((p) => p.id)).toEqual([]);
  });

  it("points every stated route at a real path", () => {
    const bad = PROCEDURES.filter((p) => p.route && !p.route.startsWith("/"));
    expect(bad.map((p) => p.id)).toEqual([]);
  });
});

describe("every module a user can stand in is documented", () => {
  it("leaves no module without a single procedure", () => {
    // This is the check that found `getting-started` and `reports` missing
    // after the first pass. It is the whole reason the corpus counts itself.
    expect(coverage().undocumented).toEqual([]);
  });

  it("covers the workflows that carry money end to end", () => {
    for (const id of [
      "job-create", "job-complete",
      "quote-create", "quote-to-invoice",
      "inv-issue", "pay-collect", "pay-receipt",
      "doc-credit-vs-refund", "doc-refund",
      "pos-sell", "pos-deposit",
      "inv-goods-received", "inv-stock-count",
      "fin-expense", "fin-reports",
    ]) {
      expect(byId(id), `missing procedure: ${id}`).toBeDefined();
    }
  });

  it("is substantial enough to be worth consulting", () => {
    // Guards the guard: an empty corpus would pass every check above.
    expect(PROCEDURES.length).toBeGreaterThan(50);
    expect(coverage().approxWords).toBeGreaterThan(3000);
  });
});

describe("the matcher answers confidently or not at all", () => {
  it("matches plainly-phrased questions", () => {
    expect(matchProcedure("how do I book in a new repair?")?.id).toBe("job-create");
    expect(matchProcedure("how do I receive stock")?.id).toBe("inv-goods-received");
    expect(matchProcedure("why did the customer not get a message?")?.id).toBe("comms-why-no-message");
    expect(matchProcedure("difference between credit note and refund")?.id).toBe("doc-credit-vs-refund");
  });

  it("refuses questions it has no business answering", () => {
    // A wrong confident answer is worse than deferring to the model, which
    // has the whole corpus and can say it does not know.
    for (const q of ["what is the weather today", "asdf", "hi", ""]) {
      expect(matchProcedure(q)).toBeNull();
    }
  });

  it("does not match on stop words alone", () => {
    // "how do I" appears in most questions; matching on it would return an
    // arbitrary procedure for anything phrased as a question.
    expect(matchProcedure("how do I")).toBeNull();
  });
});

describe("what the reader and the model each receive", () => {
  it("renders a procedure with its route, steps and follow-ons", () => {
    const text = renderProcedure(byId("pay-collect")!);
    expect(text).toContain("/documents/invoices");
    expect(text).toContain("1. ");
    expect(text).toContain("You may also need:");
  });

  it("builds a model prefix that is stable byte-for-byte", () => {
    // Prompt caching is a prefix match: one varying byte and every request
    // pays full price for the whole corpus. This is the cheapest possible
    // guard against someone interpolating a timestamp or a user name.
    expect(corpusForModel()).toBe(corpusForModel());
  });

  it("keeps the model prefix large enough to cache", () => {
    // Below roughly 1024 tokens a prefix silently will not cache at all.
    expect(corpusForModel().length).toBeGreaterThan(8000);
  });
});
