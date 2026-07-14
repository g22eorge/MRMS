import { PageNotFoundState } from "@/components/page-state";

export default function JobNotFound() {
  return (
    <PageNotFoundState
      title="Job not found"
      description="This repair job may have been removed, reassigned, or you may not have access to it."
      primaryHref="/jobs"
      primaryLabel="Go to jobs"
    />
  );
}
