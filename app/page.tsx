import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12">
      <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
        <p className="text-[11px] font-bold tracking-widest uppercase text-[var(--ink-muted)]">Eagle Info Solutions</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--ink)]">Repair Manager</h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Internal repair workflow for intake, hardware repairs, and software services.
        </p>

        <div className="mt-6 flex gap-3">
          <Link href="/login" className="btn-premium rounded-md px-4 py-2 text-sm">
            Sign in
          </Link>
          <a
            href="https://eagleinfosolutions.com"
            className="btn-premium-secondary rounded-md px-4 py-2 text-sm"
            target="_blank"
            rel="noreferrer"
          >
            Company site
          </a>
        </div>
      </div>
    </main>
  );
}
