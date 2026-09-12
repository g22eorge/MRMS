import { PageNotFoundState } from "@/components/page-state";

export default function PartNotFound() {
  return (
    <PageNotFoundState
      title="Part not found"
      description="This inventory item may have been removed, or you may not have access to it."
      primaryHref="/inventory"
      primaryLabel="Go to inventory"
    />
  );
}
