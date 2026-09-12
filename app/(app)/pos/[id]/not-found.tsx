import { PageNotFoundState } from "@/components/page-state";

export default function SaleNotFound() {
  return (
    <PageNotFoundState
      title="Sale not found"
      description="This sale may have been removed, or you may not have access to it."
      primaryHref="/pos"
      primaryLabel="Go to point of sale"
    />
  );
}
