/**
 * Builds the onboarding database: a copy of development with the identities
 * taken out, written to db/init/01-data.sql for a new machine to restore.
 *
 *   bun run pg:anonymise
 *
 * Why a copy of production rather than the demo seed: the shapes that break
 * things are the real ones — 101 jobs against 95 clients, invoice numbers that
 * collided, receipts whose payment was deleted, an expense part-paid across
 * three visits. The demo seed has none of that. What a new developer does not
 * need is who those clients are.
 *
 * It never touches the source. Everything happens in a throwaway database on
 * the scratch server, which is dropped at the end whether this succeeds or not.
 *
 * Two categories, and the difference matters:
 *
 *   emptied    tables that are all identity and no structure — sessions and
 *              their tokens, the audit log's free-text detail, the body of
 *              every WhatsApp message ever sent to a customer, notification
 *              titles that quote client names. Scrubbing free text is a game
 *              you lose eventually; these carry nothing a new developer needs,
 *              so they go.
 *
 *   rewritten  rows worth keeping for their shape, with the identifying
 *              columns replaced by something derived from the row's own id —
 *              stable, so the same client is the same fake person on every
 *              regeneration, and a foreign key still points where it did.
 *
 * Afterwards it checks its own work against the written file rather than the
 * database — an earlier version passed its SQL checks while shipping three
 * staff names, a company domain and a branch phone number, because they were in
 * free text nothing had queried. Any leak deletes the file and fails the run.
 *
 * What this guarantees: no customer name, phone number, address or mailbox, no
 * session token, no audit trail, no message body.
 *
 * What it does not: a colleague's first name that is also an ordinary English
 * word ("Mark", "Grace", "Hope") is excluded from the free-text sweep, because
 * sweeping it turns "marked as paid" into "[redacted]ed as paid". Those names
 * can therefore survive inside an expense description or a journal memo. Staff
 * first names among themselves are a different order of exposure from customer
 * contact details, and the trade is made deliberately — but it is a trade, and
 * this file is not a substitute for judgement about who gets the repository.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const DEV = { container: "mrms-postgres-dev", db: "mrms" };
const WORK = { container: "mrms-postgres-scratch", db: "mrms_anon", port: 5434 };
const USER = "mrms";
const PASSWORD = "mrms_dev_password";
const DEV_LOGIN_PASSWORD = process.env.ANON_PASSWORD ?? "password123";
const OUT = path.resolve(process.cwd(), "db", "init", "01-data.sql");

const sh = (cmd) => spawnSync("sh", ["-c", cmd], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
const psql = (sql) =>
  execFileSync("docker", ["exec", "-i", WORK.container, "psql", "-U", USER, "-d", WORK.db, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], { encoding: "utf8" });

function drop() {
  spawnSync("docker", ["exec", WORK.container, "psql", "-U", USER, "-d", "postgres", "-q", "-c", `DROP DATABASE IF EXISTS ${WORK.db} WITH (FORCE)`], { stdio: "ignore" });
}

// ── Tables emptied outright ─────────────────────────────────────────────────
// Sessions and portal sessions carry bearer tokens and IP addresses. AuditLog
// and SystemAuditEvent carry free-text detail written by the application, which
// means anything. OutboundMessage.body is the literal text sent to a customer.
// Notification.title and .message quote client and job names. RateLimit is
// keyed by whatever identified the caller.
const EMPTY = [
  "Session", "PortalSession", "PortalUser",
  "AuditLog", "SystemAuditEvent",
  "OutboundMessage", "Notification", "RateLimit",
];

// ── Rewrites ────────────────────────────────────────────────────────────────
// `substr(md5(id),1,6)` rather than a counter: derived from the row, so it is
// the same on every regeneration and a reviewer can tell two dumps apart from
// their content rather than their ordering.
const REWRITES = [
  `UPDATE "Client" SET
     "fullName" = 'Client ' || upper(substr(md5(id), 1, 6)),
     phone      = '+2567' || lpad((abs(hashtext(id)) % 100000000)::text, 8, '0'),
     email      = CASE WHEN email IS NULL THEN NULL ELSE 'client-' || substr(md5(id), 1, 8) || '@example.test' END,
     address    = CASE WHEN address IS NULL THEN NULL ELSE 'Plot ' || (abs(hashtext(id)) % 400) || ', Kampala' END`,

  `UPDATE "Lead" SET
     "fullName" = 'Lead ' || upper(substr(md5(id), 1, 6)),
     phone      = CASE WHEN phone IS NULL THEN NULL ELSE '+2567' || lpad((abs(hashtext(id)) % 100000000)::text, 8, '0') END,
     email      = CASE WHEN email IS NULL THEN NULL ELSE 'lead-' || substr(md5(id), 1, 8) || '@example.test' END`,

  `UPDATE "RepairRequest" SET
     "customerName"           = 'Customer ' || upper(substr(md5(id), 1, 6)),
     phone                    = '+2567' || lpad((abs(hashtext(id)) % 100000000)::text, 8, '0'),
     email                    = CASE WHEN email IS NULL THEN NULL ELSE 'request-' || substr(md5(id), 1, 8) || '@example.test' END,
     "alternateContactPerson" = CASE WHEN "alternateContactPerson" IS NULL THEN NULL ELSE 'Contact ' || upper(substr(md5(id), 1, 4)) END,
     "alternateContactPhone"  = CASE WHEN "alternateContactPhone"  IS NULL THEN NULL ELSE '+2567' || lpad((abs(hashtext(id || 'alt')) % 100000000)::text, 8, '0') END,
     "deliveryPersonName"     = CASE WHEN "deliveryPersonName"     IS NULL THEN NULL ELSE 'Courier ' || upper(substr(md5(id), 1, 4)) END,
     "deliveryPersonPhone"    = CASE WHEN "deliveryPersonPhone"    IS NULL THEN NULL ELSE '+2567' || lpad((abs(hashtext(id || 'del')) % 100000000)::text, 8, '0') END,
     "pickupAddress"          = CASE WHEN "pickupAddress"          IS NULL THEN NULL ELSE 'Plot ' || (abs(hashtext(id)) % 400) || ', Kampala' END`,

  `UPDATE "Supplier" SET
     name          = 'Supplier ' || upper(substr(md5(id), 1, 4)),
     "contactName" = CASE WHEN "contactName" IS NULL THEN NULL ELSE 'Contact ' || upper(substr(md5(id), 1, 4)) END,
     phone         = CASE WHEN phone IS NULL THEN NULL ELSE '+2567' || lpad((abs(hashtext(id)) % 100000000)::text, 8, '0') END,
     email         = CASE WHEN email IS NULL THEN NULL ELSE 'supplier-' || substr(md5(id), 1, 8) || '@example.test' END,
     address       = CASE WHEN address IS NULL THEN NULL ELSE 'Plot ' || (abs(hashtext(id)) % 400) || ', Kampala' END`,

  `UPDATE "FieldVisit" SET
     "contactName"  = CASE WHEN "contactName"  IS NULL THEN NULL ELSE 'Contact ' || upper(substr(md5(id), 1, 4)) END,
     "contactPhone" = CASE WHEN "contactPhone" IS NULL THEN NULL ELSE '+2567' || lpad((abs(hashtext(id)) % 100000000)::text, 8, '0') END,
     "signoffName"  = CASE WHEN "signoffName"  IS NULL THEN NULL ELSE 'Signoff ' || upper(substr(md5(id), 1, 4)) END,
     address        = CASE WHEN address IS NULL THEN NULL ELSE 'Plot ' || (abs(hashtext(id)) % 400) || ', Kampala' END`,

  `UPDATE "DeliveryNote" SET
     "deliveredByName" = CASE WHEN "deliveredByName" IS NULL THEN NULL ELSE 'Staff ' || upper(substr(md5(id), 1, 4)) END,
     "receivedByName"  = CASE WHEN "receivedByName"  IS NULL THEN NULL ELSE 'Client ' || upper(substr(md5(id), 1, 4)) END`,

  // Bank details and payment instructions print on every document. The company
  // name and address stay: without them the documents render as a blank letterhead
  // and half the PDF tests stop meaning anything.
  `UPDATE "DocumentBrandingSettings" SET
     "paymentAccounts"     = CASE WHEN "paymentAccounts"     IS NULL THEN NULL ELSE 'Example Bank — 0000000000' END,
     "paymentInstructions" = CASE WHEN "paymentInstructions" IS NULL THEN NULL ELSE 'Pay on collection.' END,
     "companyEmail"        = CASE WHEN "companyEmail"        IS NULL THEN NULL ELSE 'accounts@example.test' END,
     "companyContacts"     = CASE WHEN "companyContacts"     IS NULL THEN NULL ELSE '+256700000000' END`,

  // A branch phone is a real number that a real person answers.
  `UPDATE "Branch" SET
     phone   = CASE WHEN phone   IS NULL THEN NULL ELSE '+2567' || lpad((abs(hashtext(id)) % 100000000)::text, 8, '0') END,
     address = CASE WHEN address IS NULL THEN NULL ELSE 'Plot ' || (abs(hashtext(id)) % 400) || ', Kampala' END`,

  // Staff become their role, so a new developer can read the login list off the
  // seed convention instead of being handed one. Kept unique by row number.
  `UPDATE "User" u SET
     name  = initcap(replace(lower(u.role::text), '_', ' ')) || ' ' || r.n,
     email = lower(replace(u.role::text, '_', '')) || r.n || '@eagle.test',
     phone = CASE WHEN u.phone IS NULL THEN NULL ELSE '+2567' || lpad((abs(hashtext(u.id)) % 100000000)::text, 8, '0') END
   FROM (SELECT id, row_number() OVER (PARTITION BY role ORDER BY "createdAt", id) AS n FROM "User") r
   WHERE r.id = u.id`,

  // Provider tokens are credentials even when expired.
  `UPDATE "Account" SET "accessToken" = NULL, "refreshToken" = NULL, "idToken" = NULL, scope = NULL`,
];

// ── Run ─────────────────────────────────────────────────────────────────────

console.log(`\nANONYMISE  ${DEV.db}  ->  ${path.relative(process.cwd(), OUT)}`);
console.log("=".repeat(74));

process.on("exit", drop);

/** Real name tokens, captured before the rewrites erase them. */
let realNames = [];

