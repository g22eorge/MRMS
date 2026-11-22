import { describe, expect, it, afterEach } from "bun:test";
import { authRateLimitBypassed } from "@/lib/rate-limit";

/**
 * The e2e auth-limiter bypass must stay impossible to trigger in production.
 *
 * Its previous guard keyed off TURSO_DATABASE_URL, which was sound until the
 * Postgres migration removed Turso entirely — at which point the condition was
 * always true and the flag guarded itself. These cases pin the replacement to
 * the one thing that still distinguishes a test run: the database it points at.
 */
const ENV_KEYS = ["E2E_DISABLE_RATE_LIMIT", "DATABASE_URL"] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function bypassWith(flag: string | undefined, url: string | undefined) {
  if (flag === undefined) delete process.env.E2E_DISABLE_RATE_LIMIT;
  else process.env.E2E_DISABLE_RATE_LIMIT = flag;
  if (url === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = url;
  return authRateLimitBypassed();
}

const SCRATCH = "postgresql://mrms:mrms_dev_password@localhost:5434/mrms_scratch?schema=public";
const PRODUCTION = "postgresql://mrms:secret@db.internal:5432/mrms?schema=public";

describe("authRateLimitBypassed", () => {
  it("bypasses for the e2e scratch database when the flag is set", () => {
    expect(bypassWith("1", SCRATCH)).toBe(true);
  });

  it("never bypasses a production database, whatever the flag says", () => {
    expect(bypassWith("1", PRODUCTION)).toBe(false);
  });

  it("never bypasses without the flag", () => {
    expect(bypassWith(undefined, SCRATCH)).toBe(false);
    expect(bypassWith("0", SCRATCH)).toBe(false);
  });

  it("fails closed when DATABASE_URL is absent or unparseable", () => {
    expect(bypassWith("1", undefined)).toBe(false);
    expect(bypassWith("1", "")).toBe(false);
    expect(bypassWith("1", "not-a-connection-string")).toBe(false);
  });

  it("accepts the _test suffix used by ad-hoc throwaway databases", () => {
    expect(bypassWith("1", "postgresql://u:p@localhost:5432/mrms_test")).toBe(true);
  });
});
