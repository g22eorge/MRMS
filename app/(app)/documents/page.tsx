export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { defaultDocumentsRouteForRole } from "@/lib/documents/routes";
import { requireOrgSession } from "@/lib/org-context";

export default async function DocumentsHubPage() {
  const { user } = await requireOrgSession();
  redirect(defaultDocumentsRouteForRole(user.role));
}
