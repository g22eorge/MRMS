import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "Eagle Info Repair Manager",
  description: "Role-based repair job management system",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://mrms.eagleinfosolutions.com",
  ),
  openGraph: {
    title: "Eagle Info Repair Manager",
    description: "Role-based repair job management system",
    url: "/",
    siteName: "Eagle Info Solutions",
    type: "website",
    images: [{ url: "/eagle-info-logo.png", width: 512, height: 512, alt: "Eagle Info Solutions" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Eagle Info Repair Manager",
    description: "Role-based repair job management system",
    images: ["/eagle-info-logo.png"],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
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
