/**
 * Mint a local development session without a password.
 *
 * Exists so the running application can be driven — navigation, buttons,
 * workflows, responsive checks — without anyone typing credentials into a
 * login form. That was the one thing standing between the audit and its
 * nine interactive sections.
 *
 * Refuses to run against anything but a local SQLite file. A session minted
 * without authentication is exactly what must never be possible in production,
 * so the guard is the first thing here and it fails closed.
 *
 *   node scripts/dev-session.mjs admin@techfix.ug
 *
 * Prints the cookie to set. The session is a normal row with a normal expiry
 * and can be revoked by deleting it, like any other.
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL ?? "";
if (!url.startsWith("file:")) {
  console.error("[dev-session] refusing to run: DATABASE_URL is not a local file: URL.");
  console.error("[dev-session] this mints a session without a password and must never touch a real database.");
  process.exit(1);
}
if (process.env.TURSO_DATABASE_URL) {
  console.error("[dev-session] refusing to run: TURSO_DATABASE_URL is set.");
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error("usage: node scripts/dev-session.mjs <email>");
  process.exit(1);
}

/** BetterAuth signs the session cookie as `<token>.<base64url hmac>`. */
function readSecret() {
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
  try {
    const env = readFileSync(".env", "utf8");
    const line = env.split("\n").find((l) => l.startsWith("BETTER_AUTH_SECRET="));
    if (line) return line.slice("BETTER_AUTH_SECRET=".length).trim().replace(/^["']|["']$/g, "");
  } catch { /* fall through */ }
  return null;
}

const prisma = new PrismaClient();
try {
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true, name: true, role: true, orgId: true, isActive: true },
  });
  if (!user) {
    console.error(`[dev-session] no user with email ${email} in this local database.`);
    process.exit(1);
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { token, userId: user.id, expiresAt, ipAddress: "127.0.0.1", userAgent: "dev-session" },
  });

  // Exactly what better-call's signCookieValue does: HMAC-SHA256 over the raw
  // token, standard base64 (not base64url), joined with a dot, then the whole
  // value URI-encoded. Guessing at this cost a round of debugging — the
  // encoding is the part that differs from what one would assume.
  const secret = readSecret();
  if (!secret) {
    console.error("[dev-session] BETTER_AUTH_SECRET not found; the cookie must be signed and cannot be.");
    process.exit(1);
  }
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  const signed = encodeURIComponent(`${token}.${signature}`);

  console.log(`user     ${user.name ?? user.email}  (${user.role}${user.orgId ? `, org ${user.orgId}` : ""})`);
  console.log(`expires  ${expiresAt.toISOString()}`);
  console.log(`signed   HMAC-SHA256, base64, URI-encoded`);
  console.log("");
  console.log("Set this cookie on http://localhost:3000 :");
  console.log(`  better-auth.session_token=${signed}`);
  console.log("");
  console.log("Revoke with:");
  console.log(`  DELETE FROM Session WHERE token = '${token}';`);
} finally {
  await prisma.$disconnect();
}
