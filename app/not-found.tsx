import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <h1 className="text-2xl font-semibold">404</h1>
        <p className="mt-1 text-sm text-slate-600">The requested resource was not found.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-teal-700 hover:underline">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
