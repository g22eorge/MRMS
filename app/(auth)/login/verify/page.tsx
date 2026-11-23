import { VerifyCodeForm } from "./verify-form";

export const dynamic = "force-dynamic";

/**
 * The second step of sign-in for an account with two-step sign-in on. The
 * password was accepted on the previous page; this asks for the six-digit code
 * and only then is there a session.
 */
export default function VerifyCodePage() {
  return (
    <main className="theme-blackgold flex min-h-dvh items-center justify-center bg-[#0a0a0a] px-4 py-12">
      <div className="w-full max-w-md space-y-4">
        <div>
          <h1 className="text-xl font-black text-white">Enter your code</h1>
          <p className="mt-1 text-sm text-white/60">Open your authenticator app for the six-digit code.</p>
        </div>
        <VerifyCodeForm />
        <p className="text-center text-xs text-white/40">Lost your phone and your backup codes? Ask an administrator to turn two-step sign-in off for you.</p>
      </div>
    </main>
  );
}
