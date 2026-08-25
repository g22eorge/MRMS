"use server";

import { redirect } from "next/navigation";

import {
  changePortalPassword,
  logoutPortal,
  requirePortalSessionAllowingPasswordChange,
  setActivePortalClient,
} from "@/lib/portal-auth";

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

/**
 * Replace the password an admin handed out.
 *
 * Requires the current password even when the change is forced: the customer
 * was given it, and proving they hold it stops anyone who merely reached an
 * open session from taking the account over. Every other session for this login
 * is dropped afterwards, which is the point of changing a password at all.
 */
export async function changePortalPasswordAction(formData: FormData) {
  const ctx = await requirePortalSessionAllowingPasswordChange();

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const fail = (message: string) => redirect(`/portal/change-password?error=${encodeURIComponent(message)}`);

  if (!current || !next || !confirm) fail("Fill in every field.");
  if (next.length < 8) fail("Your new password needs to be at least 8 characters.");
  if (next !== confirm) fail("The two new passwords don't match.");
  if (next === current) fail("Choose a password different from the one you were given.");

  const changed = await changePortalPassword({ portalUserId: ctx.portalUser.id, currentPassword: current, newPassword: next });
  if (!changed) fail("That current password isn't right.");

  redirect("/portal/dashboard");
}
