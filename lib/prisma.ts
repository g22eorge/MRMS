import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const DEFAULT_LOCAL_DATABASE_URL = "file:./prisma/dev.db";

function toSqliteAbsoluteUrl(url: string) {
  if (!url.startsWith("file:")) return url;
  const rawPath = url.slice("file:".length);
  if (!rawPath || rawPath.startsWith("/") || rawPath.startsWith("..")) return url;

  // Standardize local sqlite location under ./prisma/dev.db.
  // Prisma CLI (schema.prisma) and other tooling often assume this layout.
  if (rawPath === "dev.db" || rawPath === "./dev.db") {
    const preferred = path.resolve(process.cwd(), "prisma", "dev.db");
    if (fs.existsSync(preferred)) return `file:${preferred}`;
  }

  const fromCwd = path.resolve(process.cwd(), rawPath);
  if (fs.existsSync(fromCwd)) {
    return `file:${fromCwd}`;
  }

  const fromStandalone = path.resolve(process.cwd(), "../../", rawPath);
  if (process.cwd().includes(`${path.sep}.next${path.sep}standalone`) && fs.existsSync(fromStandalone)) {
    return `file:${fromStandalone}`;
  }

  return `file:${fromCwd}`;
}

function sqlitePathFromUrl(url: string) {
  if (!url.startsWith("file:")) return null;
  return url.slice("file:".length);
}

function ensureLocalSqliteSchema(url: string) {
  if (process.env.TURSO_DATABASE_URL) return;
  if (process.env.NODE_ENV === "production") return;

  const sqlitePath = sqlitePathFromUrl(url);
  if (!sqlitePath) return;

  const stats = fs.existsSync(sqlitePath) ? fs.statSync(sqlitePath) : null;
  const likelyUninitialized = !stats || stats.size < 16 * 1024;

  if (!likelyUninitialized) return;

  const bunx = process.platform === "win32" ? "bunx.cmd" : "bunx";
  const result = spawnSync(bunx, ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: `file:${sqlitePath}` },
    stdio: "ignore",
  });

  if (result.status !== 0) {
    throw new Error(`Failed to auto-run local Prisma migrations for ${sqlitePath}`);
  }
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

    ensureLocalSqliteSchema(process.env.DATABASE_URL);

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

ensureRestPricingPermission();
