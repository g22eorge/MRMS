import { PageNotFoundState } from "@/components/page-state";

export default function ClientNotFound() {
  return (
    <PageNotFoundState
      title="Client not found"
      description="This client was removed, or you don't have access."
      primaryHref="/clients"
      primaryLabel="Go to clients"
    />
  );
}
