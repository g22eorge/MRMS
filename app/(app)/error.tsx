"use client";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      Something went wrong while loading this page: {error.message}
      <button onClick={reset} className="ml-3 rounded border border-rose-300 px-2 py-1">
        Retry
      </button>
    </div>
  );
}
