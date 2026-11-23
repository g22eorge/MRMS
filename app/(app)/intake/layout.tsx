// Module gate for everything under this segment. The menus hide a module the
// business has not chosen; this stops the address being typed instead.
export const dynamic = "force-dynamic";

import type { ReactNode } from "react";

import { OrgModule, requireModule } from "@/lib/module-access";

export default async function ModuleGateLayout({ children }: { children: ReactNode }) {
  await requireModule(OrgModule.JOBS);
  return <>{children}</>;
}
