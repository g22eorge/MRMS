#!/usr/bin/env node
/**
 * Renumber expenses to the compact TAG/MM/NNN scheme (e.g. EIS/09/042).
 *
 * Legacy rows carry EXP-<year>-… numbers (or other shapes). This rewrites
 * every expense number in an org in first-recorded order, so the sequence is
 * clean and chronological. Nothing else moves: ledger and audit rows key off
 * expense:<id>, never the number, so books and history stay intact. Only
 * human-readable references to old numbers go stale.
 *
 * Safe by construction:
 *  - dry-run by default (prints the full old → new mapping, writes nothing),
 *  - numbers are assigned 1..N in createdAt order, unique within the pass,
 *  - requires --org=<id> (or explicit --all-orgs) together with --apply.
 *
 *   node scripts/renumber-expenses.mjs                        # dry-run, all orgs
 *   node scripts/renumber-expenses.mjs --org=org_xxx           # dry-run, one org
 *   node scripts/renumber-expenses.mjs --org=org_xxx --apply   # rewrite one org
 *
 * Target: TURSO_DATABASE_URL (+TOKEN) when set, else file:./dev.db (local).
 */

import { createClient } from "@libsql/client";

const APPLY = process.argv.includes("--apply");
const ALL_ORGS = process.argv.includes("--all-orgs");
const orgArg = process.argv.find((a) => a.startsWith("--org="))?.slice("--org=".length);

const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient(authToken ? { url, authToken } : { url });

function orgTag(slug) {
  const tag = String(slug ?? "").trim().toUpperCase();
  return tag || "ORG";
}

async function brandingPrefix(orgId, fallbackSlug) {
  // Same short tag the app stamps on every other document (Branding →
  // quote prefix, e.g. EIS); falls back to the slug-derived tag.
  try {
    const r = await client.execute({
      sql: `SELECT "quotePrefix" FROM "DocumentBrandingSettings" WHERE id = ? OR orgId = ? LIMIT 1`,
      args: [orgId, orgId],
    });
    const prefix = String(r.rows[0]?.quotePrefix ?? "").trim().toUpperCase();
    if (prefix) return prefix;
  } catch {
    // Branding table absent on old snapshots — slug fallback below.
  }
  return orgTag(fallbackSlug);
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const orgs = await client.execute(
  ALL_ORGS || !orgArg
    ? "SELECT id, name, slug FROM Organization ORDER BY name"
    : { sql: "SELECT id, name, slug FROM Organization WHERE id = ?", args: [orgArg] },
).then((r) => r.rows);

if (orgs.length === 0) fail("No organisations matched.");
if (!APPLY && !ALL_ORGS && !orgArg) {
  console.log("(dry-run; pass --org=<id> to narrow, --apply to write)");
}

let totalRewrites = 0;
for (const org of orgs) {
  const tag = await brandingPrefix(org.id, org.slug);
  const { rows } = await client.execute({
    sql: `SELECT id, expenseNumber, createdAt FROM Expense WHERE orgId = ? ORDER BY datetime(createdAt), rowid`,
    args: [org.id],
  });
  if (rows.length === 0) {
    console.log(`[${org.name}] no expenses — nothing to do.`);
    continue;
  }
  const seen = new Set();
  const plan = rows.map((row, i) => {
    const created = new Date(row.createdAt);
    const mm = Number.isNaN(created.getTime())
      ? "00"
      : String(created.getMonth() + 1).padStart(2, "0");
    const next = `${tag}/${mm}/${String(i + 1).padStart(3, "0")}`;
    return { id: row.id, from: row.expenseNumber, to: next };
  });
  for (const p of plan) {
    if (seen.has(p.to)) fail(`Collision while planning ${org.name}: ${p.to} assigned twice. Aborting.`);
    seen.add(p.to);
  }
  const changes = plan.filter((p) => p.from !== p.to);
  console.log(`[${org.name}] ${rows.length} expenses, ${changes.length} to renumber:`);
  for (const p of changes.slice(0, 25)) console.log(`  ${p.from}  →  ${p.to}`);
  if (changes.length > 25) console.log(`  … and ${changes.length - 25} more`);

  if (APPLY && changes.length > 0) {
    const stmts = changes.map((p) => ({
      sql: `UPDATE Expense SET expenseNumber = ? WHERE id = ? AND orgId = ?`,
      args: [p.to, p.id, org.id],
    }));
    // Small batches keep a slow libSQL round-trip from holding the write long.
    for (let i = 0; i < stmts.length; i += 50) {
      await client.batch(stmts.slice(i, i + 50));
    }
    console.log(`  wrote ${changes.length} numbers.`);
    totalRewrites += changes.length;
  }
}

if (!APPLY) console.log("\nDry-run only — nothing written. Re-run with --apply (and --org=<id>) to rewrite.");
else console.log(`\nDone — ${totalRewrites} expense numbers rewritten.`);
