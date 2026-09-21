// The whole segment reads the live session (requireOrgSession here and in nested
// layouts), so no page beneath it may be prerendered at build time — the build
// crashes on it. Covers every page in this segment in one place.
export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { DocumentsShell } from "@/components/documents/DocumentsShell";
import { canAccessDocumentsHub, documentsNavForRole } from "@/lib/documents/routes";
import { requireOrgSession } from "@/lib/org-context";

export default async function DocumentsLayout({ children }: { children: ReactNode }) {
  const { user } = await requireOrgSession();
  if (!canAccessDocumentsHub(user.role)) {
    redirect("/dashboard");
  }

  const items = documentsNavForRole(user.role);

  return <DocumentsShell items={items}>{children}</DocumentsShell>;
}
