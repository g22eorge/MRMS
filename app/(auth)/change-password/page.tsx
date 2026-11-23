// Reads the live session and the DB; never prerender.
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { SubmitButton } from "@/components/ui/SubmitButton";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

import { changeIssuedPasswordAction } from "./actions";

/**
 * Where a staff member lands after an admin has reset their password.
 *
 * requireOrgSession sends anyone carrying `mustChangePassword` here, so every
 * page in the app is closed to them until they have chosen a password the admin
 * does not know. This page reads the session directly for that reason. Someone
 * who is not flagged has no business here — the voluntary change lives in
 * Settings → Profile — and is sent on to the dashboard.
 */
export default async function ChangeIssuedPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const { error } = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, isActive: true, mustChangePassword: true },
  });
  if (!user?.isActive) redirect("/login");
  if (!user.mustChangePassword) redirect("/dashboard");

  const field =
    "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#C9A227]/50";
  const label = "text-[0.75rem] font-semibold uppercase tracking-wide text-white/50";

  return (
    <main className="theme-blackgold flex min-h-dvh items-center justify-center bg-[#0a0a0a] px-4 py-12">
      <div className="w-full max-w-md space-y-4">
        <div>
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.2em] text-white/40">{user.name}</p>
          <h1 className="mt-1 text-xl font-black text-white">Set your own password</h1>
          <p className="mt-1 text-sm text-white/60">
            An administrator reset your password, so they know the current one. Choose your own before you continue.
          </p>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        ) : null}

        <form action={changeIssuedPasswordAction} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <label className="block space-y-1">
            <span className={label}>The password you were given</span>
            <input type="password" name="currentPassword" required autoComplete="current-password" className={field} />
          </label>
          <label className="block space-y-1">
            <span className={label}>New password</span>
            <input type="password" name="newPassword" required minLength={8} autoComplete="new-password" className={field} />
            <span className="text-[0.75rem] text-white/40">At least 8 characters.</span>
          </label>
          <label className="block space-y-1">
            <span className={label}>Confirm new password</span>
            <input type="password" name="confirmPassword" required minLength={8} autoComplete="new-password" className={field} />
          </label>
          <SubmitButton bare className="w-full rounded-xl bg-[#C9A227] py-3 text-sm font-semibold text-black transition hover:bg-[#c9a430] disabled:opacity-50">
            Save password
          </SubmitButton>
        </form>

        {/* A plain GET form, not a <Link>: force-logout is a route handler that
            clears the session and redirects, so it has to be a real navigation. */}
        <form action="/api/auth/force-logout" method="get" className="text-center text-xs text-white/40">
          Not you?{" "}
          <button type="submit" className="text-[#C9A227]/70 hover:text-[#C9A227]">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
