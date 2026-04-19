import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

const features = [
  {
    title: "Jobs, timelines, and audit logs",
    body: "Every repair tracked end-to-end, including outsourced work.",
  },
  {
    title: "Website repair request intake",
    body: "Approve, reject, or convert requests directly into jobs.",
  },
  {
    title: "Notifications with delivery tracking",
    body: "Automated alerts with full retry history and failure reasons.",
  },
];

const shortLinks = ["/app", "/repair", "/address", "/company"];

export default async function HomePage() {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="theme-blackgold relative flex min-h-screen flex-col overflow-hidden bg-[#050505]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_450px_at_18%_18%,rgba(212,175,55,0.18),transparent_55%),radial-gradient(820px_520px_at_85%_72%,rgba(212,175,55,0.12),transparent_60%)]" />

      <div className="flex flex-1 flex-col justify-center">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 md:py-16">
          {/* Wordmark */}
          <div className="mb-8 flex items-center gap-3">
            <Image
              src="/eagle-info-logo.png"
              alt="Eagle Info Solutions"
              width={40}
              height={40}
              className="flex-shrink-0"
              style={{ filter: "invert(1) sepia(0.4) saturate(2) hue-rotate(5deg) brightness(0.95)" }}
            />
            <div>
              <p className="text-sm font-bold leading-tight text-[var(--ink)]">Eagle Info Solutions</p>
              <p className="text-[11px] text-[var(--ink-muted)]">SMC Limited</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
            {/* Staff card */}
            <div className="glass panel-shadow rounded-3xl border border-[var(--line)] p-7 md:p-10">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--ink-muted)]">
                Internal Operations
              </p>
              <h1 className="mt-3 text-3xl font-extrabold leading-tight text-[var(--ink)] md:text-4xl">
                Repair Manager
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
                Intake, hardware repairs, outsourced work tracking, and software services — built for speed,
                auditability, and client privacy.
              </p>

              <div className="mt-7">
                <Link href="/login" className="btn-premium rounded-md px-5 py-2.5 text-sm font-semibold">
                  Sign In
                </Link>
              </div>

              <div className="mt-6">
                <p className="mb-2 text-[11px] uppercase tracking-widest text-[var(--ink-muted)]">Short links</p>
                <div className="flex flex-wrap gap-2">
                  {shortLinks.map((slug) => (
                    <Link
                      key={slug}
                      href={slug}
                      className="rounded-full border border-[var(--line)] bg-white/5 px-3 py-1 font-mono text-[11px] text-[var(--ink-muted)] transition-colors hover:border-[#D4AF37]/50 hover:text-[#D4AF37]"
                    >
                      {slug}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="grid gap-4">
              {/* Customer card */}
              <div className="rounded-3xl border border-[var(--line)] bg-[#111111] p-7 text-white md:p-10">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">For customers</p>
                <h2 className="mt-3 text-2xl font-extrabold">Need a repair?</h2>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Submit a repair request online. Our team will review it and get back to you.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/repair"
                    className="rounded-md bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black"
                  >
                    Request Repair
                  </Link>
                  <Link
                    href="/address"
                    className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Find Us
                  </Link>
                </div>
              </div>

              {/* Features card */}
              <div className="rounded-3xl border border-[var(--line)] bg-[#1a1a1a] p-7 md:p-10">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--ink-muted)]">
                  What&apos;s inside
                </p>
                <div className="mt-4 grid gap-3 text-sm text-[var(--ink)]">
                  {features.map((f) => (
                    <div key={f.title} className="flex items-start gap-3">
                      <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#D4AF37]" />
                      <div>
                        <p className="font-semibold">{f.title}</p>
                        <p className="text-[var(--ink-muted)]">{f.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--line)] px-4 py-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[var(--ink-muted)]">
          <span>© 2026 Eagle Info Solutions SMC Limited</span>
          <a
            href="https://eagleinfosolutions.com"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-[#D4AF37]"
          >
            eagleinfosolutions.com ↗
          </a>
        </div>
      </div>
    </main>
  );
}
