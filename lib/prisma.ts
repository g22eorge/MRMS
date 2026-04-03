import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const prod = process.env.PROD === "true";

  if (!prod) {
    return new PrismaClient({
      log: ["error", "warn"],
    });
  }

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error("Missing TURSO_DATABASE_URL while PROD=true");
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
