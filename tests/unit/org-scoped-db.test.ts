import { describe, expect, it, beforeAll, afterAll } from "bun:test";

import { scopedDb } from "@/lib/db";
import { createOrg, setupTestDb, teardownTestDb, type PrismaClient } from "./helpers";

let db: PrismaClient;
let orgAId: string;
let orgBId: string;
let clientAId: string;
let clientBId: string;

beforeAll(async () => {
  db = await setupTestDb();
  const orgA = await createOrg(db, "scope-a");
  const orgB = await createOrg(db, "scope-b");
  orgAId = orgA.id;
  orgBId = orgB.id;

  const [clientA, clientB] = await Promise.all([
    db.client.create({
      data: {
        orgId: orgAId,
        fullName: "Scoped Client A",
        phone: `+256700${Math.random().toString().slice(2, 8)}`,
      },
    }),
    db.client.create({
      data: {
        orgId: orgBId,
        fullName: "Scoped Client B",
        phone: `+256701${Math.random().toString().slice(2, 8)}`,
      },
    }),
  ]);
  clientAId = clientA.id;
  clientBId = clientB.id;
});

afterAll(teardownTestDb);

describe("scopedDb() tenant isolation", () => {
  it("findMany returns only the active org", async () => {
    const rows = await scopedDb(orgAId).client.findMany({ select: { id: true } });
    expect(rows.some((row) => row.id === clientAId)).toBe(true);
    expect(rows.some((row) => row.id === clientBId)).toBe(false);
  });

  it("findUnique hides records from another org", async () => {
    const crossOrg = await scopedDb(orgAId).client.findUnique({ where: { id: clientBId } });
    expect(crossOrg).toBeNull();
  });

  it("create injects orgId automatically", async () => {
    const created = await scopedDb(orgAId).client.create({
      data: {
        fullName: "Auto Org Client",
        phone: `+256702${Math.random().toString().slice(2, 8)}`,
      },
    });
    expect(created.orgId).toBe(orgAId);
    await db.client.delete({ where: { id: created.id } });
  });

  it("orgDb alias matches scopedDb behavior", async () => {
    const { orgDb } = await import("@/lib/db");
    const rows = await orgDb(orgBId).client.findMany({ where: { id: clientBId }, select: { id: true } });
    expect(rows).toHaveLength(1);
  });
});
