import { describe, it, expect } from "bun:test";
import { planLabel, PLAN_LABEL } from "../../lib/plan-labels";

describe("PLAN_LABEL", () => {
  it("has exactly five tiers", () => {
    expect(Object.keys(PLAN_LABEL)).toHaveLength(5);
  });

  it("maps each OrgPlan tier to its branded Duuka name", () => {
    expect(PLAN_LABEL.STARTER).toBe("Duuka");
    expect(PLAN_LABEL.STANDARD).toBe("Duuka Plus");
    expect(PLAN_LABEL.GROWTH).toBe("Duuka Pro");
    expect(PLAN_LABEL.PREMIUM).toBe("Duuka Max");
    expect(PLAN_LABEL.ENTERPRISE).toBe("Duuka ProMax");
  });
});

describe("planLabel()", () => {
  it("returns the Duuka label for every known tier", () => {
    expect(planLabel("STARTER")).toBe("Duuka");
    expect(planLabel("STANDARD")).toBe("Duuka Plus");
    expect(planLabel("GROWTH")).toBe("Duuka Pro");
    expect(planLabel("PREMIUM")).toBe("Duuka Max");
    expect(planLabel("ENTERPRISE")).toBe("Duuka ProMax");
  });

  it("falls back to the raw key for an unknown tier", () => {
    expect(planLabel("UNKNOWN")).toBe("UNKNOWN");
    expect(planLabel("custom_tier")).toBe("custom_tier");
    expect(planLabel("")).toBe("");
  });

  it("is case-sensitive — lowercase keys do not match", () => {
    expect(planLabel("free")).toBe("free");
    expect(planLabel("starter")).toBe("starter");
  });
});
