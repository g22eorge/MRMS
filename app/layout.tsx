import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { Manrope, DM_Serif_Display } from "next/font/google";

import { ThemeProvider, type Theme } from "@/components/layout/ThemeProvider";
import "./globals.css";

// Manrope and DM Serif Display — the pair eagleinfosolutions.com is set in, so
// a customer moving from the website to an invoice sees one company rather than
// two. Inter was here before and is the reason the dashboard read as generic
// SaaS: it is the face Stripe, Linear and Figma all use.
//
// Both are self-hosted by Next.js, so there is no render-blocking request to
// Google and no layout shift.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-inter", // consumed as --font-inter throughout globals.css
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

// Headings only, and only one weight exists. The website pairs it the same way:
// a serif display over a sans body is most of why that page reads established
// rather than templated.
const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400"],
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
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${dmSerif.variable} h-full antialiased${themeClass ? " " + themeClass : ""}`}>
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
