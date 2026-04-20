"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { NotificationBell } from "@/components/shared/NotificationBell";

type HeaderProps = {
  userName: string;
  role: string;
};

export function Header({ userName, role }: HeaderProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <header className="glass sticky top-0 z-30 border-b border-[var(--line)] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:py-3">
      <div className="mx-auto flex w-full max-w-lg flex-wrap items-center gap-3 md:max-w-none">
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">Signed in as</p>
          <p className="min-w-0 flex max-w-full flex-wrap items-center gap-1 text-sm font-semibold leading-snug">
            <span className="min-w-0 max-w-full truncate">{userName}</span>
            <span className="inline-flex max-w-full shrink-0 rounded-full bg-[var(--panel-strong)] px-2 py-0.5 text-xs text-[var(--ink-muted)]">
              {role}
            </span>
          </p>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
          <NotificationBell />
          <button
            disabled={isSigningOut}
            onClick={async () => {
              setIsSigningOut(true);
              const result = await authClient.signOut();
              if (result.error) {
                toast.error(result.error.message || "Sign out failed");
                setIsSigningOut(false);
                return;
              }
              router.push("/login");
              router.refresh();
            }}
            className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] transition hover:-translate-y-[1px] hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-60"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
