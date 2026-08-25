import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { Barlow, Barlow_Condensed, Inter } from "next/font/google";

import { ThemeProvider, type Theme } from "@/components/layout/ThemeProvider";
import "./globals.css";

// Inter — industry standard for business SaaS dashboards (Stripe, Linear, Figma).
// Next.js serves it self-hosted with zero layout shift and full subsetting.
// Variable font covers all weights (100–900) in a single ~95 KB download.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  // Preload only the weights we actually use to keep the WOFF2 small
  weight: ["400", "500", "600", "700", "800", "900"],
});

// Barlow and Barlow Condensed are used by the public repair landing only — the
// condensed cut carries its signage-weight headings, the regular its body copy.
// preload:false keeps them out of the <head> of every app route; the browser
// fetches them only where the CSS variables are actually applied.
const barlow = Barlow({
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
  weight: ["400", "500", "600"],
  preload: false,
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
  display: "swap",
  weight: ["600", "700"],
  preload: false,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000";
const ogImage = `${siteUrl}/eagle-info-logo.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Duuka ProMax",
    template: "%s | Duuka ProMax",
  },
  description: "Business management platform for repairs, sales, inventory, finance, documents, and daily operations.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Duuka ProMax",
    description: "Business management platform for repairs, sales, inventory, finance, documents, and daily operations.",
    url: "/",
    siteName: "Duuka ProMax",
    type: "website",
    images: [{ url: ogImage, width: 512, height: 512, alt: "Duuka ProMax" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Duuka ProMax",
    description: "Business management platform for repairs, sales, inventory, finance, documents, and daily operations.",
    images: [ogImage],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow user scaling — required by WCAG 2.1 SC 1.4.4 and iOS accessibility
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const stored = cookieStore.get("theme")?.value as string | undefined;
  // Normalise legacy "dark" → "blackgold"; anything unknown → "system".
  const initialTheme: Theme =
    stored === "dark" ? "blackgold" :
    stored === "light" || stored === "blackgold" || stored === "navy" ? stored :
    "system";

  const themeClass =
    initialTheme === "light" ? "light" :
    initialTheme === "blackgold" ? "theme-blackgold" :
    initialTheme === "navy" ? "theme-blackgold theme-navy" :
    "";

  return (
    // suppressHydrationWarning: the theme class is finalized on the client and
    // browser extensions inject attributes on <html> (e.g. crxemulator="") before
    // hydration. Scoped to this element only — it never masks child mismatches.
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${barlow.variable} ${barlowCondensed.variable} h-full antialiased${themeClass ? " " + themeClass : ""}`}>
      <body className="min-h-full bg-[var(--page-bg)] text-[var(--ink)]">
        <ThemeProvider initialTheme={initialTheme}>
          {children}
          <Toaster richColors />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
