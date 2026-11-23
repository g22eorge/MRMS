import { PageNotFoundState } from "@/components/page-state";

export default function PartNotFound() {
  return (
    <PageNotFoundState
      title="Part not found"
      description="This item was removed, or you don't have access."
      primaryHref="/inventory"
      primaryLabel="Go to inventory"
    />
  );
}
