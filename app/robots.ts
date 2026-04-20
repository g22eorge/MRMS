import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://mrms.eagleinfosolutions.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/repair", "/address", "/company", "/profile"],
        disallow: ["/dashboard", "/jobs", "/clients", "/reports", "/settings", "/technicians", "/intake", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
