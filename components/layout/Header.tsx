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
    <header className="glass sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">Signed in as</p>
        <p className="min-w-0 text-sm font-semibold leading-snug">
          <span className="block truncate sm:inline">{userName}</span>{" "}
          <span className="mt-1 inline-flex max-w-full rounded-full bg-[var(--panel-strong)] px-2 py-0.5 text-xs text-[var(--ink-muted)] sm:mt-0 sm:ml-1">
            {role}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
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
    </header>
  );
}
