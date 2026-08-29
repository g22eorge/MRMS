/**
 * Produces the PostgreSQL variant of prisma/schema.prisma.
 *
 * Prisma will not take an env() for `provider` — it has to be a literal — so a
 * codebase that can run on two engines needs two schema files, and the second
 * one has to be generated rather than hand-kept or it drifts the first time
 * somebody adds a model and only edits the one they were looking at.
 *
 * The good news, and the reason this script is fifteen lines of actual work
 * rather than a translator: schema.prisma uses no native type attributes, no
 * dbgenerated defaults, and no Json, Bytes or Decimal fields. Plain scalars,
 * relations, and 59 enums — which Prisma stores as TEXT under SQLite and as
 * real enum types under PostgreSQL, from the same declaration. So the provider
 * line is the whole difference between the two engines.
 *
 * That is worth stating because it is a property that can be lost. Add a
 * `@db.VarChar(50)` or a `Json` column and this stops being a one-line swap;
 * the assertion below is what makes that visible instead of silent.
 *
 *   node scripts/pg-schema.mjs           # write prisma/schema.postgresql.prisma
 *   node scripts/pg-schema.mjs --check   # verify it matches, non-zero if stale
 *
 * --check is the one that matters in CI. A generated file nobody regenerates is
 * worse than no file, because it looks authoritative while describing an older
 * database.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "prisma/schema.prisma";
const TARGET = "prisma/schema.postgresql.prisma";
const CHECK_ONLY = process.argv.includes("--check");

const HEADER = `// GENERATED FILE — DO NOT EDIT.
//
// Produced from ${SOURCE} by scripts/pg-schema.mjs. Edit the source and
// regenerate; edits made here are overwritten without warning.
//
// Exists because Prisma requires a literal datasource provider, so supporting
// both engines needs two files. Everything below is identical to the source
// except the provider.
`;

const source = readFileSync(SOURCE, "utf8");

// Fail loudly rather than emit something subtly wrong. If the source provider
// is not what this expects, the assumption this script rests on has changed.
if (!/provider\s*=\s*"sqlite"/.test(source)) {
  console.error(`[pg-schema] ${SOURCE} does not declare provider = "sqlite".`);
  console.error("[pg-schema] this script only knows how to translate that. Check the datasource block.");
  process.exit(1);
}

// These are the features that would make the translation more than a provider
// swap. None is present today; if one appears, say so rather than emit a schema
// that validates and then behaves differently on the two engines.
const DIALECT_SENSITIVE = [
  [/@db\./, "native type attributes (@db.*) are engine-specific"],
  [/dbgenerated\s*\(/, "dbgenerated() defaults are written in the engine's own SQL"],
  [/^\s*\w+\s+Json(\?|\[\])?\s/m, "Json columns differ between the two engines"],
  [/^\s*\w+\s+Bytes(\?|\[\])?\s/m, "Bytes columns differ between the two engines"],
  [/^\s*\w+\s+Decimal(\?|\[\])?\s/m, "Decimal has no true SQLite equivalent"],
];
const found = DIALECT_SENSITIVE.filter(([re]) => re.test(source));
if (found.length) {
  console.error("[pg-schema] the source schema now uses features this script cannot translate by swapping the provider:");
  for (const [, why] of found) console.error(`  - ${why}`);
  console.error("[pg-schema] the two schemas need reconciling by hand before this can be trusted.");
  process.exit(1);
}

const generated = HEADER + source.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');

if (CHECK_ONLY) {
  let current = null;
  try {
    current = readFileSync(TARGET, "utf8");
  } catch {
    console.error(`[pg-schema] ${TARGET} does not exist. Run: node scripts/pg-schema.mjs`);
    process.exit(1);
  }
  if (current !== generated) {
    console.error(`[pg-schema] ${TARGET} is stale — ${SOURCE} has changed since it was generated.`);
    console.error("[pg-schema] regenerate with: node scripts/pg-schema.mjs");
    process.exit(1);
  }
  console.log(`[pg-schema] ${TARGET} is up to date.`);
  process.exit(0);
}

writeFileSync(TARGET, generated);
const models = (source.match(/^model /gm) ?? []).length;
const enums = (source.match(/^enum /gm) ?? []).length;
console.log(`[pg-schema] wrote ${TARGET} — ${models} models, ${enums} enums, provider postgresql.`);
