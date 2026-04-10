"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

type HeaderProps = {
  userName: string;
  role: string;
};

export function Header({ userName, role }: HeaderProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications")
      .then(res => res.json())
      .then(data => setUnreadCount(data.unreadCount || 0))
      .catch(console.error);
  }, []);

  return (
    <header className="glass sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 md:py-3">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">Signed in as</p>
        <p className="break-all text-sm font-semibold leading-snug md:break-normal">
          {userName} <span className="ml-1 rounded-full bg-[var(--panel-strong)] px-2 py-0.5 text-xs text-[var(--ink-muted)]">{role}</span>
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-md border border-black bg-black px-3 py-2 text-white">
          <span>🔔</span>
          <span className="text-xs font-bold">Alerts</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[#D4AF37] px-2 py-0.5 text-[10px] font-bold text-black">
              {unreadCount}
            </span>
          )}
        </div>
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
          className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-sm text-[var(--ink)] transition hover:-translate-y-[1px] hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-60"
        >
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </header>
  );
}
