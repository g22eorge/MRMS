/**
 * Shared test helpers for unit tests.
 *
 * DATABASE_URL must point to a Postgres database with the schema applied
 * (`bun run test:setup` does this against the scratch container).
 * Run `bun run test:setup` on a new machine before `bun run test:unit`.
 */

import { prisma, type Db } from "@/lib/prisma";

/**
 * Tests run against the *application's* client, extensions included.
 *
 * They used to construct a bare `new PrismaClient()`, which meant the suite
 * exercised a different client than production. That hid a whole class of
 * behaviour: with money stored as `numeric`, an unextended client returns
 * `Decimal` objects, so `expect(a).toBe(b)` compared two distinct Decimal
 * instances and failed with the memorable message "Expected: 38, Received: 38".
 */
export type { Db };
/** @deprecated Use `Db`. Kept so existing test signatures keep compiling. */
export type PrismaClient = Db;

export function getTestPrisma(): Db {
  return prisma;
}

export async function setupTestDb(): Promise<Db> {
  await prisma.$connect();
  return prisma;
}

export async function teardownTestDb(): Promise<void> {
  await prisma.$disconnect();
}

export async function createOrg(db: PrismaClient, slug: string) {
  return db.organization.create({
    data: {
      name: `Org ${slug}`,
      slug: `${slug}-${Math.random().toString(36).slice(2)}`,
    },
  });
}

export async function createUser(
  db: PrismaClient,
  orgId: string,
  opts: { role?: string; email?: string; isActive?: boolean } = {},
) {
  return db.user.create({
    data: {
      name: "Test User",
      email: opts.email ?? `user-${Math.random().toString(36).slice(2)}@test.local`,
      orgId,
      role: (opts.role ?? "OPS") as never,
      ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
    } as never,
  });
}

export async function createPart(
  db: PrismaClient,
  orgId: string,
  opts: { sku?: string; qty?: number } = {},
) {
  return db.part.create({
    data: {
      sku: opts.sku ?? `SKU-${Math.random().toString(36).slice(2)}`,
      name: "Test Part",
      qtyOnHand: opts.qty ?? 0,
      orgId,
    } as never,
  });
}

export async function createLocation(db: PrismaClient, orgId: string, name = "Main Store") {
  return db.stockLocation.create({
    data: {
      orgId,
      name,
      code: `LOC-${Math.random().toString(36).slice(2)}`,
    } as never,
  });
}

export async function seedLocationStock(
  db: PrismaClient,
  orgId: string,
  partId: string,
  locationId: string,
  qtyOnHand: number,
  qtyReserved = 0,
) {
  return db.partLocationStock.upsert({
    where: { partId_locationId: { partId, locationId } },
    create: { orgId, partId, locationId, qtyOnHand, qtyReserved },
    update: { qtyOnHand, qtyReserved },
  } as never);
}

export async function createTestJob(
  db: PrismaClient,
  orgId: string,
  userId: string,
): Promise<{ id: string } | null> {
  try {
    const client = await db.client.create({
      data: {
        fullName: `Client-${Date.now()}`,
        phone: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
        orgId,
      } as never,
    });
    const job = await db.job.create({
      data: {
        orgId,
        jobNumber: `TEST-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        status: "RECEIVED",
        clientId: client.id,
        createdById: userId,
        deviceType: "PHONE_ANDROID",
        brand: "Test",
        model: "Device",
        issueDescription: "Test issue",
      } as never,
    });
    return job as { id: string };
  } catch {
    return null;
  }
}
