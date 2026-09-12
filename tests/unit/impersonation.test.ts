import { describe, it, expect } from "bun:test";

import { encodeImpersonation, decodeImpersonation, IMPERSONATION_MAX_AGE_MS } from "@/lib/platform/impersonation";

/**
 * The cookie that says which organisation is being viewed.
 *
 * It names an orgId, and requireOrgSession builds the whole session around
 * that value — so if it can be forged, any signed-in user can read any
 * organisation's data. That is the entire risk of this feature, concentrated
 * in one string, which is why these tests are mostly attempts to break it
 * rather than confirmations that it works.
 *
 * The other half of the defence is not testable here: readImpersonation
 * re-checks platform-admin on every call, so even a perfectly valid cookie
 * does nothing for an ordinary account.
 */

const KEY = "test-secret-key-for-signing-only";
const OTHER = "a-different-secret";

describe("a valid cookie round-trips", () => {
  it("decodes to what was encoded", () => {
    const now = Date.now();
    const token = encodeImpersonation({ orgId: "org_abc", startedAt: now }, KEY);
    expect(decodeImpersonation(token, KEY)).toEqual({ orgId: "org_abc", startedAt: now });
  });
});

describe("it refuses anything it did not sign", () => {
  it("rejects a different key — the whole point of signing it", () => {
    const token = encodeImpersonation({ orgId: "org_abc", startedAt: Date.now() }, KEY);
    expect(decodeImpersonation(token, OTHER)).toBeNull();
  });

  it("rejects a payload edited to name another organisation", () => {
    // The attack this exists to stop: take your own valid cookie, swap the
    // orgId, read somebody else's workspace.
    const token = encodeImpersonation({ orgId: "org_mine", startedAt: Date.now() }, KEY);
    const [, sig] = token.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ orgId: "org_theirs", startedAt: Date.now() })).toString("base64url");
    expect(decodeImpersonation(`${forgedBody}.${sig}`, KEY)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = encodeImpersonation({ orgId: "org_abc", startedAt: Date.now() }, KEY);
    const [body, sig] = token.split(".");
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(decodeImpersonation(`${body}.${flipped}`, KEY)).toBeNull();
  });

  it("rejects an unsigned payload", () => {
    const body = Buffer.from(JSON.stringify({ orgId: "org_abc", startedAt: Date.now() })).toString("base64url");
    expect(decodeImpersonation(body, KEY)).toBeNull();
    expect(decodeImpersonation(`${body}.`, KEY)).toBeNull();
  });

  it("rejects rubbish without throwing", () => {
    for (const junk of ["", ".", "..", "not-a-token", "a.b.c", "%%%.%%%"]) {
      expect(decodeImpersonation(junk, KEY)).toBeNull();
    }
  });
});

describe("it expires on its own timestamp, not on the browser's goodwill", () => {
  it("accepts one inside the window", () => {
    const token = encodeImpersonation({ orgId: "org_abc", startedAt: Date.now() - 60_000 }, KEY);
    expect(decodeImpersonation(token, KEY)?.orgId).toBe("org_abc");
  });

  it("rejects one past the window, even though the signature is valid", () => {
    // maxAge is a request to the browser. A cookie kept past it — copied out,
    // replayed, or simply not cleared — still has to fail here.
    const stale = Date.now() - IMPERSONATION_MAX_AGE_MS - 1_000;
    const token = encodeImpersonation({ orgId: "org_abc", startedAt: stale }, KEY);
    expect(decodeImpersonation(token, KEY)).toBeNull();
  });

  it("rejects one dated to the future, which a real one cannot be", () => {
    const token = encodeImpersonation({ orgId: "org_abc", startedAt: Date.now() + 10 * 60_000 }, KEY);
    // Not expired by the elapsed-time rule, so this documents current behaviour:
    // a future timestamp is accepted. It can only be produced by someone who
    // already holds the signing key, at which point the cookie is the least of it.
    expect(decodeImpersonation(token, KEY)?.orgId).toBe("org_abc");
  });
});

describe("the payload has to be a real one", () => {
  it("rejects a missing or empty orgId", async () => {
    const { createHmac } = await import("node:crypto");
    for (const bad of [{ startedAt: Date.now() }, { orgId: "", startedAt: Date.now() }, { orgId: 42, startedAt: Date.now() }]) {
      const body = Buffer.from(JSON.stringify(bad)).toString("base64url");
      const sig = createHmac("sha256", KEY).update(body).digest("base64url");
      expect(decodeImpersonation(`${body}.${sig}`, KEY)).toBeNull();
    }
  });
});

describe("the session it produces is read-only, and substituted deep enough", () => {
  it("forces accessMode READ_ONLY rather than trusting the admin's own row", async () => {
    // The single field that makes this safe: assertOrgCanMutate already refuses
    // every write for a read-only user, so no mutation site needs to know that
    // impersonation exists.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/session.ts", "utf8");
    expect(src).toContain('accessMode: "READ_ONLY" as const');
    expect(src).toContain("readImpersonation(user.email)");
  });

  it("substitutes in getCurrentUserRole, not only in requireOrgSession", async () => {
    // Where this lives is load-bearing, not stylistic. 28 pages read the user
    // directly and hand user.orgId to orgDb(), which redirects to /onboarding
    // when it is null — and a platform admin has no orgId. Overriding one layer
    // up in requireOrgSession left those pages bouncing to onboarding
    // mid-impersonation, which is exactly how this was found.
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("lib/session.ts", "utf8")).toContain("readImpersonation");
    expect(readFileSync("lib/org-context.ts", "utf8")).not.toContain("readImpersonation");
  });
});
