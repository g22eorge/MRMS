import { redirect } from "next/navigation";

// Legacy duplicate of /platform/orgs/[id]. Redirect until the parallel
// platform trees are consolidated (system-analysis.md, Phase 3.5).
export default async function PlatformAdminOrgRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/platform/orgs/${id}`);
}
