import { PageNotFoundState } from "@/components/page-state";

export default function ClientNotFound() {
  return (
    <PageNotFoundState
      title="Client not found"
      description="This client may have been removed or you may not have access to their record."
      primaryHref="/clients"
      primaryLabel="Go to clients"
    />
  );
}