try {
  drop();
  execFileSync("docker", ["exec", WORK.container, "psql", "-U", USER, "-d", "postgres", "-q", "-c", `CREATE DATABASE ${WORK.db}`], { stdio: "ignore" });

  // Copy, structure and data, straight between the two containers.
  const copy = sh(
    `docker exec ${DEV.container} pg_dump -U ${USER} -d ${DEV.db} --no-owner --no-privileges ` +
    `| docker exec -i ${WORK.container} psql -U ${USER} -d ${WORK.db} -q -v ON_ERROR_STOP=1`,
  );
  if (copy.status !== 0) {
    console.error(`  copy failed:\n${(copy.stderr || "").split("\n").slice(0, 5).join("\n")}`);
    process.exit(1);
  }
  const before = psql(`SELECT count(*) FROM "Job"`).trim();
  console.log(`  copied a working database (${before} jobs)`);

  // Collected before anything is rewritten, because afterwards the real names
  // are gone from the columns that hold them — but not from the free text that
  // mentions them. An expense reading "transport — <technician>", a job note,
  // a journal memo. Rewriting the name columns alone leaves every one of those,
  // which is what the first version of this script did.
  realNames = psql(`
    SELECT DISTINCT lower(word) FROM (
      SELECT regexp_split_to_table(coalesce(name, ''), '\\s+')          AS word FROM "User"
      UNION ALL SELECT regexp_split_to_table(coalesce("fullName", ''), '\\s+')     FROM "Client"
      UNION ALL SELECT regexp_split_to_table(coalesce("fullName", ''), '\\s+')     FROM "Lead"
      UNION ALL SELECT regexp_split_to_table(coalesce("customerName", ''), '\\s+') FROM "RepairRequest"
      UNION ALL SELECT regexp_split_to_table(coalesce("contactName", ''), '\\s+')  FROM "Supplier"
      UNION ALL SELECT regexp_split_to_table(coalesce(name, ''), '\\s+')           FROM "Supplier"
      UNION ALL SELECT split_part(email, '@', 1)                                   FROM "User"
    ) w
    WHERE length(word) >= 4 AND word ~ '^[A-Za-z][A-Za-z''-]+$'
      -- Trading names contribute their vocabulary as well as their identity.
      -- "Kampala Public Service Ltd" yields "public" and "service", and sweeping
      -- those through every text column turns "Service & Repairs" into
      -- "[redacted] & Repairs" — the dataset damaged to hide nothing. The
      -- identity is in the distinctive word, which is what survives this list.
      AND lower(word) NOT IN (
        'admin','user','test','demo','none','null','info','ltd','limited','company','client','customer',
        'staff','tech','technician','internal','external','sales','finance','manager','front','desk','corporate',
        'public','service','services','general','enterprise','enterprises','solutions','systems','group','holdings',
        'trading','stores','store','shop','shops','centre','center','uganda','kampala','east','africa','african',
        'international','technologies','technology','consult','consultants','agency','agencies','investments',
        'supplies','supply','hardware','electronics','computers','computer','mobile','phone','phones','repair',
        'repairs','digital','global','media','print','office','works','bureau','associates','partners','trust',
        'school','college','university','hospital','clinic','church','hotel','farm','motors','auto','engineering',
        -- Ordinary words that are also first names. Matching from the start of a
        -- word (so "Edgar" catches "Edgars") means "mark" would swallow "marked
        -- as paid" and "secondary" every mention of a secondary school. Excluded
        -- knowingly: see the note on what this does not guarantee, above.
        'mark','marks','grace','hope','joy','best','city','star','real','gift','prince','angel','blessing',
        'precious','bright','primary','secondary','junior','senior','holy','saint','peace','faith','mercy','divine'
      )
  `).trim().split("\n").map((s) => s.trim()).filter(Boolean);
  console.log(`  collected ${realNames.length} real name token(s) to redact from free text`);

  psql(`TRUNCATE ${EMPTY.map((t) => `"${t}"`).join(", ")} CASCADE`);
  console.log(`  emptied ${EMPTY.length} tables of identity: ${EMPTY.join(", ")}`);

  // Phone numbers before the rewrites, not after: the rewrites put generated
  // ones into the dedicated columns, and those match the same pattern. Run this
  // second and it would redact its own output.
  //
  // Column lists do not work here either. The two that survived the first
  // attempt were Campaign.body and Client.notes — a number typed into a message
  // template and a number typed into a note, neither of which is a phone column
  // and neither of which anyone would think to list.
  psql(`
    DO $phones$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
        WHERE c.table_schema = 'public'
          AND c.data_type IN ('text', 'character varying')
          AND c.table_name <> '_prisma_migrations'
          -- A unique column cannot take a constant: two clients whose numbers
          -- both became '[phone redacted]' violate Client_phone_orgId_key. Those
          -- are the dedicated phone columns, and REWRITES gives each one its own
          -- generated number a few lines below.
          AND NOT EXISTS (
            SELECT 1
            FROM pg_index i
            JOIN pg_class cl ON cl.oid = i.indrelid
            JOIN pg_namespace ns ON ns.oid = cl.relnamespace
            JOIN pg_attribute att ON att.attrelid = cl.oid AND att.attnum = ANY (i.indkey)
            WHERE i.indisunique AND ns.nspname = 'public'
              AND cl.relname = c.table_name AND att.attname = c.column_name
          )
      LOOP
        EXECUTE format(
          'UPDATE %I SET %I = regexp_replace(%I, %L, %L, %L) WHERE %I ~ %L',
          r.table_name, r.column_name, r.column_name,
          '(\\+?256[0-9]{9}|\\m0[37][0-9]{8}\\M)', '[phone redacted]', 'g',
          r.column_name, '(\\+?256[0-9]{9}|\\m0[37][0-9]{8}\\M)'
        );
      END LOOP;
    END
    $phones$;
  `);
  console.log(`  removed every phone-shaped string, in any column`);

  for (const sql of REWRITES) psql(sql);
  console.log(`  rewrote identifying columns across ${REWRITES.length} tables`);

  // Sweep every text column in the database for those tokens. Broad on purpose:
  // the names turn up in descriptions, notes and memos written by hand, and
  // there is no list of which columns those are that stays true.
  if (realNames.length) {
    const pattern = `\\m(${realNames.join("|")})[A-Za-z]*`;
    psql(`
      DO $sweep$
      DECLARE r record; hits int;
      BEGIN
        FOR r IN
          SELECT c.table_name, c.column_name
          FROM information_schema.columns c
          JOIN information_schema.tables t
            ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
          WHERE c.table_schema = 'public'
            AND c.data_type IN ('text', 'character varying')
            AND c.table_name <> '_prisma_migrations'
        LOOP
          EXECUTE format(
            'UPDATE %I SET %I = regexp_replace(%I, %L, %L, %L) WHERE %I ~* %L',
            r.table_name, r.column_name, r.column_name,
            ${literalSql(`\\m(${realNames.join("|")})[A-Za-z]*`)}, '[redacted]', 'gi',
            r.column_name, ${literalSql(`\\m(${realNames.join("|")})[A-Za-z]*`)}
          );
        END LOOP;
      END
      $sweep$;
    `);
    console.log(`  swept every text column for them`);
  }

  // Structure must survive the scrub, or the dump is not worth restoring.
  const after = psql(`SELECT count(*) FROM "Job"`).trim();
  const money = psql(`SELECT COALESCE(SUM(amount), 0) FROM "Payment"`).trim();
  if (after !== before) {
    console.error(`  jobs changed during anonymisation: ${before} -> ${after}. Refusing to write.`);
    process.exit(1);
  }
  console.log(`  structure intact: ${after} jobs, payments still total ${money}`);
} catch (error) {
  console.error(`\n  failed: ${error.message?.split("\n").slice(0, 3).join("\n  ") ?? error}\n`);
  process.exit(1);
}

