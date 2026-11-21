import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

// Resolved per request, never prerendered — see lib/site-url.ts.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/repair", "/address", "/company"],
        // Merged from the former public/robots.txt, which covered finance,
        // inventory, sales, pos and documents that this list had missed. Both
        // files existed, and Next 500s on /robots.txt when they do — masked
        // until now because proxy.ts was redirecting the URL before Next
        // resolved it.
        disallow: [
          "/api/", "/dashboard", "/jobs", "/clients", "/finance", "/inventory",
          "/reports", "/settings", "/technicians", "/intake", "/sales", "/pos",
          "/documents", "/profile",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
