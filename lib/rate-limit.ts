/**
 * rate-limit.ts
 *
 * Fixed-window rate limiter. In production (Turso/libSQL) it uses a shared
 * `RateLimit` table via an atomic upsert, so counts aggregate across all
 * serverless instances — a per-instance in-memory Map is useless on Vercel.
 * Locally (no Turso) it falls back to an in-memory Map. On any DB error it also
 * falls back to memory so a hiccup never breaks a request path.
 *
 * `checkRateLimit` is async; every call site must `await` it.
 */

import { createClient, type Client } from "@libsql/client/web";

type Entry = { count: number; resetAt: number };
type Result = { allowed: boolean; retryAfterMs: number };

const store = new Map<string, Entry>();
let tableReady = false;
let db: Client | null = null;
// Edge-safe (fetch-based) libsql client — works in both the middleware (edge)
// and node route handlers, unlike the Prisma libsql adapter.
function getDb(): Client | null {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return null;
  if (!db) db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return db;
}

function checkMemory(key: string, opts: { limit: number; windowMs: number }): Result {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (entry.count >= opts.limit) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }
  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

export async function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): Promise<Result> {
  const client = getDb();
  if (!client) return checkMemory(key, opts);
  try {
    if (!tableReady) {
      await client.execute(
        `CREATE TABLE IF NOT EXISTS "RateLimit" ("key" TEXT NOT NULL PRIMARY KEY, "count" INTEGER NOT NULL, "resetAt" INTEGER NOT NULL)`,
      );
      tableReady = true;
    }
    const now = Date.now();
    const resetNew = now + opts.windowMs;
    // Atomic upsert: reset the window if expired, else increment; return the new state.
    const rs = await client.execute({
      sql: `INSERT INTO "RateLimit" ("key","count","resetAt") VALUES (?, 1, ?)
        ON CONFLICT("key") DO UPDATE SET
          "count"   = CASE WHEN "RateLimit"."resetAt" <= ? THEN 1 ELSE "RateLimit"."count" + 1 END,
          "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ? THEN ? ELSE "RateLimit"."resetAt" END
        RETURNING "count" AS count, "resetAt" AS resetAt`,
      args: [key, resetNew, now, now, resetNew],
    });
    const row = rs.rows[0] as { count?: number | bigint; resetAt?: number | bigint } | undefined;
    const count = Number(row?.count ?? 1);
    const resetAt = Number(row?.resetAt ?? resetNew);
    if (count > opts.limit) return { allowed: false, retryAfterMs: Math.max(0, resetAt - now) };
    return { allowed: true, retryAfterMs: 0 };
  } catch {
    // Fail open to the in-memory limiter rather than breaking the request.
    return checkMemory(key, opts);
  }
}

export function rateLimitHeaders(retryAfterMs: number) {
  return {
    "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
    "X-RateLimit-Reset": String(Date.now() + retryAfterMs),
  };
}

// ── Named limit profiles ──────────────────────────────────────────────────────

/**
 * Profiles — pick the one that matches the sensitivity of the endpoint.
 *
 * Usage:
 *   const result = rateLimit.auth(ip);
 *   if (!result.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 */
export const rateLimit = {
  /** Login / register — 10 attempts per 15 minutes per IP. */
  auth: (ip: string) =>
    checkRateLimit(`auth:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 }),

  /** Public intake / repair-request form — 5 submissions per hour per IP. */
  publicForm: (ip: string) =>
    checkRateLimit(`form:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 }),

  /** Invite generation — 20 invites per hour per org. */
  invite: (orgId: string) =>
    checkRateLimit(`invite:${orgId}`, { limit: 20, windowMs: 60 * 60 * 1000 }),

  /** Job creation — 60 jobs per hour per org (well above any real usage). */
  jobCreate: (orgId: string) =>
    checkRateLimit(`job:${orgId}`, { limit: 60, windowMs: 60 * 60 * 1000 }),

  /**
   * Destructive platform-admin operations — 10 per 10 minutes per admin.
   *
   * The guard in front of these already restricts them to a platform admin, so
   * this is not about keeping strangers out. It bounds what a hijacked admin
   * session can do in a burst, and it stops a repeated click re-running a
   * schema repair or a demo seed while the first is still working. Generous
   * enough that no honest use will meet it.
   */
  platformAdmin: (userId: string) =>
    checkRateLimit(`platform-admin:${userId}`, { limit: 10, windowMs: 10 * 60 * 1000 }),

  /** File uploads — 30 uploads per 10 minutes per user. */
  upload: (userId: string) =>
    checkRateLimit(`upload:${userId}`, { limit: 30, windowMs: 10 * 60 * 1000 }),

  /** Webhook endpoints — 200 per minute per IP (Pesapal IPN callbacks). */
  webhook: (ip: string) =>
    checkRateLimit(`webhook:${ip}`, { limit: 200, windowMs: 60 * 1000 }),

  /** General API — 100 requests per minute per IP. */
  api: (ip: string) =>
    checkRateLimit(`api:${ip}`, { limit: 100, windowMs: 60 * 1000 }),
} as const;

// ── IP extraction helper ──────────────────────────────────────────────────────

/**
 * Extract the real client IP from a Next.js request or Request object.
 * Falls back to a safe sentinel value so rate limiting still works.
 */
export function getClientIp(
  req: { headers: { get(name: string): string | null } },
): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// ── Test bypass ───────────────────────────────────────────────────────────────

/**
 * Whether auth rate limiting is suspended for an automated test run.
 *
 * The e2e suite signs in dozens of times in a few minutes and was tripping the
 * 10-per-minute auth limiter partway through, so later specs failed with
 * "Login failed" for reasons that had nothing to do with the code under test.
 * The flag existed but only the route handler honoured it — proxy.ts throttles
 * the same paths and runs first, so the bypass never took effect anywhere.
 * Defined here so both consult one rule.
 *
 * The Turso condition is the real guard. Setting the flag by accident in a
 * production environment would otherwise remove the primary defence against
 * credential stuffing; a Turso-backed deployment can never be bypassed, whatever
 * the flag says. NODE_ENV cannot be used for this — `next start` sets it to
 * production for the test server too.
 */
export function authRateLimitBypassed(): boolean {
  return process.env.E2E_DISABLE_RATE_LIMIT === "1" && !process.env.TURSO_DATABASE_URL;
}
