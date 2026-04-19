import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "Eagle Info Repair Manager",
  description: "Role-based repair job management system",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://eagleinfosolutions.com",
  ),
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
        <footer className="border-t border-[var(--line)] bg-white/70 px-4 py-2 text-center text-xs text-[var(--ink-muted)]">
          System built by Almeida @ 2026 all rights reserved.
        </footer>
        <Toaster richColors />
      </body>
    </html>
  );
}
