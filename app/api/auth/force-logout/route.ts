import { NextResponse, type NextRequest } from "next/server";
import { cookies, headers } from "next/headers";

import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Force-sign-out route.
 *
 * This is the alternative fix for the /login <-> /dashboard redirect loop on
 * care.* domains when a logged-in user has an orgId that doesn't match
 * EIS_ORG_ID. Pointing the org/deployment guards at this route (instead of
 * /login) guarantees the session is actually invalidated before the login
 * page is rendered, so the loop cannot sustain itself.
 *
 * The previous redirect target (/login) saw an active session and bounced the
 * user straight back to /dashboard, where requireOrgSession bounced them back
 * to /login again — infinitely. This route breaks that cycle by clearing the
 * BetterAuth session server-side before redirecting.
 */
export async function POST(req: NextRequest) {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });
  } catch {
    // Even if the auth server refuses, we manually clear cookies below.
  }

  const res = NextResponse.redirect(new URL("/login", req.url));
  const store = await cookies();
  const sessionCookie = store.get("better-auth.session_token");
  if (sessionCookie) {
    res.cookies.set(sessionCookie.name, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  // Some deployments prefix the cookie; clear that too.
  const prefixed = store.get("__Secure-better-auth.session_token");
  if (prefixed) {
    res.cookies.set(prefixed.name, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 0,
    });
  }
  return res;
}

export async function GET(req: NextRequest) {
  return POST(req);
}
