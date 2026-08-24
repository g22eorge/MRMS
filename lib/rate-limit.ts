/**
 * Fixed-window rate limiter.
 *
 * Counts live in a shared `RateLimit` table so they aggregate across every app
 * instance — a per-process Map is useless behind more than one container. On any
 * database error it falls back to an in-memory window rather than failing the
 * request.
 *
 * Previously this used a raw `@libsql/client/web` connection, justified as being
 * "edge-safe, unlike the Prisma libsql adapter". There is no edge middleware in
 * this app: every call site is a node route handler or server action, so plain
 * Prisma is fine and the second database driver is gone.
 *
 * `checkRateLimit` is async; every call site must `await` it.
 */

import { prisma } from "@/lib/prisma";

type Entry = { count: number; resetAt: number };
type Result = { allowed: boolean; retryAfterMs: number };

const store = new Map<string, Entry>();

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
  const now = new Date();
  const resetNew = new Date(now.getTime() + opts.windowMs);

  try {
    // One atomic statement: start a new window if the old one has expired,
    // otherwise increment. Expressed as raw SQL because the "reset or
    // increment" branch cannot be written as a Prisma upsert — `update` has no
    // access to the existing row's values.
    const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${resetNew})
      ON CONFLICT ("key") DO UPDATE SET
        "count"   = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${resetNew} ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"
    `;

    const row = rows[0];
    const count = Number(row?.count ?? 1);
    const resetAt = row?.resetAt ? new Date(row.resetAt).getTime() : resetNew.getTime();

    if (count > opts.limit) {
      return { allowed: false, retryAfterMs: Math.max(0, resetAt - now.getTime()) };
    }
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
 *   const result = await rateLimit.auth(ip);
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
