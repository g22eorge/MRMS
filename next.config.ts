import type { NextConfig } from "next";

/**
 * Content-Security-Policy
 *
 * 'unsafe-inline' for styles — required by Recharts (inline style attributes)
 * and Tailwind's dynamic class generation in dev mode.
 *
 * 'unsafe-inline' for scripts — required by Next's bootstrap/runtime scripts in
 * this deployment mode. Keep 'strict-dynamic' out unless per-request nonces are
 * added, otherwise some browsers reject same-origin Next.js chunks.
 *
 * CSP is sent only in production. React/Next/Turbopack dev mode uses eval and
 * runtime style injection for debugging/HMR, so applying CSP locally can leave
 * pages as unstyled HTML.
 *
 * data: for images — PDF previews and chart data-URIs.
 *
 * blob: for images — object-URL previews before file upload.
 *
 * https://vercel.live — Vercel preview comments widget (safe in prod; no-op
 * when not in a preview deployment).
 */
const isProduction = process.env.NODE_ENV === "production";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://vercel.live wss://ws-us3.pusher.com https://*.turso.io https://va.vercel-analytics.com",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Build output dir. Defaults to .next (what `next dev` and Vercel use). The
  // local commit gate (scripts/vercel-build.mjs, off-Vercel) sets NEXT_DIST_DIR
  // to a separate dir so `next build` never cleans the running dev server's
  // .next out from under it. Vercel leaves it unset → .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: { root: process.cwd() },
  async redirects() {
    // Communications is absorbed into Settings → Communications; the real pages
    // live under /settings/notifications/*. The /communications/* routes are
    // page-level redirect stubs into Settings, so no config redirects for them.
    return [
      { source: "/outbox", destination: "/settings/notifications/outbox", permanent: false },
      // Sales targets consolidated into the single /targets editor.
      { source: "/settings/targets", destination: "/targets", permanent: false },
    ];
  },
  async headers() {
    // Common headers for every route. X-Frame-Options is applied separately
    // below so that same-origin document previews (an <iframe> embedding our own
    // /api/**/pdf routes) are allowed, while app pages stay clickjacking-proof.
    const commonHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ...(isProduction ? [{ key: "Content-Security-Policy", value: CSP }] : []),
    ];

    return [
      { source: "/(.*)", headers: commonHeaders },
      // App pages must never be framed (clickjacking protection).
      { source: "/((?!api/).*)", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
      // API routes (PDF/document responses) may be framed by our own pages only.
      { source: "/api/:path*", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
};

export default nextConfig;