// Passwords last, through better-auth's own hashing rather than a literal — a
// hash pasted into SQL is a hash nobody can regenerate when the algorithm moves.
const { hashPassword } = await import("better-auth/crypto");
const hash = await hashPassword(DEV_LOGIN_PASSWORD);
psql(`UPDATE "Account" SET password = ${literal(hash)} WHERE password IS NOT NULL`);
console.log(`  every account's password is now "${DEV_LOGIN_PASSWORD}"`);

// ── Verify, then write ──────────────────────────────────────────────────────

const leaks = [];
const check = (label, sql) => {
  const n = Number(psql(sql).trim());
  if (n > 0) leaks.push(`${label}: ${n}`);
};
check("client phones not rewritten", `SELECT count(*) FROM "Client" WHERE phone !~ '^\\+2567[0-9]{8}$'`);
check("client emails outside example.test", `SELECT count(*) FROM "Client" WHERE email IS NOT NULL AND email NOT LIKE '%@example.test'`);
check("lead emails outside example.test", `SELECT count(*) FROM "Lead" WHERE email IS NOT NULL AND email NOT LIKE '%@example.test'`);
check("repair-request emails outside example.test", `SELECT count(*) FROM "RepairRequest" WHERE email IS NOT NULL AND email NOT LIKE '%@example.test'`);
check("supplier emails outside example.test", `SELECT count(*) FROM "Supplier" WHERE email IS NOT NULL AND email NOT LIKE '%@example.test'`);
check("user emails outside eagle.test", `SELECT count(*) FROM "User" WHERE email NOT LIKE '%@eagle.test'`);
check("sessions", `SELECT count(*) FROM "Session"`);
check("audit rows", `SELECT count(*) FROM "AuditLog"`);
check("outbound message bodies", `SELECT count(*) FROM "OutboundMessage"`);

