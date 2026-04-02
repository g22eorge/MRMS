"use client";

export default function AuthError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        Auth error: {error.message}
        <button onClick={reset} className="ml-3 rounded border border-rose-300 px-2 py-1">
          Retry
        </button>
      </div>
    </main>
  );
}
