import Link from "next/link";

import { ResetPasswordForm } from "./reset-form";

export const dynamic = "force-dynamic";

/** Where the emailed reset link lands. The token in the address is single-use. */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const usable = Boolean(token) && !error;

  return (
    <main className="theme-blackgold flex min-h-dvh items-center justify-center bg-[#0a0a0a] px-4 py-12">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-black text-white">Choose a new password</h1>
        {usable ? (
          <ResetPasswordForm token={token as string} />
        ) : (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/80">
            <p role="alert">This link has expired or was already used.</p>
            <Link href="/forgot-password" className="block rounded-xl bg-[#C9A227] py-3 text-center text-sm font-semibold text-black">
              Send a new link
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
