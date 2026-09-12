import { describe, it, expect, mock, afterEach } from "bun:test";

const upserts: Array<{ base: string; quote: string; rate: number }> = [];

mock.module("@/lib/prisma", () => ({
  prisma: {
    fxReferenceRate: {
      upsert: async (args: { create: { base: string; quote: string; rate: number } }) => {
        upserts.push({ base: args.create.base, quote: args.create.quote, rate: args.create.rate });
        return args.create;
      },
    },
  },
}));

const { refreshReferenceRates } = await import("../../lib/currency/reference-rate");

/** A provider that answers with the shape the module expects. */
const okFetch = (rates: Record<string, number>) =>
  (async () => ({ ok: true, status: 200, json: async () => ({ rates }) })) as unknown as typeof fetch;

afterEach(() => { upserts.length = 0; });

describe("refreshReferenceRates", () => {
  it("caches a rate for each pair the business actually buys in", async () => {
    const r = await refreshReferenceRates({
      quote: "UGX", bases: ["AED", "CNY"], fetchImpl: okFetch({ UGX: 1000 }),
    });
    expect(r.every((x) => x.ok)).toBe(true);
    expect(upserts.map((u) => u.base).sort()).toEqual(["AED", "CNY"]);
  });

  it("skips the organisation's own currency", async () => {
    // Nothing to compare a currency against itself, and a 1.0 row would be a
    // trap for any later reader.
    const r = await refreshReferenceRates({ quote: "UGX", bases: ["UGX"], fetchImpl: okFetch({ UGX: 1 }) });
    expect(r).toHaveLength(0);
    expect(upserts).toHaveLength(0);
  });

  it("skips a currency the system does not support", async () => {
    const r = await refreshReferenceRates({ quote: "UGX", bases: ["XYZ"], fetchImpl: okFetch({ UGX: 5 }) });
    expect(r).toHaveLength(0);
  });

  it("records a provider error instead of throwing", async () => {
    // A monitoring feature must never be the reason a scheduled job dies.
    const bad = (async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
    const r = await refreshReferenceRates({ quote: "UGX", bases: ["AED"], fetchImpl: bad });
    expect(r[0].ok).toBe(false);
    expect(r[0].error).toContain("503");
    expect(upserts).toHaveLength(0);
  });

  it("rejects a response with no usable rate rather than caching a zero", async () => {
    // A cached 0 would make every premium calculation return null forever, or
    // worse, divide by zero somewhere downstream.
    for (const body of [{}, { rates: {} }, { rates: { UGX: 0 } }, { rates: { UGX: "many" } }]) {
      upserts.length = 0;
      const f = (async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;
      const r = await refreshReferenceRates({ quote: "UGX", bases: ["AED"], fetchImpl: f });
      expect(r[0].ok).toBe(false);
      expect(upserts).toHaveLength(0);
    }
  });

  it("keeps going after one pair fails", async () => {
    let n = 0;
    const flaky = (async () => {
      n += 1;
      if (n === 1) throw new Error("network down");
      return { ok: true, status: 200, json: async () => ({ rates: { UGX: 520 } }) };
    }) as unknown as typeof fetch;
    const r = await refreshReferenceRates({ quote: "UGX", bases: ["AED", "CNY"], fetchImpl: flaky });
    expect(r[0].ok).toBe(false);
    expect(r[1].ok).toBe(true);
    expect(upserts).toHaveLength(1);
  });
});
