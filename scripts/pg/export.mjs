/**
 * Exports the development database to a restorable file.
 *
 *   bun run pg:export                  # -> backups/mrms-dev-<timestamp>.dump
 *   bun run pg:export --out path.dump  # somewhere else
 *
 * `pg_dump -Fc`, the same custom format the production `backup` service writes,
 * so anything here restores with `pg_restore` and the two paths do not diverge.
 *
 * The file is written under backups/, which is gitignored. That is not
 * incidental: this dump contains whatever the development database contains,
 * and right now that is imported production data — real clients, real phone
 * numbers, real amounts. The script says so on the way out, with counts, so
 * nobody attaches one to a ticket on the assumption it is demo data.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const setupMode = args.includes("--setup");
const outArg = args.find((a) => a.startsWith("--out="))?.split("=")[1]
  ?? (args.includes("--out") ? args[args.indexOf("--out") + 1] : null);

// --setup writes the file a fresh `bun run dev:up` restores from, rather than a
// dated backup. Plain SQL, not -Fc, because the Postgres image runs whatever is
// in /docker-entrypoint-initdb.d through psql the first time it initialises an
// empty data directory — which is precisely "new machine, first run", with no
// script of ours involved. The dump carries the _prisma_migrations table with
// it, so `migrate deploy` afterwards finds nothing pending instead of colliding
// with tables that already exist.
const SETUP_PATH = path.join("db", "init", "01-data.sql");

const COMPOSE = ["compose", "-f", "docker-compose.dev.yml"];
const SERVICE = "postgres";
const DB = "mrms";
const USER = "mrms";

function docker(cmdArgs, opts = {}) {
  return execFileSync("docker", cmdArgs, { encoding: "utf8", ...opts });
}

/** Row counts worth printing, so the contents are never a surprise. */
function contents() {
  const sql = `SELECT
      (SELECT count(*) FROM "Client")                            AS clients,
      (SELECT count(*) FROM "Client" WHERE phone IS NOT NULL)    AS with_phone,
      (SELECT count(*) FROM "Job")                               AS jobs,
      (SELECT count(*) FROM "User")                              AS users,
      (SELECT count(*) FROM "Account" WHERE password IS NOT NULL) AS hashes`;
  try {
    const out = docker([...COMPOSE, "exec", "-T", SERVICE, "psql", "-U", USER, "-d", DB, "-t", "-A", "-F", " ", "-c", sql]);
    const [clients, withPhone, jobs, users, hashes] = out.trim().split(/\s+/).map(Number);
    return { clients, withPhone, jobs, users, hashes };
  } catch {
    return null;
  }
}

// ── Preflight ───────────────────────────────────────────────────────────────

try {
  docker([...COMPOSE, "ps", "-q", SERVICE], { stdio: ["ignore", "pipe", "pipe"] });
} catch {
  // Same as pg:anonymise: pg_dump lives in the Postgres image, so this drives
  // the containers from outside rather than running inside one.
  console.error(`
  docker is not reachable. This runs on the host, not in the app container —
  it needs the docker CLI and pg_dump, and the app image has neither.

  Start Docker, then \`bun run dev:up\`, then run this from the repository root.
`);
  process.exit(1);
}

const running = docker([...COMPOSE, "ps", "-q", SERVICE]).trim();
if (!running) {
  console.error(`\n  the "${SERVICE}" container is not running — start it with \`bun run dev:up\` (or \`bun run pg:up\`).\n`);
  process.exit(1);
}

// ── Dump ────────────────────────────────────────────────────────────────────

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
const defaultPath = setupMode ? SETUP_PATH : path.join("backups", `mrms-dev-${stamp}.dump`);
const outPath = path.resolve(process.cwd(), outArg ?? defaultPath);
mkdirSync(path.dirname(outPath), { recursive: true });

console.log(`\nEXPORT  ${DB} (container ${SERVICE})  ->  ${path.relative(process.cwd(), outPath)}`);
console.log("=".repeat(74));
if (setupMode) console.log("  mode: setup — restored automatically by the next `dev:up` on an empty volume");

const before = contents();

// --clean --if-exists so a re-run over an already-initialised database replaces
// rather than collides. Harmless on the empty one initdb.d gives us.
const format = setupMode
  ? `--format=plain --clean --if-exists --no-owner --no-privileges`
  : `-Fc`;

const dump = spawnSync(
  "sh",
  ["-c", `docker ${COMPOSE.join(" ")} exec -T ${SERVICE} pg_dump -U ${USER} -d ${DB} ${format} > ${JSON.stringify(outPath)}`],
  { stdio: ["ignore", "inherit", "inherit"] },
);

if (dump.status !== 0) {
  console.error("\n  pg_dump failed — nothing written that can be trusted. Remove the file if one was created.\n");
  process.exit(1);
}

const size = statSync(outPath).size;
console.log(`  wrote ${(size / 1024 / 1024).toFixed(1)} MB`);

if (before) {
  console.log(`\n  contents: ${before.jobs} jobs, ${before.clients} clients (${before.withPhone} with a phone number),`);
  console.log(`            ${before.users} users, ${before.hashes} password hash(es)`);
  if (before.withPhone > 0) {
    console.log("\n  This is personal data. Keep it off tickets, off chat and out of git");
    console.log("  (backups/ is gitignored). A new developer does not need it — `bun run dev:up`");
    console.log("  seeds demo data on an empty database. See docs/development.md.");
  }
}

if (setupMode) {
  console.log(`
  A new checkout now gets this database from \`bun run dev:up\`, restored by
  Postgres itself on an empty volume. Verify it the way a new machine would:

    bun run dev:reset && bun run dev:up

  It only travels with the project if this file is committed, and
  db/init/*.sql is gitignored precisely so that is a decision rather than an
  accident. See "Onboarding data" in docs/development.md.
`);
} else {
  console.log(`
  restore into a throwaway database:
    createdb -h localhost -p 5433 -U mrms restore_check
    pg_restore -h localhost -p 5433 -U mrms -d restore_check --no-owner ${path.relative(process.cwd(), outPath)}
`);
}
