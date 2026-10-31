/**
 * Shared environment for the QA scripts that build the app and spawn a server.
 *
 * Two things they all need to agree on:
 *
 *  - **Which build directory.** `bun run build` writes to `.next-gate` when it
 *    is not running in CI, so it never cleans a running dev server's `.next`.
 *    A script that then starts the server against `.next` finds no build and
 *    fails with "Could not find a production build". Both halves have to use the
 *    same directory, so it is set here and exported through the environment.
 *
 *  - **Which database.** They each defaulted to `file:./dev.db`, which no longer
 *    exists as a database. The default is now the scratch Postgres container, so
 *    a QA run cannot touch the development database either.
 */

/** Build directory for a QA run. Separate from `.next` and `.next-gate`. */
export const QA_DIST_DIR = process.env.NEXT_DIST_DIR ?? ".next-qa";

/** The scratch container from docker-compose.dev.yml. */
export const QA_DATABASE_URL =
  process.env.DATABASE_URL
  ?? "postgresql://mrms:mrms_dev_password@localhost:5434/mrms_scratch?schema=public";

/**
 * Applies both to `process.env`, so a child spawned with `...process.env`
 * inherits them. Call once at the top of a QA script.
 */
export function applyQaEnv() {
  process.env.NEXT_DIST_DIR = QA_DIST_DIR;
  process.env.DATABASE_URL = QA_DATABASE_URL;
  return { distDir: QA_DIST_DIR, databaseUrl: QA_DATABASE_URL };
}
