/**
 * billing-reconcile.mjs — who paid and did not get activated?
 *
 * Read-only. Every statement here is a SELECT, and the client is wrapped so a
 * write cannot be issued even by accident: this runs against the live
 * subscription database and its whole purpose is to look, not touch.
 *
 *   node scripts/billing-reconcile.mjs
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * The Pesapal webhook verified the amount paid against a price table that had
 * drifted off the plan ladder: STANDARD, GROWTH and PREMIUM were absent from it
 * and ENTERPRISE carried 120,000 against a 200,000 charge. Every purchasable
 * plan therefore failed the check, and the handler returns HTTP 200 regardless
 * because Pesapal requires that acknowledgment — so the provider recorded the
 * notification as delivered and never retried.
 *
 * ── What this can and cannot tell you ──────────────────────────────────────
 * It cannot name the affected customers on its own, and that limitation is the
 * most important thing on this page. The webhook returns before
 * recordBillingEvent runs, so a payment that failed verification left NO row in
 * this database. There is nothing here to find directly.
 *
 * What it can do is narrow the search: the browser callback used the correct
 * prices and did activate, so anyone who returned to the site is fine and
 * recorded. The exposure is organisations that look like they tried to pay and
 * are not on a paid plan. That list, checked against completed transactions in
 * the Pesapal dashboard, is what identifies a real loss — a completed payment
 * whose organisation never moved.
 */
import { createClient } from "@libsql/client";
import { existsSync, readFileSync } from "node:fs";

/**
 * Credentials come from the environment, or from an env file passed as the
 * first argument. Nothing is scavenged from ambient locations: the Turso
 * variables are marked sensitive on Vercel and `vercel env pull` returns them
 * empty, so whoever runs this is expected to have them to hand.
 */
function loadEnv() {
  const argPath = process.argv[2];

  if (argPath) {
    if (!existsSync(argPath)) {
      console.error(`[reconcile] no such file: ${argPath}`);
      console.error("");
      console.error("That looks like the placeholder from the instructions rather than a real path.");
      usage();
      process.exit(1);
    }
    return Object.fromEntries(
      readFileSync(argPath, "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim().replace(/^export\s+/, ""), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
        }),
    );
  }

  // No file given — take them straight from the environment.
  return process.env;
}

function usage() {
  console.error("Give it the two Turso variables, either way round:");
  console.error("");
  console.error("  TURSO_DATABASE_URL='libsql://…' TURSO_AUTH_TOKEN='…' \\");
  console.error("    node scripts/billing-reconcile.mjs");
  console.error("");
  console.error("  node scripts/billing-reconcile.mjs ./some-env-file");
  console.error("");
  console.error("Both are in the Vercel dashboard under the commercial project's");
  console.error("environment variables, or from `turso db show <database>`.");
  console.error("This only ever reads — every statement is a guarded SELECT.");
}

const env = loadEnv();
const url = (env.TURSO_DATABASE_URL ?? "").trim();
const authToken = (env.TURSO_AUTH_TOKEN ?? "").trim() || undefined;

if (!url) {
  console.error("[reconcile] TURSO_DATABASE_URL is not set" + (process.argv[2] ? ` in ${process.argv[2]}` : "") + ".");
  console.error("");
  usage();
  process.exit(1);
}

const raw = createClient({ url, authToken });

/** Refuses anything that is not a single SELECT. The guard is the point. */
async function read(sql, args = []) {
  const head = sql.trim().replace(/^\s*--[^\n]*\n/g, "").trim().slice(0, 6).toUpperCase();
  if (head !== "SELECT") throw new Error(`refusing non-SELECT statement: ${sql.trim().slice(0, 60)}`);
  if (/;\s*\S/.test(sql)) throw new Error("refusing chained statements");
  const rs = await raw.execute({ sql, args });
  return rs.rows;
}

const money = (n) => (n == null ? "—" : `UGX ${Number(n).toLocaleString()}`);
const rule = (t) => console.log(`\n${t}\n${"─".repeat(t.length)}`);

// The prices checkout actually charges, for comparing against recorded events.
const CHARGED = { STANDARD: 35_000, GROWTH: 75_000, PREMIUM: 120_000, ENTERPRISE: 200_000 };

