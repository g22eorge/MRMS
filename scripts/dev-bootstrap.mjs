/**
 * Makes a fresh development database usable, and does nothing to one that
 * already is.
 *
 * Runs inside the app container on every start, after `prisma migrate deploy`.
 * Migrations give you the schema; they do not give you a row to log in with, so
 * before this existed a new checkout came up on an empty database with no
 * account, and the first thing a new developer met was a login screen that
 * could not accept anything.
 *
 * It seeds only when the database is empty. The check is the same set of tables
 * the seed itself guards on, so the two agree: if there is business data here,
 * this is somebody's working database and the seed would refuse anyway.
 *
 * Demo data on purpose. Production data reaches a machine one way, by someone
 * deciding to put it there — see "Working with production data" in
 * docs/development.md. Nothing automatic should hand a new joiner 95 real
 * clients and their phone numbers.
 */

import { spawnSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";

// The same tables prisma/seed.ts guards on. Keep them in step.
const PROTECTED = ["AuditLog", "Photo", "Job", "ClientNote", "Client"];

const prisma = new PrismaClient({ log: ["error"] });

async function businessRowCount() {
  let total = 0;
  for (const table of PROTECTED) {
    const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM "${table}"`);
    total += Number(rows[0]?.count ?? 0);
  }
  return total;
}

try {
  const existing = await businessRowCount();

  if (existing > 0) {
    console.log(`[bootstrap] database holds ${existing} business rows — leaving it alone`);
    process.exit(0);
  }

  console.log("[bootstrap] empty database — seeding demo data so there is something to log in to");
  await prisma.$disconnect();

  const result = spawnSync("bun", ["run", "prisma/seed.ts"], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error("[bootstrap] seed failed — the app will still start, but with no data");
    // Deliberately not fatal. A broken seed should not stop a developer from
    // getting a shell and a running app to debug it with.
  }
  process.exit(0);
} catch (error) {
  // Equally deliberate: if this cannot reach the database, `migrate deploy`
  // ahead of it has already failed louder and more usefully.
  console.error(`[bootstrap] skipped: ${error.message?.split("\n")[0] ?? error}`);
  process.exit(0);
} finally {
  await prisma.$disconnect().catch(() => {});
}
