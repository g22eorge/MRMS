import { describe, expect, it } from "vitest";

import { clientContactName, clientDisplayName, clientFullLabel } from "@/lib/client-name";

const corporate = { fullName: "Saaka Noah", organization: "C-Care IHK" };
const individual = { fullName: "Grace Apio", organization: null };

describe("clientDisplayName", () => {
  it("leads with the organisation when the account has one", () => {
    expect(clientDisplayName(corporate)).toBe("C-Care IHK");
  });

  it("falls back to the person when there is no organisation", () => {
    expect(clientDisplayName(individual)).toBe("Grace Apio");
  });

  it("treats a blank organisation as absent", () => {
    expect(clientDisplayName({ fullName: "Grace Apio", organization: "   " })).toBe("Grace Apio");
  });

  it("uses the caller's fallback only when there is no client at all", () => {
    expect(clientDisplayName(null, "Walk-in")).toBe("Walk-in");
    expect(clientDisplayName(undefined, "Walk-in")).toBe("Walk-in");
    expect(clientDisplayName({ fullName: "", organization: "" }, "Walk-in")).toBe("Walk-in");
  });
});

describe("clientContactName", () => {
  it("names the person behind the organisation", () => {
    expect(clientContactName(corporate)).toBe("Saaka Noah");
  });

  it("stays quiet for an individual, so the label is not printed twice", () => {
    expect(clientContactName(individual)).toBeNull();
    expect(clientContactName(null)).toBeNull();
  });

  it("stays quiet when the organisation has no named contact", () => {
    expect(clientContactName({ fullName: "", organization: "C-Care IHK" })).toBeNull();
  });
});

describe("clientFullLabel", () => {
  it("carries the contact in brackets for a corporate account", () => {
    expect(clientFullLabel(corporate)).toBe("C-Care IHK (Saaka Noah)");
  });

  it("is just the name for an individual", () => {
    expect(clientFullLabel(individual)).toBe("Grace Apio");
  });
});
