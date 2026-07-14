import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { CommunicationsShell } from "@/components/communications/CommunicationsShell";
import { communicationsNavForRole, canAccessCommunications } from "@/lib/communications/routes";
import { requireOrgSession } from "@/lib/org-context";

export default async function CommunicationsLayout({ children }: { children: ReactNode }) {
  const { user } = await requireOrgSession();
  if (!canAccessCommunications(user.role)) {
    redirect("/dashboard");
  }

  const items = communicationsNavForRole(user.role);

  return <CommunicationsShell items={items}>{children}</CommunicationsShell>;
}
