import { createHash, randomUUID } from "node:crypto";

/**
 * The server's own error log.
 *
 * Until this existed a failing page was found out from a customer. Every
 * uncaught server error now lands in ErrorEvent, grouped: one row per distinct
 * error per hour with a count, so a page failing on every request is one line
 * that says how often, not a flood.
 *
 * Deliberately small. No third-party service, nothing leaves the server, and
 * recording must never be able to break the request that failed — every path
 * out of here swallows its own errors.
 */
export type ErrorContext = {
  route?: string | null;
  path?: string | null;
  method?: string | null;
  kind?: string | null;
  digest?: string | null;
};

const MAX_MESSAGE = 500;
const MAX_STACK = 4000;

/** Drop the query string: it can carry search terms, emails and tokens. */
export function pathOnly(path: string | null | undefined): string | null {
  if (!path) return null;
  const cut = path.split("?")[0].split("#")[0];
  return cut.slice(0, 300) || null;
}

/** The same failure in the same place hashes the same, whatever ids it mentions. */
export function fingerprintOf(message: string, route: string | null | undefined): string {
  const normalised = message
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>")
    .replace(/\bc[a-z0-9]{20,}\b/g, "<id>")
    .replace(/\d+/g, "<n>")
    .slice(0, 300);
  return createHash("sha256").update(`${route ?? ""}|${normalised}`).digest("hex").slice(0, 32);
}

export function hourBucket(at: Date): Date {
  const bucket = new Date(at);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket;
}

export async function recordErrorEvent(error: unknown, context: ErrorContext = {}, at: Date = new Date()): Promise<void> {
  try {
    const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
    const message = (err.message || err.name || "Unknown error").slice(0, MAX_MESSAGE);
    const stack = err.stack ? err.stack.slice(0, MAX_STACK) : null;
    const route = context.route ? String(context.route).slice(0, 300) : null;
    const { prisma } = await import("@/lib/prisma");
    await prisma.$executeRaw`
      INSERT INTO "ErrorEvent" ("id", "fingerprint", "bucket", "message", "stack", "route", "path", "method", "kind", "digest", "count", "firstSeenAt", "lastSeenAt")
      VALUES (${randomUUID()}, ${fingerprintOf(message, route)}, ${hourBucket(at)}, ${message}, ${stack}, ${route},
              ${pathOnly(context.path)}, ${context.method ?? null}, ${context.kind ?? null}, ${context.digest ?? null}, 1, ${at}, ${at})
      ON CONFLICT ("fingerprint", "bucket")
      DO UPDATE SET "count" = "ErrorEvent"."count" + 1, "lastSeenAt" = EXCLUDED."lastSeenAt"
    `;
  } catch {
    // Recording an error must never raise a second one.
  }
}

/** Keeps the table bounded; called from the weekly prune job. */
export async function pruneErrorEvents(olderThanDays = 30): Promise<number> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
    const result = await prisma.errorEvent.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });
    return result.count;
  } catch {
    return 0;
  }
}
