import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

// NOTE: Next.js 16 supports "proxy.ts" as the middleware entrypoint.
// Do not add a separate middleware.ts, or builds will fail.

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/repair-requests",

  // Public metadata assets for link previews and icons.
  "/opengraph-image",
  "/twitter-image",
  "/apple-icon",
  "/icon.svg",
];

export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === "/") {
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = getSessionCookie(req);

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|uploads).*)"],
};
