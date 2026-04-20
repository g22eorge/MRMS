import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://mrms.eagleinfosolutions.com";
const ogImage = `${siteUrl}/eagle-info-logo.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Eagle Info Solutions — Device Repair in Kampala, Uganda",
    template: "%s | Eagle Info Solutions",
  },
  description:
    "Professional repair for phones, laptops, tablets & software in Kampala, Uganda. Transparent pricing, no-fix-no-fee guarantee, 30-day warranty. Request a repair online.",
  keywords: [
    "device repair Kampala",
    "phone repair Uganda",
    "laptop repair Kampala",
    "Apple repair Uganda",
    "computer repair Kampala",
    "Eagle Info Solutions",
    "screen repair Uganda",
    "software repair Kampala",
  ],
  authors: [{ name: "Eagle Info Solutions SMC Limited", url: "https://eagleinfosolutions.com" }],
  creator: "Eagle Info Solutions SMC Limited",
  publisher: "Eagle Info Solutions SMC Limited",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Eagle Info Solutions — Device Repair in Kampala, Uganda",
    description:
      "Professional repair for phones, laptops & tablets in Kampala. Transparent pricing, no-fix-no-fee, 30-day warranty.",
    url: "/",
    siteName: "Eagle Info Solutions",
    type: "website",
    locale: "en_UG",
    images: [{ url: ogImage, width: 512, height: 512, alt: "Eagle Info Solutions" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Eagle Info Solutions — Device Repair in Kampala",
    description: "Professional repair for phones, laptops & tablets. No-fix-no-fee · 30-day warranty.",
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
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--page-bg)] text-[var(--ink)]">
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
