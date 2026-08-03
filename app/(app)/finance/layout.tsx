import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { FinanceShell } from "@/components/finance/FinanceShell";
import { canAccessFinanceHub, financeNavForRole } from "@/lib/finance/routes";
import { requireOrgSession } from "@/lib/org-context";

export default async function FinanceLayout({ children }: { children: ReactNode }) {
  const { user } = await requireOrgSession();
  if (!canAccessFinanceHub(user.role)) {
    redirect("/dashboard");
  }

  const items = financeNavForRole(user.role);

  return <FinanceShell items={items}>{children}</FinanceShell>;
}
