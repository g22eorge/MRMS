"use server";

import { redirect } from "next/navigation";

import { loginPortalUser } from "@/lib/portal-auth";

export type PortalLoginState = { error?: string };

export async function portalLoginAction(_state: PortalLoginState, formData: FormData): Promise<PortalLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password" };

  const { ok } = await loginPortalUser(email, password);
  if (!ok) return { error: "Invalid email or password" };

  redirect("/portal/dashboard");
}
