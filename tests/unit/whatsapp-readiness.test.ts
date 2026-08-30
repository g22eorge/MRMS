import { describe, it, expect, mock } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Saying that WhatsApp will not send, where someone is about to rely on it.
 *
 * The configuration already resolved per org and several places already asked
 * whether it existed. None of them said so at the point of use, so an
 * unconfigured business could switch on reminders, send documents and move jobs
 * through their statuses while nothing reached a client. Every failure was
 * recorded in the outbox, and nobody had reason to open the outbox, because the
 * screens that queued the messages looked fine.
 *
 * That is the same shape as the payment defects found in this system: silent
 * failure, an interface that reads as success, and discovery weeks later from
 * the customer.
 */

let configured = true;
let shouldThrow = false;
mock.module("@/lib/notifications/whatsapp", () => ({
  whatsappConfigSummaryForOrg: async () => {
    if (shouldThrow) throw new Error("db down");
    if (configured) return { configured: true, provider: "meta", businessNumber: "+256700000000" };
    return { configured: false, provider: null, businessNumber: null };
  },
}));

const { getWhatsAppReadiness } = await import("@/lib/notifications/whatsapp-readiness");

describe("it is silent when there is nothing to say", () => {
  it("returns ready with no message once configured", async () => {
    configured = true;
    const r = await getWhatsAppReadiness("org_1");
    expect(r.ready).toBe(true);
    expect(r.headline).toBeNull();
    expect(r.settingsHref).toBeNull();
  });
});

describe("it speaks up when a send would not arrive", () => {
  it("says so, and says where to fix it", async () => {
    configured = false;
    const r = await getWhatsAppReadiness("org_1");
    expect(r.ready).toBe(false);
    expect(r.headline).toContain("not set up");
    expect(r.settingsHref).toBe("/settings/notifications/whatsapp");
  });

  it("sets the expectation that took days, rather than implying a quick fix", async () => {
    configured = false;
    const r = await getWhatsAppReadiness("org_1");
    expect(r.detail).toContain("Meta");
    expect(r.detail).toContain("approve");
  });

  it("says email already works, so this never reads as 'notifications are broken'", async () => {
    // WhatsApp is one channel. A business told that messaging is broken stops
    // chasing its clients by other means, which is worse than the outage.
    configured = false;
    const r = await getWhatsAppReadiness("org_1");
    expect(r.detail).toContain("Email works now");
  });
});

describe("a failed lookup is not evidence of configuration", () => {
  it("reports not-ready when the config cannot be resolved", async () => {
    // configured stays true, so a throw that was NOT caught here — or a mock
    // that failed to apply — would come back ready and fail this. An earlier
    // version of this test re-imported with a cache-busting query and passed
    // whether or not the mock took effect, which proved nothing.
    configured = true;
    shouldThrow = true;
    const r = await getWhatsAppReadiness("org_1");
    shouldThrow = false;
    // Erring toward the warning: a false alarm costs a glance, the opposite
    // costs a customer who was never contacted.
    expect(r.ready).toBe(false);
    expect(r.headline).toContain("not set up");
  });
});

describe("it is shown where someone would otherwise assume it works", () => {
  it("sits on the page where reminders are switched on", () => {
    const src = readFileSync("app/(app)/settings/notifications/page.tsx", "utf8");
    expect(src).toContain("WhatsAppReadinessNotice");
  });

  it("sits on the invoices page, where reminders and documents are sent", () => {
    const src = readFileSync("app/(app)/documents/invoices/page.tsx", "utf8");
    expect(src).toContain("WhatsAppReadinessNotice");
  });

  it("sits in the job Messages tab, where messaging is judged to be working", () => {
    // An empty thread and a thread of silently-failed sends look identical.
    const src = readFileSync("components/jobs/JobDetailTabs.tsx", "utf8");
    expect(src).toContain("whatsappReady");
    expect(src).toContain("will not reach the client");
  });

  it("defaults to ready, so an un-updated caller shows no false alarm", () => {
    // A wrong warning on a working system trains people to ignore the right one.
    const src = readFileSync("components/jobs/JobDetailTabs.tsx", "utf8");
    expect(src).toContain("whatsappReady = true");
  });

  it("renders nothing at all once configured", () => {
    const src = readFileSync("components/notifications/WhatsAppReadinessNotice.tsx", "utf8");
    expect(src).toContain("if (readiness.ready) return null;");
  });
});
