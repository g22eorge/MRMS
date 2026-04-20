import type { Metadata } from "next";
import Link from "next/link";
import WhatsAppFloat from "@/components/shared/WhatsAppFloat";
import { redirect } from "next/navigation";

import { eagleLogo } from "@/lib/eagle-logo";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://mrms.eagleinfosolutions.com/#business",
  name: "Eagle Info Solutions SMC Limited",
  description:
    "Professional repair for phones, laptops, tablets and software in Kampala, Uganda. Transparent pricing, no-fix-no-fee guarantee, 30-day warranty.",
  url: "https://eagleinfosolutions.com",
  telephone: ["+256772006344", "+256754006344"],
  image: "https://mrms.eagleinfosolutions.com/eagle-info-logo.png",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Shop L28, Nalubega Complex",
    addressLocality: "Kampala",
    addressCountry: "UG",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 0.3476,
    longitude: 32.5825,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "08:00",
      closes: "18:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Saturday"],
      opens: "09:00",
      closes: "15:00",
    },
  ],
  priceRange: "$$",
  sameAs: ["https://eagleinfosolutions.com"],
};

const features = [
  { title: "Jobs, timelines & audit logs", body: "Every repair tracked end-to-end." },
  { title: "Website repair request intake", body: "Approve, reject, or convert to jobs." },
  { title: "Notifications with delivery tracking", body: "Retry history and failure reasons." },
];

const commitments = [
  { title: "Transparent pricing", body: "Written quote before work starts — no surprises." },
  { title: "No fix, no fee", body: "Can't repair it? You pay nothing for the attempt." },
  { title: "Your data stays yours", body: "We never access, copy, or store your files." },
  { title: "Quality parts", body: "Genuine or certified-equivalent, fully documented." },
  { title: "30-day warranty", body: "Same fault returns within 30 days — fixed free." },
  { title: "You're kept informed", body: "Updates at diagnosis, approval, and completion." },
];

const shortLinks = [
  { slug: "/app",     label: "MRMS App" },
  { slug: "/repair",  label: "Repair Request" },
  { slug: "/address", label: "Our Location" },
  { slug: "/company", label: "Company Site" },
  { slug: "/profile", label: "Company Profile" },
];

