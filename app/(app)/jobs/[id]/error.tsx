"use client";

import { PageErrorState } from "@/components/page-state";

export default function JobDetailError({ error, reset }: { error: Error; reset: () => void }) {
  const digest = (error as Error & { digest?: string }).digest;

  return (
    <PageErrorState
      eyebrow="Job Error"
      title="Could not load this job"
      digest={digest}
      onRetry={reset}
      backHref="/jobs"
      backLabel="Back to jobs"
    />
  );
}
