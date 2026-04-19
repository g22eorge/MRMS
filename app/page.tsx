import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

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

const shortLinks = ["/app", "/repair", "/address", "/company"];

export default async function HomePage() {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="theme-blackgold relative flex min-h-screen flex-col overflow-hidden bg-[#050505]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_450px_at_18%_18%,rgba(212,175,55,0.18),transparent_55%),radial-gradient(820px_520px_at_85%_72%,rgba(212,175,55,0.12),transparent_60%)]" />

      <div className="flex flex-1 flex-col justify-center">
        <div className="mx-auto w-full max-w-5xl px-4 py-6">

          {/* Wordmark */}
          <div className="mb-5 flex items-center gap-3">
            <Image
              src="/eagle-info-logo.png"
              alt="Eagle Info Solutions"
              width={36}
              height={36}
              className="flex-shrink-0"
              style={{ filter: "invert(1) sepia(0.4) saturate(2) hue-rotate(5deg) brightness(0.95)" }}
            />
            <div>
              <p className="text-sm font-bold leading-tight text-[var(--ink)]">Eagle Info Solutions</p>
              <p className="text-[11px] text-[var(--ink-muted)]">SMC Limited</p>
            </div>
          </div>

          {/* Hero grid */}
          <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
            {/* Staff card */}
            <div className="glass panel-shadow rounded-2xl border border-[var(--line)] p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ink-muted)]">Internal Operations</p>
              <h1 className="mt-2 text-2xl font-extrabold leading-tight text-[var(--ink)] md:text-3xl">Repair Manager</h1>
              <p className="mt-2 text-sm leading-5 text-[var(--ink-muted)]">
                Intake, hardware repairs, outsourced work tracking, and software services — built for speed, auditability, and client privacy.
              </p>
              <div className="mt-4">
                <Link href="/login" className="btn-premium rounded-md px-4 py-2 text-sm font-semibold">
                  Sign In
                </Link>
              </div>
              <div className="mt-4">
                <p className="mb-1.5 text-[10px] uppercase tracking-widest text-[var(--ink-muted)]">Short links</p>
                <div className="flex flex-wrap gap-1.5">
                  {shortLinks.map((slug) => (
                    <Link
                      key={slug}
                      href={slug}
                      className="rounded-full border border-[var(--line)] bg-white/5 px-2.5 py-0.5 font-mono text-[10px] text-[var(--ink-muted)] transition-colors hover:border-[#D4AF37]/50 hover:text-[#D4AF37]"
                    >
                      {slug}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="grid gap-3">
              {/* Customer card */}
              <div className="rounded-2xl border border-[var(--line)] bg-[#111111] p-5 text-white">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">For customers</p>
                <h2 className="mt-1.5 text-xl font-extrabold">Need a repair?</h2>
                <p className="mt-1 text-sm leading-5 text-white/60">
                  Submit a repair request online. Our team will review it and get back to you.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/repair" className="rounded-md bg-[#D4AF37] px-3.5 py-1.5 text-sm font-semibold text-black">
                    Request Repair
                  </Link>
                  <Link href="/address" className="rounded-md border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm font-semibold text-white">
                    Find Us
                  </Link>
                </div>
              </div>

              {/* Features card */}
              <div className="rounded-2xl border border-[var(--line)] bg-[#1a1a1a] p-5">
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

          {/* Commitment strip */}
          <div className="mt-5">
            <div className="mb-3 flex items-center gap-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ink-muted)]">Our commitment to you</p>
              <div className="h-px flex-1 bg-[var(--line)]" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {commitments.map((c, i) => (
                <div key={c.title} className="flex items-start gap-2.5 rounded-xl border border-[var(--line)] bg-[#141414] px-4 py-3">
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
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--line)] px-4 py-3 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[var(--ink-muted)]">
          <span>© 2026 Eagle Info Solutions SMC Limited</span>
          <a href="https://eagleinfosolutions.com" target="_blank" rel="noreferrer" className="transition-colors hover:text-[#D4AF37]">
            eagleinfosolutions.com ↗
          </a>
        </div>
      </div>
    </main>
  );
}
