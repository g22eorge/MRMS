import "server-only";

import { cookies } from "next/headers";
import { randomBytes, timingSafeEqual } from "crypto";
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
const ACTIVE_CLIENT_COOKIE = "portal-active-client";
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

const CLIENT_ACCOUNT_SELECT = { id: true, fullName: true, organization: true, email: true, phone: true } as const;

const PORTAL_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  orgId: true,
  clientId: true,
  client: { select: CLIENT_ACCOUNT_SELECT },
  // Additional accounts this login may act for (e.g. C-Care IHK + IMC).
  linkedClients: { select: { client: { select: CLIENT_ACCOUNT_SELECT } } },
  org: { select: { id: true, name: true, slug: true, baseCurrency: true } },
} as const;

export type PortalClientAccount = { id: string; fullName: string; organization: string | null; email: string | null; phone: string };

export type PortalContext = {
  portalUser: { id: string; name: string; email: string; role: string; orgId: string; clientId: string };
  /** The account the login is currently acting for (from the account switcher). */
  client: PortalClientAccount;
  /** Every account this login can switch between (primary + linked), deduped. */
  accessibleClients: PortalClientAccount[];
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
  if (!token) return null;
  // Constant-time signature check (avoid a timing side-channel on the session).
  const provided = Buffer.from(providedSig);
  const expected = Buffer.from(await sign(token));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  const session = await prisma.portalSession.findUnique({
    where: { token },
    select: { expiresAt: true, portalUser: { select: PORTAL_USER_SELECT } },
  });
  if (!session || session.expiresAt < new Date()) return null;

  const pu = session.portalUser;
  if (!pu || !pu.isActive) return null;

  // Accessible accounts = primary client + any linked clients, deduped by id.
  const accessibleClients: PortalClientAccount[] = [];
  const seen = new Set<string>();
  for (const c of [pu.client, ...pu.linkedClients.map((l) => l.client)]) {
    if (c && !seen.has(c.id)) { seen.add(c.id); accessibleClients.push(c); }
  }

  // Active account comes from the switcher cookie, constrained to the set;
  // otherwise the primary client.
  const requested = store.get(ACTIVE_CLIENT_COOKIE)?.value;
  const active = (requested && accessibleClients.find((c) => c.id === requested)) || pu.client;

  return {
    portalUser: { id: pu.id, name: pu.name, email: pu.email, role: pu.role, orgId: pu.orgId, clientId: pu.clientId },
    client: active,
    accessibleClients,
    org: pu.org,
  };
}

/**
 * Switch which account the portal login is acting for. Validates the target is
 * one of the login's accessible accounts before persisting the choice.
 */
export async function setActivePortalClient(clientId: string): Promise<boolean> {
  const ctx = await getPortalSession();
  if (!ctx) return false;
  if (!ctx.accessibleClients.some((c) => c.id === clientId)) return false;
  const store = await cookies();
  store.set(ACTIVE_CLIENT_COOKIE, clientId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return true;
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
  store.delete(ACTIVE_CLIENT_COOKIE);
}