if (leaks.length) {
  console.error(`\n  ${leaks.length} check(s) failed — nothing written:\n`);
  for (const l of leaks) console.error(`    - ${l}`);
  console.error("");
  process.exit(1);
}
console.log("  verified: no real phone, address or mailbox survives");

mkdirSync(path.dirname(OUT), { recursive: true });
const dump = sh(
  `docker exec ${WORK.container} pg_dump -U ${USER} -d ${WORK.db} --format=plain --clean --if-exists --no-owner --no-privileges > ${JSON.stringify(OUT)}`,
);
if (dump.status !== 0) {
  console.error(`  pg_dump failed:\n${(dump.stderr || "").split("\n").slice(0, 5).join("\n")}`);
  process.exit(1);
}

// ── Verify the file, not the database ───────────────────────────────────────
// The first version of this script checked its work in SQL and passed, while
// the file it wrote still carried three staff names, a company domain and a
// real branch phone number — they were in free text nothing had queried. The
// artefact is what ships, so the artefact is what gets checked.
{
  // Only the COPY blocks. The rest is DDL, where "public" is the schema and
  // every table and column name is a word — scanning it produces thousands of
  // matches that mean nothing and bury the one that does.
  const whole = readFileSync(OUT, "utf8");
  const text = (whole.match(/^COPY [\s\S]*?^\\\.$/gm) ?? []).join("\n");
  const found = [];

  // Word-start only, no closing boundary. "Edgars facilitation" survived a
  // version of this that required one: the name ends, the word does not.
  for (const token of realNames) {
    const n = (text.match(new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi")) ?? []).length;
    if (n) found.push(`real name "${token}" × ${n}`);
  }

  const domains = new Set(
    (text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g) ?? []).map((e) => e.split("@")[1].toLowerCase().replace(/[^a-z0-9.-].*$/, "")),
  );
  for (const d of domains) {
    if (d !== "example.test" && d !== "eagle.test") found.push(`email domain "${d}"`);
  }

  const phones = new Set((text.match(/\+?256\d{9}/g) ?? []).filter((p) => !/^\+?2567\d{8}$/.test(p)));
  if (phones.size) found.push(`${phones.size} phone number(s) not produced by this script`);

  if (found.length) {
    rmSync(OUT, { force: true });
    console.error(`\n  ${found.length} leak(s) in the written file — deleted it rather than ship it:\n`);
    for (const f of found) console.error(`    - ${f}`);
    console.error("\n  Add the column to REWRITES, or the table to EMPTY, and run it again.\n");
    process.exit(1);
  }
  console.log("  file scanned: no real name, mailbox, domain or phone number in it");
}

const users = psql(`SELECT email FROM "User" ORDER BY role, email`).trim().split("\n").filter(Boolean);
console.log(`  wrote ${(statSync(OUT).size / 1024 / 1024).toFixed(1)} MB\n`);
console.log("  accounts in the file (password above):");
for (const e of users) console.log(`    ${e}`);
console.log(`
  A fresh machine restores this on its first \`bun run dev:up\`. Verify the way
  one would:

    bun run dev:reset && bun run dev:up
`);

function literal(s) {
  return `'${String(s).replaceAll("'", "''")}'`;
}

/** Same, for a value being embedded in the DO block's own generated SQL. */
function literalSql(s) {
  return `'${String(s).replaceAll("'", "''")}'`;
}
