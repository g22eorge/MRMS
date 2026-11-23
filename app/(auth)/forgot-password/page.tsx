import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-form";

export const dynamic = "force-dynamic";

/**
 * Self-service password reset. The button on the sign-in page used to open
 * WhatsApp to support, which left anyone locked out waiting on a person.
 *
 * Needs outgoing email. Until RESEND_API_KEY is set this page says so and
 * points at the people who can reset a password by hand, instead of taking an
 * address and sending nothing.
 */
export default function ForgotPasswordPage() {
  const emailReady = Boolean(process.env.RESEND_API_KEY);
  const support = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  return (
    <main className="theme-blackgold flex min-h-dvh items-center justify-center bg-[#0a0a0a] px-4 py-12">
      <div className="w-full max-w-md space-y-4">
        <div>
          <h1 className="text-xl font-black text-white">Reset your password</h1>
          <p className="mt-1 text-sm text-white/60">
            {emailReady ? "Enter your email and we'll send you a link." : "Ask an administrator in your business to reset it for you."}
          </p>
        </div>

        {emailReady ? (
          <ForgotPasswordForm />
        ) : support ? (
          <a
            href={`https://wa.me/${support}?text=${encodeURIComponent("Hi, please reset my password.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm font-semibold text-[#C9A227]"
          >
            Message support on WhatsApp
          </a>
        ) : null}

        <p className="text-center text-xs text-white/40">
          <Link href="/login" className="text-[#C9A227]/70 hover:text-[#C9A227]">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
