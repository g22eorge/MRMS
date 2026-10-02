import { describe, it, expect, mock } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * The app cannot monitor a Meta subscription because Meta exposes nothing to
 * read — it only fails sends. This is the module that turns that failure trail
 * into the plain "renew your WhatsApp" verdict an admin can read in the system.
 */

type FakeRow = {
  status: string;
  lastErrorCode: string | null;
  lastError: string | null;
  lastAttemptAt: Date | null;
};

let configured = true;
let healthOk = true;
let outboxRows: FakeRow[] = [];

mock.module("@/lib/notifications/whatsapp", () => ({
  whatsappConfigSummaryForOrg: async () =>
    configured
      ? { configured: true, provider: "meta", businessNumber: "+256700000000" }
      : { configured: false, provider: null, businessNumber: null },
  whatsappHealthCheckForOrg: async () =>
    healthOk ? { ok: true } : { ok: false, error: "WhatsApp health failed: 401 Unauthorized" },
}));

mock.module("@/lib/prisma", () => ({
  prisma: {
    outboundMessage: {
      findMany: async () => outboxRows,
    },
  },
}));

const { assessWhatsAppRenewal } = await import("@/lib/notifications/whatsapp-renewal");

describe("it is silent when WhatsApp is healthy", () => {
  it("reports ok with no headline when configured and nothing has failed", async () => {
    configured = true;
    healthOk = true;
    outboxRows = [];
    const r = await assessWhatsAppRenewal("org_1");
    expect(r.status).toBe("ok");
    expect(r.headline).toBeNull();
    expect(r.failures).toBe(0);
  });
});

describe("it says when nothing will send because WhatsApp is not set up", () => {
  it("reports attention and points at the credentials", async () => {
    configured = false;
    const r = await assessWhatsAppRenewal("org_1");
    expect(r.status).toBe("attention");
    expect(r.headline).toContain("not set up");
  });
});

describe("it names the reason when Meta is rejecting sends", () => {
  function failedRow(code: string, error: string): FakeRow {
    return { status: "FAILED", lastErrorCode: `API_ERROR_${code}`, lastError: error, lastAttemptAt: new Date() };
  }

  it("calls out a payment / top-up problem", async () => {
    configured = true;
    healthOk = true;
    outboxRows = [failedRow("131055", "WhatsApp API error: 400 {\"error\":{\"code\":131055,...}}")];
    const r = await assessWhatsAppRenewal("org_1");
    expect(r.status).toBe("broken");
    expect(r.headline).toContain("payment or top-up");
  });

  it("calls out a dead token", async () => {
    outboxRows = [failedRow("190", "WhatsApp API error: 400 {\"error\":{\"code\":190,\"error_subcode\":463}}")];
    const r = await assessWhatsAppRenewal("org_1");
    expect(r.status).toBe("broken");
    expect(r.headline).toContain("token");
  });

  it("calls out verification", async () => {
    outboxRows = [failedRow("131047", "WhatsApp API error: 400 {\"error\":{\"code\":131047}}")];
    const r = await assessWhatsAppRenewal("org_1");
    expect(r.status).toBe("broken");
    expect(r.headline).toContain("verification");
  });

  it("names an unknown Meta code instead of guessing at the cause", async () => {
    outboxRows = [failedRow("131099", "WhatsApp API error: 400 {\"error\":{\"code\":131099}}")];
    const r = await assessWhatsAppRenewal("org_1");
    expect(r.status).toBe("broken");
    expect(r.headline).toContain("131099");
    expect(r.sampleError).toContain("131099");
  });
});

describe("a recipient-level failure is not dressed up as a renewal", () => {
  it("reports attention with a count when the only error is a number not on WhatsApp", async () => {
    configured = true;
    healthOk = true;
    // 133010 = recipient phone number is not a WhatsApp account; retrying will
    // never help and it has nothing to do with the Meta subscription.
    outboxRows = [
      { status: "DEAD", lastErrorCode: "API_ERROR_133010", lastError: "Recipient is not a WhatsApp user", lastAttemptAt: new Date() },
    ];
    const r = await assessWhatsAppRenewal("org_1");
    expect(r.status).toBe("attention");
    expect(r.headline).toContain("1 WhatsApp message failed");
    expect(r.headline).not.toContain("Meta");
  });
});

describe("a failed health check is reported even when nothing has failed yet", () => {
  it("reports broken with the health error", async () => {
    configured = true;
    healthOk = false;
    outboxRows = [];
    const r = await assessWhatsAppRenewal("org_1");
    expect(r.status).toBe("broken");
    expect(r.headline).toContain("connection check failed");
    expect(r.detail).toContain("401");
  });
});

describe("it is shown where someone would otherwise assume it works", () => {
  it("banner sits on the WhatsApp settings page and surfaces the sample error", () => {
    const src = readFileSync("app/(app)/settings/notifications/whatsapp/page.tsx", "utf8");
    expect(src).toContain("assessWhatsAppRenewal");
    expect(src).toContain("renewal.headline");
    expect(src).toContain("Last error:");
  });

  it("job Messages tab shows outbox status and the failure reason on a bubble", () => {
    const src = readFileSync("components/jobs/JobDetailTabs.tsx", "utf8");
    expect(src).toContain("OutboxStatusBadge");
    expect(src).toContain("m.status !== \"SENT\" && m.lastError");
  });
});