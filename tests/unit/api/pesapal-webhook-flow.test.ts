import { describe, it, expect, mock, beforeEach } from "bun:test";

/**
 * The payment path, driven end to end.
 *
 * Everything else about this defect has been tested in pieces: the price table
 * in isolation, the rejection reasons by reading the source. None of that
 * demonstrates the thing that matters — that a customer paying today gets what
 * they paid for. On a deployment where no payment has ever completed, "the code
 * is fixed" is a claim about code, not about billing.
 *
 * So this runs the actual webhook handler with Pesapal stubbed at the boundary
 * and asserts what the organisation looks like afterwards. The case that would
 * have failed before is ENTERPRISE: 200,000 charged against a verifier that
 * held 120,000, rejected every time. It has to pass now, and the amount that
 * used to be expected has to fail.
 */

// ── The database, remembered rather than mocked away ─────────────────────────
type OrgRow = {
  id: string; name: string; plan: string; billingStatus: string;
  planRenewsAt: Date | null; flwSubscriptionId: string | null; planCancelledAt: Date | null;
};

let org: OrgRow;
let updates: Array<Record<string, unknown>>;
let billingRows: string[];

mock.module("@/lib/prisma", () => ({
  prisma: {
    organization: {
      findUnique: async () => org,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        org = { ...org, ...(data as Partial<OrgRow>) };
        return org;
      },
    },
    user: { findFirst: async () => ({ email: "admin@customer.test", name: "Customer Admin" }) },
    // recordBillingEvent writes through raw SQL to a lazily created table.
    $executeRaw: async (strings: TemplateStringsArray, ...vals: unknown[]) => {
      billingRows.push(String(vals[2] ?? "") + "|" + String(vals[5] ?? ""));
      return 1;
    },
    $executeRawUnsafe: async () => 1,
    $queryRaw: async () => [],
  },
}));

mock.module("@/lib/platform-settings", () => ({
  getPlatformSetting: async () => null, // no override; fall back to PLAN_PRICES
}));

mock.module("@/lib/email", () => ({
  sendPaymentConfirmation: async () => undefined,
  sendPaymentFailedAlert: async () => undefined,
}));

// Pesapal itself is the boundary. Everything inside it is the real code.
let tx: Record<string, unknown>;
mock.module("@/lib/pesapal", () => ({
  getTransactionStatus: async () => tx,
  CURRENCY: "UGX",
  parseMerchantRef: (ref: string) => {
    const parts = ref.split("-");
    if (parts.length < 3) return null;
    const codes: Record<string, string> = { STD: "STANDARD", GRW: "GROWTH", PRM: "PREMIUM", ENT: "ENTERPRISE" };
    const plan = codes[parts[parts.length - 1]];
    return plan ? { orgId: parts.slice(0, -2).join("-"), plan } : null;
  },
}));

const { GET } = await import("../../../app/api/webhooks/pesapal/route");

/**
 * The handler reads req.nextUrl, which is NextRequest's parsed URL rather than
 * anything a plain Request carries — so the stub supplies exactly that.
 */
function notification(orderTrackingId = "track-1", merchantReference = "org_1-12345-ENT") {
  const nextUrl = new URL("https://app.example.com/api/webhooks/pesapal");
  nextUrl.searchParams.set("OrderTrackingId", orderTrackingId);
  nextUrl.searchParams.set("OrderMerchantReference", merchantReference);
  nextUrl.searchParams.set("OrderNotificationType", "IPNCHANGE");
  return { nextUrl, url: nextUrl.toString() } as never;
}

beforeEach(() => {
  org = {
    id: "org_1", name: "Paying Customer", plan: "STARTER", billingStatus: "TRIALING",
    planRenewsAt: null, flwSubscriptionId: null, planCancelledAt: null,
  };
  updates = [];
  billingRows = [];
  tx = {
    payment_method: "MPESA", amount: 200_000, created_date: "2026-08-30T00:00:00Z",
    confirmation_code: "CONF-1", payment_status_description: "Completed",
    merchant_reference: "org_1-12345-ENT", payment_status_code: "1", currency: "UGX",
    error: { error_type: null, code: null, message: null },
  };
});

describe("a customer pays for ENTERPRISE — the case that always failed", () => {
  it("activates them", async () => {
    // 200,000 is what checkout charges. The verifier used to hold 120,000 for
    // ENTERPRISE and rejected this exact notification every time.
    const res = await GET(notification());
    expect(res.status).toBe(200);
    expect(org.billingStatus).toBe("ACTIVE");
    expect(org.plan).toBe("ENTERPRISE");
  });

  it("stamps the tracking id, which is how anyone can later tell they paid", async () => {
    await GET(notification("track-99"));
    expect(org.flwSubscriptionId).toBe("track-99");
  });

  it("sets a renewal date a month out", async () => {
    await GET(notification());
    expect(org.planRenewsAt).toBeInstanceOf(Date);
    expect((org.planRenewsAt as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it("records the payment rather than only acting on it", async () => {
    await GET(notification());
    expect(billingRows.some((r) => r.startsWith("charge.completed"))).toBe(true);
  });
});

describe("the amount is still checked — the fix is not 'accept everything'", () => {
  it("refuses an ENTERPRISE notification paying the old expected figure", async () => {
    // 120,000 was what the broken verifier expected. Now it is simply wrong.
    tx.amount = 120_000;
    await GET(notification());
    expect(org.billingStatus).toBe("TRIALING");
    expect(updates).toHaveLength(0);
  });

  it("says why, instead of vanishing", async () => {
    tx.amount = 120_000;
    await GET(notification());
    expect(billingRows.some((r) => r.includes("amount-mismatch-paid-120000-expected-200000"))).toBe(true);
  });

  it("refuses a foreign currency at the right number", async () => {
    tx.currency = "KES";
    await GET(notification());
    expect(org.billingStatus).toBe("TRIALING");
    expect(billingRows.some((r) => r.includes("currency-mismatch"))).toBe(true);
  });
});

describe("every plan the billing page sells now completes", () => {
  const cases = [
    ["STD", "STANDARD", 35_000],
    ["GRW", "GROWTH", 75_000],
    ["PRM", "PREMIUM", 120_000],
    ["ENT", "ENTERPRISE", 200_000],
  ] as const;

  for (const [code, plan, price] of cases) {
    it(`${plan} at ${price.toLocaleString()} activates`, async () => {
      // Three of these four were absent from the old verifier entirely, so the
      // lookup returned null and the payment was dropped.
      tx.amount = price;
      tx.merchant_reference = `org_1-12345-${code}`;
      await GET(notification("track-x", `org_1-12345-${code}`));
      expect(org.billingStatus).toBe("ACTIVE");
      expect(org.plan).toBe(plan);
    });
  }
});

describe("a forged reference is refused and written down", () => {
  it("does not activate an organisation somebody did not pay for", async () => {
    // The notification claims one reference; Pesapal reports another.
    tx.merchant_reference = "someone_else-99999-ENT";
    await GET(notification("track-1", "org_1-12345-ENT"));
    expect(org.billingStatus).toBe("TRIALING");
    expect(billingRows.some((r) => r.includes("possible-forgery"))).toBe(true);
  });
});

describe("a payment that did not complete changes nothing", () => {
  for (const status of ["Failed", "Pending", "Invalid"]) {
    it(`${status} leaves the organisation alone`, async () => {
      tx.payment_status_description = status;
      await GET(notification());
      expect(org.billingStatus).toBe("TRIALING");
      expect(org.flwSubscriptionId).toBeNull();
    });
  }
});
