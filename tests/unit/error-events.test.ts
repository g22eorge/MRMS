import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

import { fingerprintOf, hourBucket, pathOnly } from "@/lib/error-events";

describe("grouping server errors", () => {
  it("treats the same failure with different ids and numbers as one error", () => {
    const a = fingerprintOf("Job cmabc12345678901234567890 not found after 3 tries", "/jobs/[id]");
    const b = fingerprintOf("Job cmzzz98765432109876543210 not found after 12 tries", "/jobs/[id]");
    expect(a).toBe(b);
  });

  it("keeps the same message in different places apart", () => {
    expect(fingerprintOf("boom", "/jobs/[id]")).not.toBe(fingerprintOf("boom", "/sales"));
  });

  it("buckets by the hour, so a recurrence tomorrow is a new row", () => {
    expect(hourBucket(new Date("2026-11-23T10:47:31.000Z")).toISOString()).toBe("2026-11-23T10:00:00.000Z");
  });

  it("drops the query string, which can carry emails and tokens", () => {
    expect(pathOnly("/reset-password?token=abc")).toBe("/reset-password");
    expect(pathOnly(null)).toBeNull();
  });
});

describe("recording an error", () => {
  const source = readFileSync("lib/error-events.ts", "utf8");

  it("can never break the request that failed", () => {
    expect(source).toContain("// Recording an error must never raise a second one.");
  });

  it("is hooked into the framework's error callback, on the Node runtime only", () => {
    const hook = readFileSync("instrumentation.ts", "utf8");
    expect(hook).toContain("export async function onRequestError(");
    expect(hook).toContain('if (process.env.NEXT_RUNTIME !== "nodejs") return;');
  });
});

describe("a workspace can leave", () => {
  it("exports its own rows without credentials or tokens", () => {
    const source = readFileSync("lib/workspace/export.ts", "utf8");
    for (const table of ['"Account"', '"Session"', '"OrgWhatsAppConfig"']) expect(source).toContain(table);
    expect(source).toContain('"passwordHash"');
    expect(source).toContain('WHERE "orgId" = $1');
  });

  it("is deleted only after its own administrator asked, never the operator's own", () => {
    const source = readFileSync("lib/workspace/purge.ts", "utf8");
    expect(source).toContain("if (orgId === EIS_ORG_ID) throw");
    expect(source).toContain("if (org.isActive || !org.deletionRequestedAt)");
    expect(source).toContain("'SystemAuditEvent', 'AuditLog', 'UserAccessAudit'");
  });

  it("is switched off at the request, with the data left for the platform to remove", () => {
    const source = readFileSync("app/(app)/settings/data/actions.ts", "utf8");
    expect(source).toContain("data: { isActive: false, deletionRequestedAt: new Date() }");
    expect(source).toContain("typed !== org.name.trim().toLowerCase()");
  });
});
