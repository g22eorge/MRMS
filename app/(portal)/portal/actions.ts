"use server";

import { redirect } from "next/navigation";

import { logoutPortal, setActivePortalClient } from "@/lib/portal-auth";

export async function portalLogoutAction() {
  await logoutPortal();
  redirect("/portal/login");
}

/** Account switcher: change which client account the portal login acts for. */
export async function switchPortalClientAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "").trim();
  if (clientId) await setActivePortalClient(clientId);
  redirect("/portal/dashboard");
}
