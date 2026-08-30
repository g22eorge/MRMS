import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// ── Step 0: heal the production schema (additive, idempotent) ────────────────
// Runs only on a real deploy (Turso env present), before the env below is
// cleared for Prisma's SQLite build validation. Applies recent additive
// columns/tables via @libsql/client (independent of Prisma) so the freshly
// deployed code never boots against a stale prod schema. Safe to repeat.
// Fail-closed by default: a failed reconcile ABORTS the build, so a deploy can
// never ship code against a stale prod schema. Set STRICT_SCHEMA_HEAL=0 to
// revert to warn-and-continue (relying on /api/admin/db-fix as the manual
// fallback) if a transient DB blip must not block an otherwise-fine deploy.
if (process.env.TURSO_DATABASE_URL) {
  // sync-schema-to-db reconciles EVERY model/column from schema.prisma (creates
  // missing tables/columns/indexes); prod-job-column-safety then normalizes Job
  // data. Both idempotent.
  const strict = process.env.STRICT_SCHEMA_HEAL !== "0";
  const healSteps = [
    ["Reconciling full schema", "scripts/sync-schema-to-db.mjs"],
    ["Normalizing Job data", "scripts/prod-job-column-safety.mjs"],
    // sync-schema-to-db skips FOREIGN KEY lines and never rebuilds an existing
    // table, so WarrantyClaim's constraints can only be added by rebuilding it.
    // The script is idempotent and refuses outright if the table has any rows.
    ["Adding WarrantyClaim foreign keys", "scripts/warranty-claim-foreign-keys.mjs"],
    // Same limitation, worse symptom: the commercial database still had the
    // pre-Prisma GoodsReceivedItem shape, whose NOT NULL receivedQty column the
    // code never writes, so every goods receipt failed there while care was
    // fine. Rebuilding is the only way to drop that constraint. Idempotent, and
    // migrates any legacy rows rather than dropping them.
    ["Repairing GoodsReceivedItem drift", "scripts/goods-received-item-drift.mjs"],
    // The general case of the same fault, and the net beneath the script above:
    // any table still carrying a NOT NULL column schema.prisma does not know
    // about. Where that column has no default, every insert fails and the
    // feature has never worked on that deployment — which is how complaints,
    // supplier payments, cashier shifts and group permissions all sat at zero
    // rows on commercial. Rebuilds only empty tables; reports the rest.
    ["Repairing unknown NOT NULL columns", "scripts/schema-shape-repair.mjs"],
    // Backfills Job.quotationNumber with the number each quoted job has already
    // been sending, so switching to allocated numbers cannot renumber a quote a
    // customer is holding. Idempotent; defaults to dry-run without --apply.
    ["Preserving job quotation numbers", "scripts/job-quotation-number.mjs", ["--apply"]],
  ];
  for (const [label, script, extraArgs = []] of healSteps) {
    console.log(`[vercel-build] ${label} (${script})...`);
    const heal = spawnSync("node", [script, ...extraArgs], {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });
    if (heal.status !== 0) {
      if (strict) {
        console.error(`[vercel-build] ${script} failed — aborting build so the deploy never ships against a stale schema. Set STRICT_SCHEMA_HEAL=0 to override (then run DB Fix after deploy).`);
        process.exit(heal.status ?? 1);
      }
      console.warn(`[vercel-build] ${script} did not complete cleanly; STRICT_SCHEMA_HEAL=0 set — continuing. Run DB Fix (/api/admin/db-fix) after deploy to finish.`);
    }
  }
}

// ── Step 1: prisma generate + model assertion ────────────────────────────────
// prisma.config.ts reads process.env.DATABASE_URL at PrismaClient init time,
// so we must mutate process.env directly — passing via the child's env option
// is not sufficient because Prisma v6 reads the parent's process.env.
//
// Stash the real URL, override DATABASE_URL to a valid SQLite file: URL for
// generate/assert/build. The Prisma schema provider is `sqlite`, so any Prisma
// validation that runs during `next build` must see a `file:` URL. Keep Turso
// cleared during the build process too; Vercel injects the real runtime env
// when serving the deployed app.
const realDatabaseUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "";
const buildDatabaseUrl = "file:./dev.db";

// On Vercel the build must output to .next (what Vercel serves). Off Vercel —
// i.e. the local commit gate — build into a separate dir so `next build` never
// cleans the running dev server's .next mid-session. Honor an explicit
// NEXT_DIST_DIR if the caller set one.
const gateDistDir = process.env.VERCEL ? undefined : (process.env.NEXT_DIST_DIR || ".next-gate");
if (gateDistDir) console.log(`[vercel-build] local build → ${gateDistDir} (dev server's .next left untouched)`);

const buildEnv = {
  ...process.env,
  DATABASE_URL: buildDatabaseUrl,
  TURSO_DATABASE_URL: "",
  // scripts/generate-prisma-clean.mjs does `rm -rf .next` when this is "1".
  // Off Vercel that would wipe the running dev server's cache and defeat the
  // NEXT_DIST_DIR isolation below, so clear it for the local gate. On Vercel
  // .next is the build output and there is no dev server, so leave it alone.
  ...(gateDistDir ? { CLEAR_NEXT_CACHE: "" } : {}),
  ...(gateDistDir ? { NEXT_DIST_DIR: gateDistDir } : {}),
};

process.env.DATABASE_URL    = buildDatabaseUrl;  // always valid for SQLite provider
process.env.TURSO_DATABASE_URL = "";              // prevent prisma.config.ts fallback

run("node", ["scripts/generate-prisma-clean.mjs"], { env: buildEnv });
run("node", ["scripts/assert-prisma-models.mjs"], { env: buildEnv });

// ── Step 2: migrations + Next.js build ───────────────────────────────────────
if (process.env.RUN_PRISMA_MIGRATE_DEPLOY === "1") {
  if (!realDatabaseUrl) {
    // Hard-failing here protects exactly one thing: a production deploy must
    // never ship code against a database nobody migrated. It protects nothing
    // on a preview, which has no database to migrate — and the flag is set for
    // Preview as well as Production while the Turso variables are
    // Production-only, so every preview build on the commercial project died
    // here in eight seconds. That cost the ability to check anything on a real
    // deployment before it reached the paying customers.
    //
    // Skip only where the target is positively known not to be production.
    // An unknown environment keeps the old hard failure, because "not proven to
    // be production" is not the same as "proven not to be".
    const vercelEnv = process.env.VERCEL_ENV || "";
    const knownNonProduction = vercelEnv !== "" && vercelEnv !== "production";

    if (!knownNonProduction) {
      console.error("RUN_PRISMA_MIGRATE_DEPLOY=1 requires DATABASE_URL or TURSO_DATABASE_URL.");
      process.exit(1);
    }

    console.warn(
      `[vercel-build] No DATABASE_URL/TURSO_DATABASE_URL on VERCEL_ENV=${vercelEnv}; ` +
        "skipping prisma migrate deploy. The build continues, but this deployment has no " +
        "database: pages that query one will fail at runtime. Give this environment its own " +
        "database, or clear RUN_PRISMA_MIGRATE_DEPLOY for it, to make previews fully usable.",
    );
  } else {
    process.env.DATABASE_URL = realDatabaseUrl;
    if (realDatabaseUrl.startsWith("libsql:")) {
      process.env.TURSO_DATABASE_URL = realDatabaseUrl;
    }
    run("bunx", ["prisma", "migrate", "deploy"]);
  }
}

process.env.DATABASE_URL = buildDatabaseUrl;
process.env.TURSO_DATABASE_URL = "";

run("next", ["build"], { env: buildEnv });
