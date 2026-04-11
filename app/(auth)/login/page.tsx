import { redirect } from "next/navigation";

import { LoginForm } from "@/app/(auth)/login/login-form";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await getSession();
  const validUser = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, isActive: true },
      })
    : null;

  if (validUser?.isActive) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-dvh bg-[var(--panel)]">
      <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        <section className="order-2 relative overflow-hidden bg-[linear-gradient(140deg,#000000_0%,#1a1a1a_40%,#D4AF37_100%)] px-5 py-7 text-white sm:px-8 sm:py-10 lg:order-1 lg:px-12 lg:py-14">
          <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-[#D4AF37]/20 blur-3xl" />

          <div className="relative mx-auto max-w-xl space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/80">Eagle Info Solutions</p>
              <h1 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl lg:text-4xl">
                Repair jobs, without the chaos
              </h1>
              <p className="mt-4 max-w-prose text-sm leading-6 text-white/90">
                Secure job tracking for intake, technicians, and operations. Clear status, clear accountability.
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {[
                "Role-based access keeps client data protected",
                "Statuses, approvals, and timelines stay auditable",
              ].map((item) => (
                <div key={item} className="rounded-xl border border-white/25 bg-white/10 p-3 backdrop-blur-sm">
                  <p className="text-sm text-white/95">{item}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/25 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm font-semibold">Workflow promise</p>
              <p className="mt-1 text-sm text-white/90">Every change is logged. Every handoff is traceable.</p>
            </div>
          </div>
        </section>

        <section className="order-1 flex items-center justify-center bg-[var(--panel)] px-4 py-5 sm:px-6 sm:py-8 lg:order-2 lg:px-10">
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] sm:p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--ink-muted)]">MRMS</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--ink)] sm:text-2xl">Machine Repair Management System</h2>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">Sign in to continue to your secure repair workspace.</p>

            <div className="mt-6">
              <LoginForm />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