try {
  rule("1. Subscription state across the customer base");
  const states = await read(`
    SELECT COALESCE(billingStatus,'(null)') AS status, COALESCE(plan,'(null)') AS plan, COUNT(*) AS n
    FROM Organization GROUP BY status, plan ORDER BY n DESC`);
  for (const r of states) console.log(`  ${String(r.status).padEnd(10)} ${String(r.plan).padEnd(11)} ${r.n}`);

  rule("2. Payment events this database holds");
  let events = [];
  try {
    events = await read(`
      SELECT COALESCE(eventType,'(null)') AS eventType, COALESCE(status,'(null)') AS status, COUNT(*) AS n
      FROM OrgSubscriptionEvent GROUP BY eventType, status ORDER BY n DESC`);
  } catch (e) {
    console.log(`  table unreadable: ${e.message.slice(0, 70)}`);
  }
  if (!events.length) {
    console.log("  none. Consistent with the defect: the webhook returns before it records,");
    console.log("  so failed verifications leave nothing behind. It also means no successful");
    console.log("  webhook activation has ever been recorded here.");
  } else {
    for (const r of events) console.log(`  ${String(r.eventType).padEnd(22)} ${String(r.status).padEnd(12)} ${r.n}`);
  }

  rule("3. Recorded payments whose organisation did not end up on that plan");
  let mismatched = [];
  try {
    mismatched = await read(`
      SELECT e.orgId, o.name AS orgName, e.plan AS paidFor, o.plan AS currentPlan,
             e.amount, e.currency, e.occurredAt, o.billingStatus
      FROM OrgSubscriptionEvent e
      LEFT JOIN Organization o ON o.id = e.orgId
      WHERE e.plan IS NOT NULL AND (o.plan IS NULL OR o.plan <> e.plan)
      ORDER BY e.occurredAt DESC LIMIT 100`);
  } catch { /* table may not exist on this deployment */ }
  if (!mismatched.length) console.log("  none — no recorded payment points at a plan the org is not on.");
  for (const r of mismatched) {
    console.log(`  ${r.orgName ?? r.orgId}: paid for ${r.paidFor} (${money(r.amount)}) but sits on ${r.currentPlan ?? "—"} / ${r.billingStatus ?? "—"}  ${r.occurredAt ?? ""}`);
  }

  rule("4. Recorded payments whose amount is not a price we charge");
  let odd = [];
  try {
    odd = await read(`
      SELECT e.orgId, o.name AS orgName, e.plan, e.amount, e.currency, e.occurredAt
      FROM OrgSubscriptionEvent e LEFT JOIN Organization o ON o.id = e.orgId
      WHERE e.amount IS NOT NULL ORDER BY e.occurredAt DESC LIMIT 200`);
  } catch { /* ignore */ }
  const wrong = odd.filter((r) => r.plan && CHARGED[r.plan] != null && Number(r.amount) !== CHARGED[r.plan]);
  if (!wrong.length) console.log("  none — every recorded amount matches its plan's price.");
  for (const r of wrong) {
    console.log(`  ${r.orgName ?? r.orgId}: ${r.plan} recorded at ${money(r.amount)}, charged ${money(CHARGED[r.plan])}  ${r.occurredAt ?? ""}`);
  }

  rule("5. The list to check against Pesapal — orgs not on a paid plan");
  // This is the actual output. Anyone here who has a completed Pesapal
  // transaction paid and was not activated; nothing in this database can
  // distinguish them, because the failing path wrote nothing.
  const exposed = await read(`
    SELECT id, name, COALESCE(plan,'(null)') AS plan, COALESCE(billingStatus,'(null)') AS billingStatus,
           trialEndsAt, planRenewsAt, createdAt
    FROM Organization
    WHERE plan = 'STARTER' OR plan IS NULL
       OR billingStatus IN ('TRIALING','PAST_DUE','CANCELLED')
    ORDER BY createdAt DESC LIMIT 200`);
  if (!exposed.length) console.log("  none — every organisation is on an active paid plan.");
  for (const r of exposed) {
    console.log(`  ${String(r.name).slice(0, 34).padEnd(34)} ${String(r.plan).padEnd(11)} ${String(r.billingStatus).padEnd(10)} created ${String(r.createdAt).slice(0, 10)}`);
  }

  rule("How to finish this");
  console.log("  Take the names in section 5 to the Pesapal dashboard and look for a COMPLETED");
  console.log("  transaction against each. A match is a customer who paid and was never");
  console.log("  activated — the merchant reference carries the orgId and the intended plan,");
  console.log("  so it identifies both. There is no way to establish that from this database");
  console.log("  alone, because the webhook returned before writing anything.");
  console.log("");
  console.log("  Going forward the fix closes it: the webhook now verifies against the prices");
  console.log("  checkout charges, so a completed payment activates and records.");
} finally {
  raw.close?.();
}
