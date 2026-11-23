import { PageNotFoundState } from "@/components/page-state";

export default function JobNotFound() {
  return (
    <PageNotFoundState
      title="Job not found"
      description="This job was removed or reassigned, or you don't have access."
      primaryHref="/jobs"
      primaryLabel="Go to jobs"
    />
  );
}
