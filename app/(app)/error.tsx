"use client";

import { PageErrorState } from "@/components/page-state";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  const digest = (error as Error & { digest?: string }).digest;

  return <PageErrorState digest={digest} onRetry={reset} />;
}
