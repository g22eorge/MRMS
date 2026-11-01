import Link from "next/link";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { PlatformNav } from "./PlatformNav";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePlatformAdmin();
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--ink)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--panel)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4 min-w-0">
            <span className="flex items-center gap-2 text-xs font-bold tracking-wide text-[var(--ink)] shrink-0">
              <span className="rounded bg-[var(--accent)]/20 px-1.5 py-0.5 mono text-[0.75rem] font-bold text-[var(--accent)]">PLATFORM</span>
              Admin
            </span>
            <div className="h-4 w-px bg-[var(--line)] shrink-0" />
            <PlatformNav />
          </div>
          <div className="flex items-center gap-3 py-2.5">
            <span className="hidden text-xs text-[var(--ink-muted)] sm:block">{user!.email}</span>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--ink)] sm:py-1.5"
            >
              ← App
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
