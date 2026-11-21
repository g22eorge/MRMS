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
 * Resolving per request fixes that, and is also the only correct answer for an
 * image that serves care.* and app.* from one build.
 */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
