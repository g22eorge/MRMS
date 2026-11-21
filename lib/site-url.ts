import { headers } from "next/headers";

/**
 * The public origin of the site answering this request, without a trailing
 * slash.
 *
 * `/sitemap.xml` and `/robots.txt` used to read `NEXT_PUBLIC_APP_URL` at module
 * scope and were prerendered. The Docker image is built with no
 * `NEXT_PUBLIC_*` set, so the value frozen into both files was the empty
 * string: production served a sitemap whose first `<loc>` was empty and whose
 * others were bare paths, and a robots.txt pointing at `/sitemap.xml`. Neither
 * is valid — both formats require absolute URLs.
 *
 * Resolving per request fixes that. The request's own host comes first, and
 * the configured URL is only the fallback: one process answers both
 * care.eagleinfosolutions.com and app.eagleinfosolutions.com with care's
 * NEXT_PUBLIC_APP_URL, so preferring the configured value made the commercial
 * host publish a sitemap of care's URLs.
 */
export async function getSiteUrl(): Promise<string> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host"))?.split(",")[0]?.trim();
  // A host header is caller-supplied; accept only something shaped like one.
  if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
    const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
    const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (local ? "http" : "https");
    return `${proto === "http" ? "http" : "https"}://${host}`;
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  return configured ? configured.replace(/\/+$/, "") : "";
}
