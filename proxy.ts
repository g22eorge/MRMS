// NOTE: Next.js 16 uses "proxy.ts" as the middleware entrypoint.
// Do not add a separate middleware.ts, or builds will fail.

import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

const PUBLIC_PATHS = [
  // Auth
  "/login",
  "/register",
  "/invite",

  // API
  "/api/auth",
  "/api/login",
  "/api/webhooks",
  "/api/repair-requests",
  "/api/billing/callback", // Pesapal payment redirect (arrives without session)
  "/api/cron",             // Scheduled jobs — authorised by CRON_SECRET, not a session
  "/api/health",           // Container healthcheck. Reports only {ok, db, uptime};
                           // it must be reachable without a session or Docker
                           // cannot tell a wedged container from a healthy one.
  "/api/portal",           // Client-portal APIs — self-guarded by the portal session
  "/api/photos",           // Private repair photos — self-guarded (staff OR portal session)

  // Public forms & pages
  "/repair-request",
  "/repair",
  "/address",
  "/app",
  "/company",
  "/profile",
  "/terms",
  "/privacy",
  "/status",
  "/onboarding",           // New-user org setup flow
  "/feedback",             // Public feedback widget
  "/portal",               // Client portal — has its own auth (requirePortalSession)

  // Public metadata assets
  "/opengraph-image",
  "/twitter-image",
  "/apple-icon",
  "/icon.svg",
  "/eagle-info-logo.png",
  "/logo-dark.png",
  "/logo-light.png",
  "/app-logo.png",
];

/** Extract the best available client IP from request headers. */
function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = clientIp(req);

  if (pathname === "/api/admin/db-fix/route.ts") {
    return NextResponse.redirect(new URL("/api/admin/db-fix", req.url));
  }

  // ── Rate limiting ───────────────────────────────────────────────────────────

  // Webhook endpoints: allow bursts but cap runaway callers (200 / min per IP).
  if (pathname.startsWith("/api/webhooks")) {
    const { allowed, retryAfterMs } = await checkRateLimit(`webhook:${ip}`, {
      limit: 200,
      windowMs: 60 * 1000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded." },
        { status: 429, headers: rateLimitHeaders(retryAfterMs) },
      );
    }
  }

  // Public intake form: 5 submissions per hour per IP.
  if (pathname.startsWith("/repair-request")) {
    const { allowed, retryAfterMs } = await checkRateLimit(`form:${ip}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429, headers: rateLimitHeaders(retryAfterMs) },
      );
    }
  }

  // Auth endpoints (BetterAuth sign-in / sign-up) — throttle hard by IP to stop
  // credential stuffing and password brute-force. BetterAuth's built-in limiter
  // is in-memory/per-instance and useless on serverless, so gate it here on the
  // shared Turso-backed limiter (matches the /api/login wrapper).
  if (pathname.startsWith("/api/auth/sign-in") || pathname.startsWith("/api/auth/sign-up")) {
    const { allowed, retryAfterMs } = await checkRateLimit(`auth:${ip}`, {
      limit: 10,
      windowMs: 60 * 1000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again in a minute." },
        { status: 429, headers: rateLimitHeaders(retryAfterMs) },
      );
    }
  }

  // General API: 100 req / min per IP (catches scrapers and runaway clients).
  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth") &&
    !pathname.startsWith("/api/webhooks")
  ) {
    const { allowed, retryAfterMs } = await checkRateLimit(`api:${ip}`, {
      limit: 100,
      windowMs: 60 * 1000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429, headers: rateLimitHeaders(retryAfterMs) },
      );
    }
  }

  // ── Auth gate ───────────────────────────────────────────────────────────────

  if (pathname === "/") {
    return NextResponse.next();
  }

  const session = getSessionCookie(req);

  // Root landing page and all explicitly public paths are always accessible.
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackURL", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated users without an org land on /onboarding.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|uploads).*)"],
};
