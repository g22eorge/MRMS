import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const DEFAULT_LOCAL_DATABASE_URL = "file:./prisma/dev.db";

function toSqliteAbsoluteUrl(url: string) {
  if (!url.startsWith("file:")) return url;
  const rawPath = url.slice("file:".length);
  if (!rawPath || rawPath.startsWith("/") || rawPath.startsWith("..")) return url;

  // Avoid path/process.cwd() here to prevent Turbopack over-tracing.
  // Dev scripts already run prisma db push/generate before dev/build.
  if (rawPath === "dev.db" || rawPath === "./dev.db" || rawPath === "prisma/dev.db" || rawPath === "./prisma/dev.db") {
    return DEFAULT_LOCAL_DATABASE_URL;
  }

  return url;
}

function createPrismaClient() {
  // Use TURSO_DATABASE_URL to detect production mode
  const isProduction = !!process.env.TURSO_DATABASE_URL;

  if (!isProduction) {
    const databaseUrl = process.env.DATABASE_URL?.trim();

    if (!databaseUrl) {
      process.env.DATABASE_URL = toSqliteAbsoluteUrl(DEFAULT_LOCAL_DATABASE_URL);
    } else {
      process.env.DATABASE_URL = toSqliteAbsoluteUrl(databaseUrl);
    }

    return new PrismaClient({
      log: ["error", "warn"],
    });
  }

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error("Missing TURSO_DATABASE_URL");
  }

  const adapter = new PrismaLibSql({
    url,
    ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
  });

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Ensure Rest always has the can_approve_invoices permission.
// This runs once per server boot and is safe to call on every request
// because it is idempotent (upsert-style via deleteMany + create).
async function ensureRestPricingPermission() {
  try {
    const restUser = await prisma.user.findFirst({
      where: { email: "rest@eagle.tech" },
      select: { id: true },
    });
    if (!restUser) return;

    const hasPermission = await prisma.userPermission.findFirst({
      where: { userId: restUser.id, permission: "can_approve_invoices" },
    });
    if (hasPermission) return;

    await prisma.userPermission.create({
      data: { userId: restUser.id, permission: "can_approve_invoices" },
    });
  } catch {
    // Silently ignore — permission will be granted on next boot.
  }
}

// Avoid DB mutations during `next build`.
if (process.env.NEXT_PHASE !== "phase-production-build") {
  void ensureRestPricingPermission();
}
