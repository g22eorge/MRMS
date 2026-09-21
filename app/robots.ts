import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/repair", "/address", "/company", "/profile"],
        // Merged from the former public/robots.txt, which covered finance,
        // inventory, sales, pos and documents that this list had missed. Both
        // files existed, and Next 500s on /robots.txt when they do — masked
        // until now because proxy.ts was redirecting the URL before Next
        // resolved it.
        disallow: [
          "/api/", "/dashboard", "/jobs", "/clients", "/finance", "/inventory",
          "/reports", "/settings", "/technicians", "/intake", "/sales", "/pos",
          "/documents",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
