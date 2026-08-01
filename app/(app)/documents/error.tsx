"use client";

import { PageErrorState } from "@/components/page-state";

export default function DocumentsError({ error, reset }: { error: Error; reset: () => void }) {
  const digest = (error as Error & { digest?: string }).digest;

  return (
    <PageErrorState
      eyebrow="Documents Error"
      title="Could not load this documents page"
      digest={digest}
      onRetry={reset}
    />
  );
}
