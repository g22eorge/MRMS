import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { checkIsPlatformAdmin } from "@/lib/platform-admin";

/**
 * Look at a customer's workspace as the platform admin, to answer "what are
 * they actually seeing?" without asking them for a screenshot.
 *
 * Four properties, and each exists because the obvious version of this feature
 * is a privilege-escalation vector:
 *
 *   Read-only.  The impersonated session is forced to accessMode READ_ONLY,
 *               which is not a new rule — assertOrgCanMutate already enforces
 *               it at 65 call sites. Nothing here has to remember to check;
 *               a write throws the same way it would for any read-only user.
 *
 *   Signed.     The cookie carries the target orgId, so an unsigned one would
 *               let ANY signed-in user read ANY organisation by editing it.
 *               HMAC over the payload with BETTER_AUTH_SECRET, compared in
 *               constant time.
 *
 *   Re-checked. A valid signature is not sufficient. Every read re-verifies
 *               that the current user is still a platform admin, so revoking
 *               someone's admin access ends their impersonation on the next
 *               request rather than whenever the cookie expires.
 *
 *   Time-boxed. Thirty minutes, enforced from a timestamp inside the signed
 *               payload rather than from cookie expiry alone — a cookie's
 *               maxAge is a request to the browser, not a guarantee.
 *
 * Entry and exit are both audited. An impersonation nobody can date is the
 * thing that makes this feature a liability rather than a tool.
 */

const COOKIE = "platform_impersonation";
const MAX_AGE_MS = 30 * 60 * 1000;

type Payload = { orgId: string; startedAt: number };

function secret(): string | null {
  return process.env.BETTER_AUTH_SECRET?.trim() || null;
}

function sign(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("base64url");
}

/** Constant-time compare; a length mismatch is a mismatch, not a throw. */
function signatureMatches(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function encodeImpersonation(payload: Payload, key: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, key)}`;
}

export function decodeImpersonation(raw: string, key: string): Payload | null {
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!signatureMatches(sign(body, key), sig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
    if (typeof parsed?.orgId !== "string" || !parsed.orgId) return null;
    if (typeof parsed?.startedAt !== "number") return null;
    if (Date.now() - parsed.startedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * The org being impersonated, or null.
 *
 * Takes the current user's email rather than fetching it, because the only
 * caller already has the session and re-fetching invites a loop:
 * requireOrgSession → this → getCurrentUserRole → requireOrgSession.
 */
export async function readImpersonation(currentUserEmail: string | null | undefined) {
  const key = secret();
  if (!key) return null;
  // A signature alone is not authority. If this user is no longer a platform
  // admin, the cookie means nothing from this request onward.
  if (!currentUserEmail || !checkIsPlatformAdmin(currentUserEmail)) return null;

  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  return decodeImpersonation(raw, key);
}

/** Sets the cookie. The caller is responsible for having checked admin first. */
export async function setImpersonationCookie(orgId: string) {
  const key = secret();
  if (!key) throw new Error("BETTER_AUTH_SECRET is required to impersonate.");
  const value = encodeImpersonation({ orgId, startedAt: Date.now() }, key);
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_MS / 1000,
  });
}

export async function clearImpersonationCookie() {
  (await cookies()).delete(COOKIE);
}

export const IMPERSONATION_MAX_AGE_MS = MAX_AGE_MS;
