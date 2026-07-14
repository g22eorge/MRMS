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
