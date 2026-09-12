import { describe, expect, it } from "bun:test";

import { computeWarrantyCost } from "../../lib/warranty/cost";

describe("computeWarrantyCost()", () => {
  it("adds parts, payouts and external fees into one total", () => {
    const c = computeWarrantyCost({
      claimsHonoured: 2,
      reservations: [
        { quantity: 2, unitCostSnapshot: 25_000 },  // 50,000
        { quantity: 1, unitCostSnapshot: 15_000 },  // 15,000
      ],
      payoutTotal: 30_000,
      jobs: [
        { externalTechFee: 20_000, clientBill: null },
        { externalTechFee: null, clientBill: null },
      ],
    });

    expect(c.partsCost).toBe(65_000);
    expect(c.payoutCost).toBe(30_000);
    expect(c.externalCost).toBe(20_000);
    expect(c.totalCost).toBe(115_000);
    expect(c.averagePerClaim).toBe(57_500);
  });

  it("values parts at the snapshot taken when they left the shelf", () => {
    // The snapshot is the whole point: a part that cost 10,000 then must not be
    // reported at today's price.
    const c = computeWarrantyCost({
      claimsHonoured: 1,
      reservations: [{ quantity: 3, unitCostSnapshot: 10_000 }],
      payoutTotal: 0,
      jobs: [{ externalTechFee: null, clientBill: null }],
    });
    expect(c.partsCost).toBe(30_000);
    expect(c.totalCost).toBe(30_000);
  });

  it("treats a missing cost snapshot as zero rather than NaN", () => {
    const c = computeWarrantyCost({
      claimsHonoured: 1,
      reservations: [
        { quantity: 2, unitCostSnapshot: null },
        { quantity: 1, unitCostSnapshot: 5_000 },
      ],
      payoutTotal: 0,
      jobs: [{ externalTechFee: null, clientBill: null }],
    });
    expect(c.partsCost).toBe(5_000);
    expect(Number.isNaN(c.totalCost)).toBe(false);
  });

  it("reports repairs that billed the customer separately, not inside the total", () => {
    const c = computeWarrantyCost({
      claimsHonoured: 2,
      reservations: [{ quantity: 1, unitCostSnapshot: 10_000 }],
      payoutTotal: 0,
      jobs: [
        { externalTechFee: null, clientBill: 40_000 },
        { externalTechFee: null, clientBill: 0 },
      ],
    });

    expect(c.billedAnyway.count).toBe(1);
    expect(c.billedAnyway.amount).toBe(40_000);
    // The billed amount must not offset or inflate the cost of honouring.
    expect(c.totalCost).toBe(10_000);
  });

  it("returns zeroes, and never divides by zero, with nothing honoured", () => {
    const c = computeWarrantyCost({
      claimsHonoured: 0,
      reservations: [],
      payoutTotal: 0,
      jobs: [],
    });
    expect(c.totalCost).toBe(0);
    expect(c.averagePerClaim).toBe(0);
    expect(Number.isFinite(c.averagePerClaim)).toBe(true);
  });

  it("rounds to whole cents rather than trailing float noise", () => {
    const c = computeWarrantyCost({
      claimsHonoured: 3,
      reservations: [{ quantity: 1, unitCostSnapshot: 10_000 }],
      payoutTotal: 0,
      jobs: [{ externalTechFee: null, clientBill: null }],
    });
    // 10,000 / 3 = 3333.333…
    expect(c.averagePerClaim).toBe(3333.33);
  });
});
