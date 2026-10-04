/**
 * Posts historical expenses to the double-entry ledger.
 *
 * Cash-basis auto-posting arrived on 2026-08-01 (commit 820d163). Expenses
 * recorded before that never reached the ledger, and the P&L reads from journal
 * lines rather than the Expense table — so those costs are simply missing from
 * the report. In care that is 14 expenses worth about UGX 2.2m.
 *
 * Posts the same pair the live path posts: Dr 6000 Operating Expenses,
 * Cr 1000 Cash & Bank, keyed on `expense:<id>` exactly as postExpensePayment
 * does. That key is what makes this safe to re-run — an expense already posted,
 * by this script or by the app, is skipped.
 *
 *   node scripts/backfill-expense-ledger.mjs            # report only
 *   node scripts/backfill-expense-ledger.mjs --apply    # write
 */

import { createClient } from "@libsql/client";

const APPLY = process.argv.includes("--apply");
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("[expense-backfill] TURSO_DATABASE_URL is not set.");
  process.exit(1);
}

const client = createClient({ url, authToken });

const cuid = () => "bf" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);

async function main() {
  const unposted = await client.execute(`
    SELECT e.id, e.orgId, e.expenseNumber, e.description, e.amount, e.paidAt, e.createdAt, e.createdById
    FROM Expense e
    WHERE NOT EXISTS (SELECT 1 FROM JournalEntry j WHERE j.reference = 'expense:' || e.id)
    ORDER BY e.createdAt
  `);

  if (unposted.rows.length === 0) {
    console.log("[expense-backfill] Every expense is already on the ledger.");
    return;
  }

  const total = unposted.rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  console.log(`[expense-backfill] ${unposted.rows.length} unposted expense(s), ${total.toLocaleString()} total.`);

  // Accounts are per-org; an org missing either one cannot be posted and is
  // reported rather than silently skipped.
  const accounts = await client.execute(
    `SELECT id, orgId, code FROM ChartOfAccount WHERE code IN ('6000','1000')`,
  );
  const byOrg = new Map();
  for (const a of accounts.rows) {
    if (!byOrg.has(a.orgId)) byOrg.set(a.orgId, {});
    byOrg.get(a.orgId)[a.code] = a.id;
  }

  let posted = 0, skipped = 0;
  for (const e of unposted.rows) {
    const acc = byOrg.get(e.orgId);
    if (!acc?.["6000"] || !acc?.["1000"]) {
      console.log(`  SKIP ${e.expenseNumber} — org ${e.orgId} has no 6000/1000 account`);
      skipped++;
      continue;
    }
    const amount = Number(e.amount || 0);
    if (!(amount > 0)) { skipped++; continue; }

    if (!APPLY) {
      console.log(`  would post ${String(e.expenseNumber).padEnd(30)} ${amount.toLocaleString()}`);
      posted++;
      continue;
    }

    // Entry numbers are per-org and sequential; take the next free one.
    const seq = await client.execute({
      sql: `SELECT COUNT(*) AS n FROM JournalEntry WHERE orgId = ?`,
      args: [e.orgId],
    });
    const entryNumber = `JE-BF-${String(Number(seq.rows[0].n) + 1).padStart(4, "0")}`;
    const entryId = cuid();
    // Date the entry when the money was actually spent, not today, so it lands
    // in the period the cost belongs to.
    const when = e.paidAt ?? e.createdAt;

    await client.execute({
      sql: `INSERT INTO JournalEntry (id, orgId, entryNumber, date, description, reference, status, totalAmount, createdById, postedAt, createdAt, updatedAt)
            VALUES (?,?,?,?,?,?,'POSTED',?,?,?,?,?)`,
      args: [entryId, e.orgId, entryNumber, when,
        `Expense ${e.expenseNumber} — ${e.description} (backfill)`,
        `expense:${e.id}`, amount, e.createdById, Date.now(), Date.now(), Date.now()],
    });
    await client.execute({
      sql: `INSERT INTO JournalLine (id, journalEntryId, accountId, debit, credit, description) VALUES (?,?,?,?,0,?)`,
      args: [cuid(), entryId, acc["6000"], amount, "Operating expense"],
    });
    await client.execute({
      sql: `INSERT INTO JournalLine (id, journalEntryId, accountId, debit, credit, description) VALUES (?,?,?,0,?,?)`,
      args: [cuid(), entryId, acc["1000"], amount, "Cash paid"],
    });
    posted++;
  }

  console.log(APPLY
    ? `[expense-backfill] Posted ${posted}, skipped ${skipped}.`
    : `[expense-backfill] Dry run: ${posted} would post, ${skipped} skipped. Re-run with --apply.`);
}

main()
  .catch((e) => { console.error("[expense-backfill] Failed:", e?.message ?? e); process.exit(1); })
  .finally(() => client.close?.());
