import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Every path out of the Pesapal webhook has to leave a row.
 *
 * The handler must answer HTTP 200 whatever happens — Pesapal requires that
 * acknowledgment and retries without it — which means a rejection is
 * indistinguishable from a success at the network level. The only thing that
 * separates them afterwards is whether something was written down.
 *
 * It was not. Five paths returned the acknowledgment and recorded nothing, so
 * a payment that failed verification looked exactly like a payment that never
 * happened. That is why the price-table defect survived for the life of the
 * deployment, and why it could not afterwards be established which customers
 * had been charged for nothing.
 *
 * A source scan, because the alternative is standing up a fake Pesapal. It
 * asserts the property that actually failed: no bare acknowledgment returns.
 */
const RAW = readFileSync("app/api/webhooks/pesapal/route.ts", "utf8");
/** Comments describe the old pattern by name, so they must not be counted as it. */
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*$/gm, "");

describe("no path acknowledges without recording", () => {
  it("returns the bare acknowledgment only where it is the last line", () => {
    // `return NextResponse.json(ack)` is legitimate exactly once: the final
    // return after a success has already been recorded. Anywhere else it is
    // the silent-drop pattern coming back.
    const bare = SRC.match(/return NextResponse\.json\(ack\)/g) ?? [];
    expect(bare.length).toBe(1);
  });

  it("routes every rejection through the recorder", () => {
    // One per: missing identifiers, unparseable reference, forged reference,
    // amount mismatch, unknown organisation, unactioned status, exception.
    const calls = SRC.match(/rejectAndAck\(\{/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(7);
  });

  it("names a distinct reason for each, rather than a single 'rejected'", () => {
    // A log that says only "rejected" is barely better than silence.
    for (const reason of [
      "missing-identifiers",
      "merchant-reference-unparseable",
      "merchant-reference-mismatch-possible-forgery",
      "no-price-configured-for-",
      "amount-mismatch-paid-",
      "organisation-not-found",
      "status-not-actioned-",
      "exception-during-verification",
    ]) {
      expect(SRC).toContain(reason);
    }
  });

  it("keeps bookkeeping from blocking the acknowledgment", () => {
    // If recording throws, the notification must still be acknowledged —
    // otherwise Pesapal retries it forever.
    expect(SRC).toContain("could not record rejection");
  });

  it("still records the successful activation", () => {
    expect(SRC).toContain('event: "charge.completed"');
    expect(SRC).toContain("flwSubscriptionId: orderTrackingId");
  });
});

describe("the reconciliation reads the table payments are written to", () => {
  it("queries BillingEvent, not OrgSubscriptionEvent", () => {
    // It queried the wrong one and reported "no payment events at all" from a
    // table payments never touch — a confident answer to a question it had not
    // asked. BillingEvent is absent from schema.prisma, so this typechecked.
    const route = readFileSync("app/api/admin/billing-reconcile/route.ts", "utf8");
    expect(route).toContain('FROM "BillingEvent"');
    expect(route).not.toContain("prisma.orgSubscriptionEvent");
  });
});
