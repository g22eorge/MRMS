import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const prod = process.env.PROD === "true";

  const url = prod
    ? process.env.TURSO_DATABASE_URL
    : process.env.DATABASE_URL ?? "file:./dev.db";
  const authToken = prod ? process.env.TURSO_AUTH_TOKEN : undefined;

  if (!url) {
    throw new Error(
      prod
        ? "Missing TURSO_DATABASE_URL while PROD=true"
        : "Missing DATABASE_URL while PROD is not true",
    );
  }

  const adapter = new PrismaLibSql({
    url,
    ...(authToken ? { authToken } : {}),
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
