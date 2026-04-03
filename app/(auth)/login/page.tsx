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
    <main className="min-h-screen bg-slate-100">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <section className="relative overflow-hidden bg-[linear-gradient(140deg,#0b8f86_0%,#0f766e_42%,#164e63_100%)] px-8 py-10 text-white lg:px-12 lg:py-14">
          <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-cyan-200/20 blur-3xl" />

          <div className="relative mx-auto max-w-xl space-y-7">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/80">Eagle Info Solutions</p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight lg:text-4xl">
                Better Repair Management Starts with Better Communication
              </h1>
              <p className="mt-4 text-sm leading-6 text-white/90">
                MRMS keeps client data protected while enabling precise coordination between intake,
                technicians, operations, and accounts. Every update stays clear, traceable, and aligned
                to Eagle Info service standards.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Client information stays controlled and role-protected",
                "Device records and diagnostics are tracked with clarity",
                "Approvals, recommendations, and updates stay auditable",
                "Faster turnaround through cleaner team communication",
              ].map((item) => (
                <div key={item} className="rounded-xl border border-white/25 bg-white/10 p-3 backdrop-blur-sm">
                  <p className="text-sm text-white/95">{item}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/25 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm font-semibold">Trusted Workflow Promise</p>
              <p className="mt-1 text-sm text-white/90">
                Proper handling of clients, equipment, and technician communication strengthens quality,
                protects trust, and preserves the reputation of Eagle Info Solutions.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-slate-50 px-6 py-8 lg:px-10">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">MRMS</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Machine Repair Management System</h2>
            <p className="mt-2 text-sm text-slate-600">Sign in to continue to your secure repair workspace.</p>

            <div className="mt-6">
              <LoginForm />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
