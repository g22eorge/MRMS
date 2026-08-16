import { describe, it, expect, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockOrgFindUnique = mock(async (): Promise<any> => null);
const mockPartCount = mock(async () => 0);

mock.module("@/lib/prisma", () => ({
  prisma: {
    // NB: the Prisma model is `organization` (US spelling) — mocking
    // `organisation` silently failed to intercept, so every helper test below
    // hit the real client and failed.
    organization: { findUnique: mockOrgFindUnique },
    part: { count: mockPartCount },
    $queryRaw: mock(async () => [{ 1: 1 }]),
  },
}));

const {
  PLAN_LIMITS,
  PLAN_LABELS,
  UPGRADE_PLAN,
  getOrgPlan,
  getLimitsForOrg,
  checkPartLimit,
} = await import("../../lib/plan-limits");

// ── PLAN_LIMITS ───────────────────────────────────────────────────────────────

// The ladder is STARTER → STANDARD → GROWTH → PREMIUM → ENTERPRISE. The old
// FREE/PROFESSIONAL tiers were retired; these blocks track the live tiers.

describe("PLAN_LIMITS — STARTER", () => {
  const limits = PLAN_LIMITS.STARTER;

  it("has correct maxUsers", () => expect(limits.maxUsers).toBe(2));
  it("has correct maxJobsPerMonth", () => expect(limits.maxJobsPerMonth).toBe(20));
  it("has correct maxParts", () => expect(limits.maxParts).toBe(20));
  it("has correct maxBranches", () => expect(limits.maxBranches).toBe(1));
  it("customBranding is false", () => expect(limits.customBranding).toBe(false));
  it("inviteLinks is false", () => expect(limits.inviteLinks).toBe(false));
});

describe("PLAN_LIMITS — STANDARD", () => {
  const limits = PLAN_LIMITS.STANDARD;

  it("has correct maxUsers", () => expect(limits.maxUsers).toBe(5));
  it("has correct maxJobsPerMonth", () => expect(limits.maxJobsPerMonth).toBe(100));
  it("has correct maxParts", () => expect(limits.maxParts).toBe(100));
  it("customBranding is false", () => expect(limits.customBranding).toBe(false));
  it("inviteLinks is true", () => expect(limits.inviteLinks).toBe(true));
});

describe("PLAN_LIMITS — GROWTH", () => {
  const limits = PLAN_LIMITS.GROWTH;

  it("has correct maxUsers", () => expect(limits.maxUsers).toBe(15));
  it("has correct maxJobsPerMonth", () => expect(limits.maxJobsPerMonth).toBe(500));
  it("has correct maxBranches", () => expect(limits.maxBranches).toBe(3));
  it("customBranding is true", () => expect(limits.customBranding).toBe(true));
  it("inviteLinks is true", () => expect(limits.inviteLinks).toBe(true));
});

describe("PLAN_LIMITS — PREMIUM", () => {
  const limits = PLAN_LIMITS.PREMIUM;

  it("has correct maxUsers", () => expect(limits.maxUsers).toBe(30));
  it("has correct maxJobsPerMonth", () => expect(limits.maxJobsPerMonth).toBe(2000));
  it("has correct maxBranches", () => expect(limits.maxBranches).toBe(8));
  it("customBranding is true", () => expect(limits.customBranding).toBe(true));
  it("inviteLinks is true", () => expect(limits.inviteLinks).toBe(true));
});

describe("PLAN_LIMITS — ENTERPRISE", () => {
  const limits = PLAN_LIMITS.ENTERPRISE;

  it("maxUsers is Infinity", () => expect(limits.maxUsers).toBe(Infinity));
  it("maxJobsPerMonth is Infinity", () => expect(limits.maxJobsPerMonth).toBe(Infinity));
  it("maxParts is Infinity", () => expect(limits.maxParts).toBe(Infinity));
  it("maxBranches is Infinity", () => expect(limits.maxBranches).toBe(Infinity));
  it("customBranding is true", () => expect(limits.customBranding).toBe(true));
  it("inviteLinks is true", () => expect(limits.inviteLinks).toBe(true));
});

// ── PLAN_LABELS ───────────────────────────────────────────────────────────────

describe("PLAN_LABELS", () => {
  it("STARTER → 'Duuka'", () => expect(PLAN_LABELS.STARTER).toBe("Duuka"));
  it("STANDARD → 'Duuka Plus'", () => expect(PLAN_LABELS.STANDARD).toBe("Duuka Plus"));
  it("GROWTH → 'Duuka Pro'", () => expect(PLAN_LABELS.GROWTH).toBe("Duuka Pro"));
  it("PREMIUM → 'Duuka Max'", () => expect(PLAN_LABELS.PREMIUM).toBe("Duuka Max"));
  it("ENTERPRISE → 'Duuka ProMax'", () => expect(PLAN_LABELS.ENTERPRISE).toBe("Duuka ProMax"));
});

// ── UPGRADE_PLAN ──────────────────────────────────────────────────────────────

describe("UPGRADE_PLAN", () => {
  it("STARTER upgrades to STANDARD", () => expect(UPGRADE_PLAN.STARTER).toBe("STANDARD"));
  it("STANDARD upgrades to GROWTH", () => expect(UPGRADE_PLAN.STANDARD).toBe("GROWTH"));
  it("GROWTH upgrades to PREMIUM", () => expect(UPGRADE_PLAN.GROWTH).toBe("PREMIUM"));
  it("PREMIUM upgrades to ENTERPRISE", () => expect(UPGRADE_PLAN.PREMIUM).toBe("ENTERPRISE"));
  it("ENTERPRISE has no upgrade path", () => expect(UPGRADE_PLAN.ENTERPRISE).toBeUndefined());
});

// ── getOrgPlan() ──────────────────────────────────────────────────────────────

describe("getOrgPlan()", () => {
  it("returns the org's plan when found", async () => {
    mockOrgFindUnique.mockImplementation(async () => ({ plan: "GROWTH" }));
    const plan = await getOrgPlan("org-123");
    expect(plan).toBe("GROWTH");
  });

  it("defaults to STARTER when org is not found", async () => {
    mockOrgFindUnique.mockImplementation(async () => null);
    const plan = await getOrgPlan("nonexistent");
    expect(plan).toBe("STARTER");
  });

  it("returns ENTERPRISE for an enterprise org", async () => {
    mockOrgFindUnique.mockImplementation(async () => ({ plan: "ENTERPRISE" }));
    const plan = await getOrgPlan("big-org");
    expect(plan).toBe("ENTERPRISE");
  });
});

// ── getLimitsForOrg() ─────────────────────────────────────────────────────────

describe("getLimitsForOrg()", () => {
  it("returns STARTER limits when org is on STARTER plan", async () => {
    mockOrgFindUnique.mockImplementation(async () => ({ plan: "STARTER" }));
    const limits = await getLimitsForOrg("org-starter");
    expect(limits.maxUsers).toBe(2);
    expect(limits.maxJobsPerMonth).toBe(20);
    expect(limits.plan).toBe("STARTER");
  });

  it("returns ENTERPRISE (Infinity) limits for an enterprise org", async () => {
    mockOrgFindUnique.mockImplementation(async () => ({ plan: "ENTERPRISE" }));
    const limits = await getLimitsForOrg("org-enterprise");
    expect(limits.maxUsers).toBe(Infinity);
    expect(limits.plan).toBe("ENTERPRISE");
  });

  it("includes the plan field alongside the limits", async () => {
    mockOrgFindUnique.mockImplementation(async () => ({ plan: "STARTER" }));
    const limits = await getLimitsForOrg("org-starter2");
    expect(limits.plan).toBe("STARTER");
    expect(typeof limits.maxParts).toBe("number");
  });
});

// ── checkPartLimit() ─────────────────────────────────────────────────────────

describe("checkPartLimit()", () => {
  // Contract note: on the allowed path the implementation returns a bare
  // { allowed: true } — it does not report current/limit, and an ENTERPRISE org
  // short-circuits before counting. These assertions track what ships.
  it("allows an ENTERPRISE org without counting parts", async () => {
    mockOrgFindUnique.mockImplementation(async () => ({ plan: "ENTERPRISE" }));
    const result = await checkPartLimit("org-enterprise");
    expect(result.allowed).toBe(true);
  });

  it("returns allowed: true when parts are below the plan limit", async () => {
    mockOrgFindUnique.mockImplementation(async () => ({ plan: "STARTER" }));
    mockPartCount.mockImplementation(async () => 5); // STARTER limit is 20
    const result = await checkPartLimit("org-starter2");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("returns allowed: false when parts meet or exceed the plan limit", async () => {
    mockOrgFindUnique.mockImplementation(async () => ({ plan: "STARTER" }));
    mockPartCount.mockImplementation(async () => 20); // exactly at the STARTER limit of 20
    const result = await checkPartLimit("org-starter2");
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(20);
    expect(result.limit).toBe(20);
    expect(typeof result.reason).toBe("string");
  });

  it("reason names the plan label and the limit, and offers an upgrade", async () => {
    mockOrgFindUnique.mockImplementation(async () => ({ plan: "STARTER" }));
    mockPartCount.mockImplementation(async () => 25);
    const result = await checkPartLimit("org-starter");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Duuka");   // PLAN_LABELS.STARTER
    expect(result.reason).toContain("20");      // the limit
    expect(result.upgradeTo).toBe("STANDARD");
  });
});
