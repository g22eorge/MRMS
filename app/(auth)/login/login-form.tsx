"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    setIsPending(true);
    const response = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/dashboard",
    });
    setIsPending(false);

    if (response.error) {
      toast.error(response.error.message || "Invalid credentials");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
        />
      </div>
      <button
        disabled={isPending}
        type="submit"
        className="w-full rounded-md bg-teal-700 px-3 py-2 text-white disabled:opacity-60"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
