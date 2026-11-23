import { PageNotFoundState } from "@/components/page-state";

export default function SaleNotFound() {
  return (
    <PageNotFoundState
      title="Sale not found"
      description="This sale was removed, or you don't have access."
      primaryHref="/pos"
      primaryLabel="Go to point of sale"
    />
  );
}
