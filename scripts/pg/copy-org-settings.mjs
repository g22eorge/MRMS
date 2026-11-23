#!/usr/bin/env node
/**
 * Copies per-organisation and platform settings from a SQLite dump into
 * Postgres, adding only what the target lacks.
 *
 * For the four settings tables `import.mjs --missing-only` cannot handle,
 * because their primary key is not an `id` column: OrgModuleGrant,
 * OrgWhatsAppConfig, AiOrgSettings and PlatformSetting. Written for the
 * commercial site's own database (Turso `repairmanager`), whose tenants reached
 * production without their module grants.
 *
 *   node scripts/pg/copy-org-settings.mjs <dump.db> [--dry-run] [--skip-org=<id>,<id>]
 *
 * Add, never change: a row whose key the target already holds is left alone,
 * and a row for an organisation the target does not have is skipped. Values are
 * never printed — several are credentials. Everything happens in one
 * transaction; --dry-run rolls it back.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { createClient } from "@libsql/client";
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipOrgs = new Set(
  (args.find((a) => a.startsWith("--skip-org="))?.split("=")[1] ?? "").split(",").map((v) => v.trim()).filter(Boolean),
);
const dumpArg = args.find((a) => !a.startsWith("--"));
if (!dumpArg || !existsSync(path.resolve(process.cwd(), dumpArg))) {
  console.error("usage: node scripts/pg/copy-org-settings.mjs <dump.db> [--dry-run] [--skip-org=<id>,<id>]");
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("copy-org-settings: DATABASE_URL is not set");
  process.exit(2);
}

const sqlite = createClient({ url: `file:${path.resolve(process.cwd(), dumpArg)}` });
const prisma = new PrismaClient({ log: ["error"] });

const rowsOf = async (table) => {
  try {
    return (await sqlite.execute(`SELECT * FROM "${table}"`)).rows;
  } catch {
    return [];
  }
};
/** SQLite holds dates as ISO strings, "YYYY-MM-DD HH:MM:SS" (UTC) or epoch ms. */
const date = (v) => {
  if (v == null) return new Date();
  if (typeof v === "number" || typeof v === "bigint") return new Date(Number(v));
  const text = String(v);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : `${text.replace(" ", "T")}Z`);
};
const bool = (v) => v === true || v === 1 || v === 1n || v === "1" || v === "true";

class DryRunRollback extends Error {}
const lines = [];

try {
  await prisma.$transaction(async (tx) => {
    const orgs = new Map((await tx.organization.findMany({ select: { id: true, name: true } })).map((o) => [o.id, o.name]));
    const wanted = (orgId) => orgs.has(orgId) && !skipOrgs.has(orgId);
    const name = (orgId) => orgs.get(orgId) ?? orgId;

    // Module grants.
    const validModules = new Set(
      (await tx.$queryRawUnsafe(`SELECT unnest(enum_range(NULL::"OrgModule"))::text AS m`)).map((r) => r.m),
    );
    const haveGrants = new Set((await tx.orgModuleGrant.findMany()).map((g) => `${g.orgId}|${g.module}`));
    const grants = new Map();
    for (const row of await rowsOf("OrgModuleGrant")) {
      const key = `${row.orgId}|${row.module}`;
      if (!wanted(row.orgId) || !validModules.has(String(row.module)) || haveGrants.has(key)) continue;
      haveGrants.add(key);
      if (!grants.has(row.orgId)) grants.set(row.orgId, []);
      grants.get(row.orgId).push(String(row.module));
    }
    for (const [orgId, modules] of grants) {
      await tx.orgModuleGrant.createMany({ data: modules.map((module) => ({ orgId, module })) });
      lines.push(`OrgModuleGrant   ${name(orgId)}: ${modules.join(", ")}`);
    }

    // WhatsApp configuration. Holds an access token; only the org is printed.
    const haveWa = new Set((await tx.orgWhatsAppConfig.findMany({ select: { orgId: true } })).map((r) => r.orgId));
    for (const row of await rowsOf("OrgWhatsAppConfig")) {
      if (!wanted(row.orgId) || haveWa.has(row.orgId)) continue;
      await tx.orgWhatsAppConfig.create({
        data: {
          orgId: row.orgId,
          businessNumber: row.businessNumber,
          phoneNumberId: row.phoneNumberId,
          accessToken: row.accessToken,
          businessAccountId: row.businessAccountId ?? null,
          provider: row.provider ?? "meta",
          atApiKey: row.atApiKey ?? null,
          atUsername: row.atUsername ?? null,
          atSenderId: row.atSenderId ?? null,
          smsFallback: bool(row.smsFallback),
          createdAt: date(row.createdAt),
        },
      });
      lines.push(`OrgWhatsAppConfig ${name(row.orgId)}`);
    }

    // AI settings.
    const haveAi = new Set((await tx.aiOrgSettings.findMany({ select: { orgId: true } })).map((r) => r.orgId));
    for (const row of await rowsOf("AiOrgSettings")) {
      if (!wanted(row.orgId) || haveAi.has(row.orgId)) continue;
      await tx.aiOrgSettings.create({
        data: {
          orgId: row.orgId,
          aiEnabled: bool(row.aiEnabled),
          guideEnabled: bool(row.guideEnabled),
          insightsEnabled: bool(row.insightsEnabled),
          allowOrgKnowledge: bool(row.allowOrgKnowledge),
          allowPromptLogging: bool(row.allowPromptLogging),
          model: row.model ?? null,
        },
      });
      lines.push(`AiOrgSettings    ${name(row.orgId)}`);
    }

    // Platform settings. Key names only: the values are credentials.
    const haveKeys = new Set((await tx.platformSetting.findMany({ select: { key: true } })).map((r) => r.key));
    for (const row of await rowsOf("PlatformSetting")) {
      if (haveKeys.has(row.key)) continue;
      await tx.platformSetting.create({ data: { key: row.key, value: String(row.value) } });
      lines.push(`PlatformSetting  ${row.key}`);
    }

    if (dryRun) throw new DryRunRollback();
  });
} catch (error) {
  if (!(error instanceof DryRunRollback)) {
    console.error("copy-org-settings: failed, nothing was written");
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

console.log(`\n  ${dryRun ? "would add" : "added"} ${lines.length} setting(s)${dryRun ? "   (DRY RUN — nothing kept)" : ""}:`);
for (const line of lines) console.log(`    - ${line}`);
if (!lines.length) console.log("    (nothing to add: the target already holds every row)");
await prisma.$disconnect();
