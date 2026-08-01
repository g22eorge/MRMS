import { redirect } from "next/navigation";

import { getPortalSession } from "@/lib/portal-auth";
import { PortalLoginForm } from "./PortalLoginForm";

export const dynamic = "force-dynamic";

export default async function PortalLoginPage() {
  const existing = await getPortalSession();
  if (existing) redirect("/portal/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Client Portal</p>
          <h1 className="mt-1 text-xl font-black text-[var(--ink)]">Sign in to track your repairs</h1>
          <p className="mt-1 text-[13px] text-[var(--ink-muted)]">Use the credentials your service provider gave you.</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
          <PortalLoginForm />
        </div>
        <p className="text-center text-[12px] text-[var(--ink-muted)]">
          Trouble signing in? Contact your service provider to reset your access.
        </p>
      </div>
    </div>
  );
}
