"use server";

import { redirect } from "next/navigation";

import { logoutPortal } from "@/lib/portal-auth";

export async function portalLogoutAction() {
  await logoutPortal();
  redirect("/portal/login");
}
