"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { loginPortalUser } from "@/lib/portal-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export type PortalLoginState = { error?: string };

export async function portalLoginAction(_state: PortalLoginState, formData: FormData): Promise<PortalLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password" };

  // Throttle before the (bcrypt-per-candidate) verification — the portal is a
  // separate auth surface, so it needs its own limit against credential stuffing.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit(`portal-login:${ip}:${email.toLowerCase()}`, { limit: 8, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) return { error: "Too many login attempts. Please wait a few minutes and try again." };

  const { ok } = await loginPortalUser(email, password);
  if (!ok) return { error: "Invalid email or password" };

  redirect("/portal/dashboard");
}
