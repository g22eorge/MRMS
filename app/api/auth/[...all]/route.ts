import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { getDeploymentContext } from "@/lib/deployment-context";
import { checkIsPlatformAdmin } from "@/lib/platform-admin";
import { checkRateLimit, rateLimitHeaders, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const preferredRegion = "sfo1";

const { GET: _GET, POST: _POST } = toNextJsHandler(auth);

export { _GET as GET };

/**
 * POST handler — wraps the BetterAuth handler with rate limiting for
 * authentication endpoints that are susceptible to brute-force attacks.
 *
 * The custom /api/login route already has rate limiting, but callers that
 * bypass it and POST directly to /api/auth/sign-in/email (e.g. the authClient
 * SDK) had no protection.  This closes that gap.
 *
 * Limits applied:
 *   • /sign-in/email          — 10 attempts per minute per IP
 *   • /sign-up/email          — 5 attempts per 10 minutes per IP
 *   • /reset-password / /send-verification-email  — 5 per 10 minutes per IP
 *
 * All other paths (OAuth callbacks, session refresh, sign-out) pass through
 * without rate limiting.
 */
export async function POST(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const ip = getClientIp(request);

  // Registration is a commercial-only feature. /register already redirects on
  // care, but the endpoint behind it answered on every deployment, so the page
  // was the only thing closed: anyone could create an account row in care's
  // database, and tell a real staff address from an invented one by the
  // difference between "user already exists" and success. Gate the endpoint,
  // not just the page.
  if (path.endsWith("/sign-up/email")) {
    const { mode } = await getDeploymentContext();
    if (mode === "CARE_SINGLE_TENANT") {
      return NextResponse.json(
        { message: "Registration is closed on this deployment.", code: "SIGNUP_DISABLED" },
        { status: 403 },
      );
    }
  }

  // Platform admin is always exempt (matched later during credential check,
  // but we check the same env var for a quick bypass without a DB query).
  let isExempt = process.env.E2E_DISABLE_RATE_LIMIT === "1";
  if (!isExempt && path.endsWith("/sign-in/email")) {
    try {
      const body = await request.clone().json();
      isExempt = typeof body.email === "string" && checkIsPlatformAdmin(body.email);
    } catch {
      // ignore parse errors
    }
  }

  if (!isExempt) {
    let rl: { allowed: boolean; retryAfterMs: number } | null = null;

    if (path.endsWith("/sign-in/email")) {
      rl = await checkRateLimit(`ba-signin:${ip}`, { limit: 10, windowMs: 60_000 });
    } else if (path.endsWith("/sign-up/email")) {
      rl = await checkRateLimit(`ba-signup:${ip}`, { limit: 5, windowMs: 10 * 60_000 });
    } else if (
      path.endsWith("/reset-password") ||
      path.endsWith("/send-verification-email") ||
      path.endsWith("/forget-password")
    ) {
      rl = await checkRateLimit(`ba-passreset:${ip}`, { limit: 5, windowMs: 10 * 60_000 });
    }

    if (rl && !rl.allowed) {
      return NextResponse.json(
        { message: "Too many requests. Please wait before trying again.", code: "RATE_LIMITED" },
        { status: 429, headers: rateLimitHeaders(rl.retryAfterMs) },
      );
    }
  }

  return _POST(request);
}
