import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockQueryRaw = mock(async (): Promise<any[]> => []);
const mockCheckRateLimit = mock(() => ({ allowed: true, retryAfterMs: 0 }));
const mockAuthHandler = mock(async () => new Response('{"token":"abc"}', { status: 200, headers: { "content-type": "application/json" } }));

mock.module("@/lib/prisma", () => ({
  prisma: { $queryRaw: mockQueryRaw },
}));

mock.module("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  rateLimitHeaders: mock(() => ({})),
}));

mock.module("@/lib/auth", () => ({
  auth: {
    handler: mockAuthHandler,
    api: { getSession: mock(async () => null) },
  },
}));

const { POST } = await import("../../../app/api/login/route");

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTIVE_USER = { email: "alice@example.com", isActive: 1 };

function makePost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeBetterAuthResponse(status: number, body = "{}", cookie?: string): Response {
  const headers: HeadersInit = { "content-type": "application/json" };
  return new Response(body, { status, headers: cookie ? { ...headers, "set-cookie": cookie } : headers });
}

// ── Input validation ──────────────────────────────────────────────────────────

describe("POST /api/login — input validation", () => {
  beforeEach(() => {
    mockCheckRateLimit.mockImplementation(() => ({ allowed: true, retryAfterMs: 0 }));
    mockQueryRaw.mockImplementation(async (): Promise<[]> => []);
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makePost({ password: "secret" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const res = await POST(makePost({ email: "user@example.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when no user matches the email", async () => {
    mockQueryRaw.mockImplementation(async (): Promise<[]> => []);
    const res = await POST(makePost({ email: "ghost@example.com", password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user account is deactivated (isActive = 0)", async () => {
    mockQueryRaw.mockImplementation(async () => [
      { email: "disabled@example.com", isActive: 0 },
    ]);
    const res = await POST(makePost({ email: "disabled@example.com", password: "pass" }));
    expect(res.status).toBe(403);
  });
});

// ── Success path (active user → BetterAuth handler) ─────────────────────────

describe("POST /api/login — success path", () => {
  beforeEach(() => {
    mockCheckRateLimit.mockImplementation(() => ({ allowed: true, retryAfterMs: 0 }));
    mockAuthHandler.mockReset();
    mockQueryRaw.mockReset();
  });

  it("proxies the BetterAuth 200 response to the caller", async () => {
    mockQueryRaw
      .mockImplementationOnce(async () => [ACTIVE_USER])
      .mockImplementationOnce(async (): Promise<[]> => []);
    mockAuthHandler.mockImplementation(async () => makeBetterAuthResponse(200, '{"token":"abc"}'));
    const res = await POST(makePost({ email: "alice@example.com", password: "Pass1!" }));
    expect(res.status).toBe(200);
  });

  it("sets x-login-redirect header on success", async () => {
    mockQueryRaw
      .mockImplementationOnce(async () => [ACTIVE_USER])
      .mockImplementationOnce(async (): Promise<[]> => []);
    mockAuthHandler.mockImplementation(async () => makeBetterAuthResponse(200, '{"token":"abc"}'));
    const res = await POST(makePost({ email: "alice@example.com", password: "Pass1!" }));
    expect(res.headers.get("x-login-redirect")).toBe("/dashboard");
  });

  it("forwards set-cookie from BetterAuth response", async () => {
    mockQueryRaw
      .mockImplementationOnce(async () => [ACTIVE_USER])
      .mockImplementationOnce(async (): Promise<[]> => []);
    mockAuthHandler.mockImplementation(async () =>
      makeBetterAuthResponse(200, '{"token":"abc"}', "session=xyz; Path=/; HttpOnly"),
    );
    const res = await POST(makePost({ email: "alice@example.com", password: "Pass1!" }));
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("session=xyz");
  });

  it("redirects platform admin to /platform (DB permission row)", async () => {
    mockQueryRaw
      .mockImplementationOnce(async () => [ACTIVE_USER])
      .mockImplementationOnce(async () => [{ permission: "platform_admin" }]);
    mockAuthHandler.mockImplementation(async () => makeBetterAuthResponse(200, '{"token":"abc"}'));
    const res = await POST(makePost({ email: "alice@example.com", password: "Pass1!" }));
    expect(res.headers.get("x-login-redirect")).toBe("/platform");
  });

  it("redirects platform admin via PLATFORM_ADMIN_EMAIL env var", async () => {
    const prev = process.env.PLATFORM_ADMIN_EMAIL;
    process.env.PLATFORM_ADMIN_EMAIL = "alice@example.com";
    try {
      mockQueryRaw.mockImplementationOnce(async () => [ACTIVE_USER]);
      mockAuthHandler.mockImplementation(async () => makeBetterAuthResponse(200, '{"token":"abc"}'));
      const res = await POST(makePost({ email: "alice@example.com", password: "Pass1!" }));
      expect(res.headers.get("x-login-redirect")).toBe("/platform");
    } finally {
      process.env.PLATFORM_ADMIN_EMAIL = prev;
    }
  });

  it("falls back to /dashboard when platform access DB query throws", async () => {
    mockQueryRaw
      .mockImplementationOnce(async () => [ACTIVE_USER])
      .mockImplementationOnce(async () => { throw new Error("DB locked"); });
    mockAuthHandler.mockImplementation(async () => makeBetterAuthResponse(200, '{"token":"abc"}'));
    const res = await POST(makePost({ email: "alice@example.com", password: "Pass1!" }));
    expect(res.headers.get("x-login-redirect")).toBe("/dashboard");
    expect(res.status).toBe(200);
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe("POST /api/login — rate limiting", () => {
  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockImplementation(() => ({
      allowed: false,
      retryAfterMs: 30_000,
    }));
    const res = await POST(makePost({ email: "a@b.com", password: "pw" }));
    expect(res.status).toBe(429);
  });
});
