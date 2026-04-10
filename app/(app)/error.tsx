"use client";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-black bg-black p-4 text-sm text-white">
      Something went wrong while loading this page: {error.message}
      <button onClick={reset} className="ml-3 rounded border border-white px-2 py-1">
        Retry
      </button>
    </div>
  );
}
