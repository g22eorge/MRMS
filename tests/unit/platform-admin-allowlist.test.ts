import { describe, it, expect } from "bun:test";

/**
 * Who is allowed to be platform admin.
 *
 * PLATFORM_ADMIN_EMAIL was a single address, which made one mailbox both the
 * only way in and a single point of failure. It now accepts a comma-separated
 * list. The behaviour worth pinning is not that a list works — it is that every
 * degenerate spelling of "no list" still means nobody, because this is the
 * check standing in front of every platform capability: resetting a customer's
 * admin password, changing what they pay, cutting off their access.
 *
 * The resolver is not exported, so this tests the same expression against the
 * same inputs. That is a weaker guarantee than calling the real function, and
 * the source assertion at the end is what keeps the two from drifting.
 */
function platformAdminEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const allows = (raw: string | undefined, email: string) => {
  const allowed = platformAdminEmails(raw);
  return allowed.length > 0 && allowed.includes(email.toLowerCase());
};

describe("it fails closed on every spelling of 'not configured'", () => {
  // A wildcard here would hand the platform to any signed-in ADMIN.
  for (const [label, raw] of [
    ["unset", undefined],
    ["empty", ""],
    ["whitespace", "   "],
    ["a lone comma", ","],
    ["commas and spaces", " , ,  , "],
  ] as const) {
    it(`${label} means nobody is admin`, () => {
      expect(platformAdminEmails(raw)).toEqual([]);
      expect(allows(raw, "anyone@example.com")).toBe(false);
    });
  }
});

describe("a single address still behaves exactly as before", () => {
  const one = "owner@eagleinfosolutions.com";

  it("admits that address", () => {
    expect(allows(one, "owner@eagleinfosolutions.com")).toBe(true);
  });

  it("admits it whatever case it is typed in", () => {
    expect(allows(one, "Owner@EagleInfoSolutions.com")).toBe(true);
    expect(allows("OWNER@EAGLEINFOSOLUTIONS.COM", "owner@eagleinfosolutions.com")).toBe(true);
  });

  it("admits nobody else", () => {
    expect(allows(one, "someone@eagleinfosolutions.com")).toBe(false);
    expect(allows(one, "owner@evil.com")).toBe(false);
    expect(allows(one, "")).toBe(false);
  });
});

describe("a list delegates without sharing a mailbox", () => {
  const many = "owner@eagleinfosolutions.com, ops@eagleinfosolutions.com ,dev@eagleinfosolutions.com";

  it("admits every address on it, ignoring the spacing", () => {
    for (const e of ["owner@eagleinfosolutions.com", "ops@eagleinfosolutions.com", "dev@eagleinfosolutions.com"]) {
      expect(allows(many, e)).toBe(true);
    }
  });

  it("still admits nobody else", () => {
    expect(allows(many, "intern@eagleinfosolutions.com")).toBe(false);
  });

  it("does not match on a substring or a lookalike domain", () => {
    // "ops@eagleinfosolutions.com.evil.com" contains an allowed address.
    expect(allows(many, "ops@eagleinfosolutions.com.evil.com")).toBe(false);
    expect(allows(many, "xops@eagleinfosolutions.com")).toBe(false);
  });
});

describe("the resolver in lib matches what is tested here", () => {
  it("splits on comma, trims, lowercases and drops blanks", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/platform-admin.ts", "utf8");
    expect(src).toContain('.split(",")');
    expect(src).toContain(".trim().toLowerCase()");
    expect(src).toContain(".filter(Boolean)");
    // Fails closed, and role is still required on top of the address.
    expect(src).toContain("if (allowed.length === 0) return null;");
    expect(src).toContain('if (user.role !== "ADMIN") return null;');
  });
});
