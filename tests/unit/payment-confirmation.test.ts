import { describe, it, expect, mock, beforeEach } from "bun:test";

/**
 * The confirmation a customer gets when their payment is recorded.
 *
 * Two properties have to hold together, and they pull against each other:
 * telling the customer must never be able to fail the recording of their
 * money, and a confirmation that does not go out must not vanish without
 * trace. The first is why the catches exist; the second is why they log.
 */

const logs: string[] = [];
const errSpy = mock((...a: unknown[]) => { logs.push(`ERROR ${a.map(String).join(" ")}`); });
const warnSpy = mock((...a: unknown[]) => { logs.push(`WARN ${a.map(String).join(" ")}`); });

let clientResult: () => Promise<unknown>;
let enqueueResult: () => Promise<unknown>;
let deliverResult: () => Promise<unknown>;

mock.module("@/lib/prisma", () => ({
  prisma: {
    client: { findFirst: () => clientResult() },
    notificationPreferences: { findMany: async () => [] },
    user: { findMany: async () => [] },
    notification: { createMany: async () => ({ count: 0 }) },
    organization: { findUnique: async () => ({ baseCurrency: "UGX" }) },
  },
}));
mock.module("@/lib/notifications/whatsapp-outbox", () => ({
  enqueueWhatsAppMessage: () => enqueueResult(),
  deliverOutboundMessage: () => deliverResult(),
  enqueueEmailMessage: async () => ({ queued: false }),
}));

beforeEach(() => {
  logs.length = 0;
  console.error = errSpy as never;
  console.warn = warnSpy as never;
  clientResult = async () => ({ phone: "+256772000000", fullName: "Amina Yusuf" });
  enqueueResult = async () => ({ queued: true, outboxId: "ob_1" });
  deliverResult = async () => ({ ok: true });
});

async function load() {
  return (await import(
    `../../lib/notifications/index?v=${Math.random().toString(36).slice(2)}`
  )) as typeof import("../../lib/notifications/index");
}

const ARGS = {
  orgId: "org_1", jobId: "job_1", jobNumber: "EIS/2026/0001",
  amount: 250_000, currency: "UGX", actorName: "Ivan",
};

describe("a confirmation that cannot be sent still leaves a trace", () => {
  it("logs when the client lookup fails, instead of reading as 'no phone'", async () => {
    // A database blip used to be indistinguishable from a customer with no
    // number on file, and both simply dropped the message.
    clientResult = async () => { throw new Error("connection reset"); };
    const { notifyPaymentReceived } = await load();
    await notifyPaymentReceived(ARGS);
    expect(logs.some((l) => l.includes("could not read the client"))).toBe(true);
  });

  it("logs loudly when nothing was queued, because there is no outbox row to find", async () => {
    // The outbox makes a failed message visible — but only once a row exists.
    // A throw during enqueue leaves nothing at all to inspect.
    enqueueResult = async () => { throw new Error("outbox unavailable"); };
    const { notifyPaymentReceived } = await load();
    await notifyPaymentReceived(ARGS);
    expect(logs.some((l) => l.startsWith("ERROR") && l.includes("no outbox row exists"))).toBe(true);
  });

  it("logs a delivery failure only as a warning, since the row records the reason", async () => {
    deliverResult = async () => { throw new Error("provider 500"); };
    const { notifyPaymentReceived } = await load();
    await notifyPaymentReceived(ARGS);
    expect(logs.some((l) => l.startsWith("WARN") && l.includes("outbox row carries the reason"))).toBe(true);
  });
});

describe("the confirmation never breaks the payment", () => {
  it("returns normally when every step fails", async () => {
    // The whole reason the catches exist. A customer's payment must be recorded
    // even if telling them about it is impossible.
    clientResult = async () => { throw new Error("db down"); };
    enqueueResult = async () => { throw new Error("outbox down"); };
    deliverResult = async () => { throw new Error("provider down"); };
    const { notifyPaymentReceived } = await load();
    await expect(notifyPaymentReceived(ARGS)).resolves.toBeUndefined();
  });
});

describe("silence that is correct stays silent", () => {
  it("says nothing when the customer simply has no phone on file", async () => {
    // Not an error, and must not be logged as one — otherwise the log fills
    // with noise and the real failures stop standing out.
    clientResult = async () => ({ phone: null, fullName: "Walk-in" });
    const { notifyPaymentReceived } = await load();
    await notifyPaymentReceived(ARGS);
    expect(logs.filter((l) => l.includes("payment-confirmation"))).toHaveLength(0);
  });

  it("says nothing on the happy path", async () => {
    const { notifyPaymentReceived } = await load();
    await notifyPaymentReceived(ARGS);
    expect(logs.filter((l) => l.includes("payment-confirmation"))).toHaveLength(0);
  });

  it("sends no confirmation at all when there is no job, which is how refunds are recorded", async () => {
    // Callers omit jobId for refunds precisely so a refund never tells someone
    // their payment was received.
    let called = false;
    clientResult = async () => { called = true; return { phone: "+256772000000", fullName: "A" }; };
    const { notifyPaymentReceived } = await load();
    await notifyPaymentReceived({ ...ARGS, jobId: undefined });
    expect(called).toBe(false);
  });
});
