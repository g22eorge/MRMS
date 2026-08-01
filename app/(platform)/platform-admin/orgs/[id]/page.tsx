import { redirect } from "next/navigation";

import { PLATFORM_ROUTES } from "@/lib/platform/routes";

export default async function PlatformAdminOrgRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(PLATFORM_ROUTES.org(id));
}
