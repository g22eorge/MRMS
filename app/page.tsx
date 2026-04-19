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
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="data:image/png;base64,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"
                alt="Eagle Info Solutions"
                width={32}
                height={32}
              />
            </div>
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
