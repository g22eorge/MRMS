import { describe, expect, it } from "bun:test";

import { pickDeploymentHost, resolveDeploymentContext } from "../../lib/deployment-context";

const CARE = "https://care.eagleinfosolutions.com";
const APP = "https://app.eagleinfosolutions.com";

describe("pickDeploymentHost()", () => {
  it("uses a configured care origin when the request arrived on an alias", () => {
    // care is served on Vercel aliases that do not begin "care.", and on those
    // the request host alone resolved care's database as a commercial one.
    expect(pickDeploymentHost([CARE], "mrms-eight.vercel.app")).toBe("care.eagleinfosolutions.com");
  });

  it("never lets configuration turn a care request into a commercial one", () => {
    // The regression this guards: preferring the configured host outright
    // flipped care.eagleinfosolutions.com itself into commercial mode in
    // production and opened registration there. A care request host wins over
    // any configured value, whatever that value happens to be.
    expect(pickDeploymentHost([APP], "care.eagleinfosolutions.com")).toBe("care.eagleinfosolutions.com");
    expect(pickDeploymentHost(["https://mrms-eight.vercel.app"], "care.eagleinfosolutions.com"))
      .toBe("care.eagleinfosolutions.com");
    expect(resolveDeploymentContext(pickDeploymentHost([APP], "care.eagleinfosolutions.com")).mode)
      .toBe("CARE_SINGLE_TENANT");
  });

  it("does not let a non-care configured host displace a non-care request host", () => {
    expect(pickDeploymentHost([APP], "mrms-apga.vercel.app")).toBe("mrms-apga.vercel.app");
  });

  it("falls back to the request host when nothing is configured", () => {
    expect(pickDeploymentHost([undefined, null], "localhost:3000")).toBe("localhost:3000");
    expect(pickDeploymentHost([""], "localhost:3000")).toBe("localhost:3000");
  });

  it("skips a malformed configured URL and tries the next", () => {
    expect(pickDeploymentHost(["not a url", CARE], "evil.example")).toBe("care.eagleinfosolutions.com");
  });

  it("falls back to the request host when every configured URL is malformed", () => {
    expect(pickDeploymentHost(["not a url"], "localhost:3000")).toBe("localhost:3000");
  });

  it("returns null when there is nothing to go on", () => {
    expect(pickDeploymentHost([], null)).toBeNull();
  });
});

describe("resolveDeploymentContext()", () => {
  it("treats a configured care host as single-tenant however it was reached", () => {
    const host = pickDeploymentHost([CARE], "mrms-eight.vercel.app");
    const ctx = resolveDeploymentContext(host);
    expect(ctx.mode).toBe("CARE_SINGLE_TENANT");
    expect(ctx.fixedOrgId).toBe("org_eis_01");
  });

  it("leaves commercial multi-tenant, which is what its signup flow depends on", () => {
    expect(resolveDeploymentContext(pickDeploymentHost([APP], "anything")).mode)
      .toBe("COMMERCIAL_MULTI_TENANT");
  });

  it("keeps local development on the commercial path", () => {
    expect(resolveDeploymentContext(pickDeploymentHost([], "localhost:3000")).mode)
      .toBe("COMMERCIAL_MULTI_TENANT");
  });

  it("is case-insensitive about the host", () => {
    expect(resolveDeploymentContext("CARE.EAGLEINFOSOLUTIONS.COM").mode).toBe("CARE_SINGLE_TENANT");
  });
});
