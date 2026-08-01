import "server-only";

import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { hashPassword, verifyPassword, makeSignature } from "better-auth/crypto";

import { prisma } from "@/lib/prisma";

/**
 * Corporate Client Portal authentication — deliberately SEPARATE from the staff
 * BetterAuth surface. Portal users are customers; they get their own signed
 * session cookie, their own session table, and never touch the staff `User`,
 * `Session`, `Account`, or `can.*` permission machinery. Every lookup here is
 * scoped by the portal user's own org + client, so a portal login can only ever
 * reach its own corporate account's data.
 */

const COOKIE = "portal-session";
const TTL_MS = 8 * 60 * 60 * 1000; // 8h

function secret() {
  return process.env.BETTER_AUTH_SECRET || "portal-dev-secret-change-me";
}

/** URL-safe HMAC so the cookie value never carries `/`, `+`, or `=`. */
async function sign(token: string) {
  const sig = await makeSignature(token, secret());
  return sig.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashPortalPassword(password: string) {
  return hashPassword(password);
}

const PORTAL_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  orgId: true,
  clientId: true,
  client: { select: { id: true, fullName: true, organization: true, email: true, phone: true } },
  org: { select: { id: true, name: true, slug: true, baseCurrency: true } },
} as const;

export type PortalContext = {
  portalUser: { id: string; name: string; email: string; role: string; orgId: string; clientId: string };
  client: { id: string; fullName: string; organization: string | null; email: string | null; phone: string };
  org: { id: string; name: string; slug: string; baseCurrency: string };
};

/** Verify credentials and, on success, establish a portal session. */
export async function loginPortalUser(email: string, password: string): Promise<{ ok: boolean }> {
  const candidates = await prisma.portalUser.findMany({
    where: { email: email.trim().toLowerCase(), isActive: true },
    select: { id: true, passwordHash: true },
  });
  for (const c of candidates) {
    if (!c.passwordHash) continue;
    const ok = await verifyPassword({ hash: c.passwordHash, password });
    if (ok) {
      await createPortalSession(c.id);
      return { ok: true };
    }
  }
  return { ok: false };
}

export async function createPortalSession(portalUserId: string) {
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await prisma.portalSession.create({ data: { token, portalUserId, expiresAt } });
  await prisma.portalUser.update({ where: { id: portalUserId }, data: { lastLoginAt: new Date() } });

  const store = await cookies();
  store.set(COOKIE, `${token}.${await sign(token)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Resolve the current portal session, or null. Validates the cookie signature + expiry. */
export async function getPortalSession(): Promise<PortalContext | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;

  const idx = raw.lastIndexOf(".");
  if (idx < 0) return null;
  const token = raw.slice(0, idx);
  const providedSig = raw.slice(idx + 1);
  if (!token || providedSig !== (await sign(token))) return null;

  const session = await prisma.portalSession.findUnique({
    where: { token },
    select: { expiresAt: true, portalUser: { select: PORTAL_USER_SELECT } },
  });
  if (!session || session.expiresAt < new Date()) return null;

  const pu = session.portalUser;
  if (!pu || !pu.isActive) return null;

  return {
    portalUser: { id: pu.id, name: pu.name, email: pu.email, role: pu.role, orgId: pu.orgId, clientId: pu.clientId },
    client: pu.client,
    org: pu.org,
  };
}

/** Require a portal session or redirect to the portal login. */
export async function requirePortalSession(): Promise<PortalContext> {
  const ctx = await getPortalSession();
  if (!ctx) redirect("/portal/login");
  return ctx;
}

export async function logoutPortal() {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (raw) {
    const idx = raw.lastIndexOf(".");
    const token = idx >= 0 ? raw.slice(0, idx) : raw;
    await prisma.portalSession.deleteMany({ where: { token } }).catch(() => {});
  }
  store.delete(COOKIE);
}
