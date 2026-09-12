/**
 * Produces the test variant of prisma/schema.prisma, pointing at prisma/test.db.
 *
 * The problem this solves has now been got wrong twice, so it is worth stating
 * exactly. `test:unit` exports DATABASE_URL=prisma/test.db, and until this
 * script existed the tests still ran against prisma/dev.db — the database
 * somebody is working in — with `--accept-data-loss` pointed at it.
 *
 * The obvious fix, making the datasource read env("DATABASE_URL"), broke every
 * deploy on both projects: vercel-build hands Prisma a libsql:// URL for
 * `prisma migrate deploy`, and the sqlite provider rejects any env value that
 * is not file:. So the source schema's url has to stay a file: literal.
 *
 * A literal is also what the CLI obeys — `db push` follows the schema, not the
 * environment — which is why pointing only the runtime client at test.db is not
 * enough either: the client opens a database the push never created, and every
 * database-touching test fails.
 *
 * Both halves therefore have to move together, and this is the half the CLI
 * reads. The other half is lib/prisma.ts, which passes datasourceUrl. The
 * generated client itself is deliberately NOT built from this file — it lives
 * in node_modules and is shared with `bun run dev`, so baking test.db into it
 * would point the dev server at the test database.
 *
 *   node scripts/test-schema.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "prisma/schema.prisma";
const TARGET = "prisma/schema.test.prisma";

const HEADER = `// GENERATED FILE — DO NOT EDIT, and do not commit.
//
// Produced from ${SOURCE} by scripts/test-schema.mjs, and regenerated on every
// test run. Identical to the source except that the datasource points at
// prisma/test.db, so \`prisma db push\` builds the throwaway database rather
// than the one being worked in.
`;

const source = readFileSync(SOURCE, "utf8");

// If the source stops naming a file: literal, this script's assumption is gone
// and so is the reason it can exist at all. Fail rather than emit something
// that quietly targets the wrong database — that is the bug being fixed.
const url = source.match(/url\s*=\s*"(file:[^"]*)"/);
if (!url) {
  console.error(`[test-schema] ${SOURCE} does not declare a file: literal for its datasource url.`);
  console.error("[test-schema] that literal is what the CLI follows, and what this rewrites. Check the datasource block.");
  process.exit(1);
}
if (!/provider\s*=\s*"sqlite"/.test(source)) {
  console.error(`[test-schema] ${SOURCE} is not on the sqlite provider; this script only knows that shape.`);
  process.exit(1);
}

writeFileSync(TARGET, HEADER + source.replace(/url\s*=\s*"file:[^"]*"/, 'url      = "file:./test.db"'));
console.log(`[test-schema] wrote ${TARGET} — datasource points at prisma/test.db (source unchanged at ${url[1]}).`);
