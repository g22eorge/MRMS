import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="theme-blackgold relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_450px_at_18%_18%,rgba(212,175,55,0.18),transparent_55%),radial-gradient(820px_520px_at_85%_72%,rgba(212,175,55,0.12),transparent_60%)]" />

      <div className="mx-auto w-full max-w-5xl px-4 py-12 md:py-16">
        <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
          <div className="glass panel-shadow rounded-3xl border border-[var(--line)] p-7 md:p-10">
            <p className="text-[11px] font-bold tracking-widest uppercase text-[var(--ink-muted)]">Eagle Info Solutions</p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight text-[var(--ink)] md:text-4xl">
              Repair Manager
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
              Internal operations for intake, hardware repairs, outsourced work tracking, and software services. Built for
              speed, auditability, and client privacy.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/app" className="btn-premium rounded-md px-4 py-2 text-sm">
                Open MRMS
              </Link>
              <Link href="/login" className="btn-premium-secondary rounded-md px-4 py-2 text-sm">
                Sign in
              </Link>
            </div>

            <div className="mt-6 grid gap-2 text-xs text-[var(--ink-muted)]">
              <div>
                Short links: <span className="font-mono">/app</span>, <span className="font-mono">/repair</span>,{" "}
                <span className="font-mono">/address</span>
              </div>
              <div>
                Company site: <span className="font-mono">/company</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-[var(--line)] bg-black p-7 text-white md:p-10">
              <p className="text-[11px] font-bold tracking-widest uppercase text-white/70">For customers</p>
              <h2 className="mt-3 text-2xl font-extrabold">Need a repair?</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Use the company repair request form. Staff will review and contact you.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/repair" className="rounded-md bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black">
                  Request Repair
                </Link>
                <Link
                  href="/address"
                  className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
                >
                  Find Location
                </Link>
              </div>
            </div>

            <div className="grid gap-4 rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-7 md:p-10">
              <p className="text-[11px] font-bold tracking-widest uppercase text-[var(--ink-muted)]">What’s inside</p>
              <div className="grid gap-3 text-sm text-[var(--ink)]">
                <div className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[#D4AF37]" />
                  <div>
                    <p className="font-semibold">Jobs, timelines, and audit logs</p>
                    <p className="text-[var(--ink-muted)]">Everything tracked per job, including external work.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[#D4AF37]" />
                  <div>
                    <p className="font-semibold">Website requests intake</p>
                    <p className="text-[var(--ink-muted)]">Approve/reject/convert, plus corrections sync to jobs.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[#D4AF37]" />
                  <div>
                    <p className="font-semibold">Outbox notifications</p>
                    <p className="text-[var(--ink-muted)]">Retry + cron, with clear failure reasons.</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href="https://eagleinfosolutions.com"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-premium-secondary rounded-md px-4 py-2 text-sm"
                >
                  Visit Company Site
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
