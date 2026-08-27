import { describe, expect, it } from "bun:test";

import { normalizePhoneForStorage } from "../../lib/phone";

/**
 * The write paths that create a client from a repair (jobs/new and the intake
 * conversion) look a customer up by BOTH the canonical number and the literal
 * one they were given. These cover the canonicalisation half of that rule —
 * the pairs below are real splits found in care's production data.
 */
describe("phone canonicalisation collapses the forms that split clients", () => {
  const cases: Array<[string, string]> = [
    ["+256742904153", "+256 742 904153"],   // a space
    ["+256772006344", "0772006344"],        // country code vs leading zero
    ["+256779383078", "0779383078"],
    ["+256701100001", "701100001"],         // bare 9-digit
    ["+256701100001", "+256-701-100-001"],  // punctuation
  ];

  for (const [a, b] of cases) {
    it(`treats ${a} and ${b} as the same number`, () => {
      expect(normalizePhoneForStorage(a)).toBe(normalizePhoneForStorage(b));
    });
  }

  it("produces a stable canonical form, so re-storing does not drift", () => {
    const once = normalizePhoneForStorage("0772006344");
    expect(normalizePhoneForStorage(once)).toBe(once);
    expect(once).toBe("+256772006344");
  });

  it("canonicalises a Kampala landline too, not just mobiles", () => {
    expect(normalizePhoneForStorage("0414 259 000")).toBe("+256414259000");
  });

  it("leaves a value with no digits in it alone", () => {
    expect(normalizePhoneForStorage("  n/a  ")).toBe("n/a");
  });

  it("keeps any digits it is given rather than discarding the value", () => {
    // Documented, not endorsed: text around digits is stripped, so "ext 4402"
    // canonicalises to "+4402". Nothing writes such values today — the client
    // form requires a phone — but if that ever changes, this is the behaviour
    // the matching in jobs/new and the intake conversion will see.
    expect(normalizePhoneForStorage("ext 4402")).toBe("+4402");
  });

  it("does not collapse two genuinely different numbers", () => {
    expect(normalizePhoneForStorage("0772006344")).not.toBe(normalizePhoneForStorage("0772006345"));
  });
});