export default async function HomePage() {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  return (
    <>
    <main className="theme-blackgold relative flex min-h-screen flex-col overflow-hidden bg-[#050505]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_450px_at_18%_18%,rgba(212,175,55,0.18),transparent_55%),radial-gradient(820px_520px_at_85%_72%,rgba(212,175,55,0.12),transparent_60%)]" />

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-10 pb-6 md:pt-12 md:pb-8">

        {/* Wordmark */}
        <div className="fade-in mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-[#D4AF37]/30 bg-white shadow-[0_0_12px_rgba(212,175,55,0.2)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={eagleLogo} alt="Eagle Info Solutions" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-[var(--ink)]">Eagle Info Solutions</p>
            <p className="text-[11px] text-[var(--ink-muted)]">SMC Limited</p>
          </div>
        </div>

        {/* CTA row — instant access for customers and visitors */}
        <div className="fade-in mb-5 flex flex-wrap gap-2.5" style={{ animationDelay: "30ms" }}>
          <Link
            href="/repair"
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-black shadow-[0_4px_18px_rgba(212,175,55,0.3)]"
            style={{ background: "linear-gradient(180deg, #E8C84A 0%, #C9A020 100%)" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            Request a Repair
          </Link>
          <a
            href="https://eagleinfosolutions.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-white/80 backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-white/[0.09] hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Visit our Website
          </a>
        </div>

        {/* Hero grid */}
        <div className="grid gap-4 md:grid-cols-2 md:items-stretch">

          {/* Staff card */}
          <div
            className="fade-in relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_24px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_28px_56px_rgba(0,0,0,0.55)]"
            style={{ animationDelay: "60ms" }}
          >
            <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[#D4AF37]/10 blur-2xl" />
            <p className="relative text-[10px] font-bold uppercase tracking-widest text-[var(--ink-muted)]">Internal Operations</p>
            <h1 className="relative mt-2 text-2xl font-extrabold leading-tight text-[var(--ink)] md:text-3xl">Repair Manager</h1>
            <p className="relative mt-1 text-[11px] font-medium tracking-wide text-[#D4AF37]/70">Every job tracked. Every handoff accountable.</p>
            <p className="relative mt-2 text-sm leading-5 text-[var(--ink-muted)]">
              End-to-end repair management — from first contact to device return, built for speed, auditability, and client privacy.
            </p>
            <div className="relative mt-4">
              <Link href="/login" className="btn-premium rounded-md px-4 py-2 text-sm font-semibold">
                Sign In
              </Link>
            </div>
            <div className="relative mt-4">
              <p className="mb-2 text-[10px] uppercase tracking-widest text-[var(--ink-muted)]">Quick links</p>
              <div className="flex flex-col gap-0.5">
                {shortLinks.map(({ slug, label }) => (
                  <Link
                    key={slug}
                    href={slug}
                    className="group flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-all hover:bg-[#D4AF37]/10"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-[#D4AF37]/40 transition-colors group-hover:bg-[#D4AF37]" />
                      <span className="text-xs text-[var(--ink-muted)] transition-colors group-hover:text-[var(--ink)]">{label}</span>
                    </div>
                    <span className="font-mono text-[10px] text-[#D4AF37]/80 transition-colors group-hover:text-[#D4AF37]">{slug}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="grid gap-3">

            {/* Customer card — bold gold treatment */}
            <div
              className="fade-in relative overflow-hidden rounded-2xl border border-[#D4AF37]/35 p-5 text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D4AF37]/55 hover:shadow-[0_0_32px_rgba(212,175,55,0.12)]"
              style={{
                animationDelay: "120ms",
                background: "linear-gradient(135deg, #1f1b0e 0%, #141006 40%, #0c0c0c 100%)",
                boxShadow: "0 0 0 1px rgba(212,175,55,0.15), 0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,175,55,0.12)",
              }}
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full bg-[#D4AF37]/15 blur-2xl" />
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent" />
              <p className="relative text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]/60">For customers</p>
              <h2 className="relative mt-1.5 text-xl font-extrabold text-white">Need a repair?</h2>
              <p className="relative mt-1 text-sm leading-5 text-white/60">
                Submit a repair request online. Our team will review it and get back to you.
              </p>
              <div className="relative mt-4 flex flex-wrap gap-2">
                <Link
                  href="/repair"
                  className="rounded-md px-3.5 py-1.5 text-sm font-bold text-black shadow-[0_4px_14px_rgba(212,175,55,0.35)]"
                  style={{ background: "linear-gradient(180deg, #E8C84A 0%, #C9A020 100%)" }}
                >
                  Request Repair
                </Link>
                <Link href="/address" className="rounded-md border border-white/20 bg-white/[0.07] px-3.5 py-1.5 text-sm font-semibold text-white/85 transition-colors hover:bg-white/[0.12]">
                  Find Us
                </Link>
              </div>
            </div>

            {/* Features card */}
            <div
              className="fade-in rounded-2xl border border-white/8 bg-[#1e1e1e] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/14 hover:bg-[#222]"
              style={{ animationDelay: "180ms" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ink-muted)]">What&apos;s inside</p>
              <div className="mt-2.5 grid gap-2 text-sm">
                {features.map((f) => (
                  <div key={f.title} className="flex items-start gap-2.5">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#D4AF37]" />
                    <div>
                      <span className="font-semibold text-[var(--ink)]">{f.title}</span>
                      <span className="text-[var(--ink-muted)]"> — {f.body}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Brands strip */}
        <div className="fade-in my-5 flex-1" style={{ animationDelay: "220ms" }}>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--line)]" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ink-muted)]">Devices we service</p>
            <div className="h-px flex-1 bg-[var(--line)]" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {["Apple", "Microsoft", "Dell", "HP", "Lenovo", "Adobe", "Kaspersky", "APC", "AutoCAD", "ArchiCAD"].map((brand) => (
              <span
                key={brand}
                className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] font-medium tracking-wide text-[var(--ink-muted)] transition-colors hover:border-[#D4AF37]/30 hover:text-[#D4AF37]/80"
              >
                {brand}
              </span>
            ))}
          </div>
        </div>

        {/* Commitment strip */}
        <div className="fade-in mt-5" style={{ animationDelay: "240ms" }}>
          <div className="mb-3 flex items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ink-muted)]">Our commitment to you</p>
            <div className="h-px flex-1 bg-[var(--line)]" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {commitments.map((c, i) => (
              <div
                key={c.title}
                className="flex min-h-[4rem] items-start gap-2.5 rounded-xl border border-white/8 bg-[#141414] px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/14 hover:bg-[#181818]"
              >
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15 text-[10px] font-bold text-[#D4AF37]">
                  {i + 1}
                </span>
                <div>
                  <p className="text-xs font-semibold text-[var(--ink)]">{c.title}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[var(--ink-muted)]">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="border-t border-[var(--line)] px-4 py-5 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-[11px] text-[var(--ink-muted)]">© 2026 Eagle Info Solutions SMC Limited</span>
          <a
            href="https://eagleinfosolutions.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1 text-[11px] font-semibold text-white/70 transition-all hover:border-[#D4AF37]/35 hover:text-[#D4AF37]"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            eagleinfosolutions.com
          </a>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          <a href="tel:+256772006344" className="flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)] transition-colors hover:text-[#D4AF37]">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 012 1.18 2 2 0 014 .03h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
            +256 772 006 344
          </a>
          <span className="text-[11px] text-white/30">·</span>
          <a href="tel:+256754006344" className="text-[11px] text-[var(--ink-muted)] transition-colors hover:text-[#D4AF37]">+256 754 006 344</a>
          <span className="text-[11px] text-white/30">·</span>
          <a
            href="https://www.google.com/maps/search/?api=1&query=Eagle+Info+Solutions%2C+Shop+L28%2C+1st+Floor%2C+Nalubega+Complex%2C+Bombo+Road%2C+Kampala%2C+Uganda"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)] transition-colors hover:text-[#D4AF37]"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Shop L28, Nalubega Complex, Kampala
          </a>
        </div>
      </div>

    </main>
    <WhatsAppFloat />
    </>
  );
}
