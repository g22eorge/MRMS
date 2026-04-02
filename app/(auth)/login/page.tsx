import { redirect } from "next/navigation";

import { LoginForm } from "@/app/(auth)/login/login-form";
import { getSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">Eagle Repair Manager</h1>
        <p className="mb-6 text-sm text-slate-600">
          Sign in to continue to your workspace.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
