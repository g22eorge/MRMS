import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

// Resolved per request, never prerendered — see lib/site-url.ts.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await getSiteUrl();
  return [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/repair`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/address`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.6 },
  ];
}
