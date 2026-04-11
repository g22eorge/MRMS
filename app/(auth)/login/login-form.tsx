"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    setIsPending(true);
    try {
      const response = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/dashboard",
      });

      if (response.error) {
        toast.error(response.error.message || "Invalid credentials");
        return;
      }

      router.replace("/dashboard");
    } catch {
      toast.error("Sign in failed. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="email">
          Email or Username
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
          placeholder="you@eagleinfo.com"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 pr-24 outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-[var(--ink-muted)] hover:bg-[var(--panel)]"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-[var(--ink-muted)]">
          <input type="checkbox" name="rememberMe" className="h-4 w-4 rounded border border-[var(--line)] text-[#D4AF37]" />
          Remember me
        </label>
        <a href="mailto:support@eagleinfo.com" className="text-[#D4AF37] hover:underline">
          Forgot password?
        </a>
      </div>

      <button
        disabled={isPending}
        type="submit"
        className="btn-premium w-full rounded-md px-3 py-2 text-white disabled:opacity-60"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-center text-xs text-[var(--ink-muted)]">
        Need help accessing your account? Contact system support.
      </p>
    </form>
  );
}
