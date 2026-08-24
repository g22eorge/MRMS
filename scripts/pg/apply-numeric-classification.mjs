/**
 * Applies docs/pg-migration/numeric-classification.json to prisma/schema.prisma.
 *
 * Rewrites each classified `Float` field to its target Prisma type and adds the
 * explicit `@db.Decimal(precision, scale)` native attribute. Done as a script
 * rather than 92 hand edits so the change is reproducible, reviewable against
 * the classification file, and cannot silently disagree with it.
 *
 *   node scripts/pg/apply-numeric-classification.mjs [--dry]
 */

import { readFileSync, writeFileSync } from "node:fs";

const dry = process.argv.includes("--dry");
const SCHEMA = "prisma/schema.prisma";
const plan = JSON.parse(readFileSync("docs/pg-migration/numeric-classification.json", "utf8"));

const lines = readFileSync(SCHEMA, "utf8").split("\n");

// Track which model each line belongs to so a field name that appears in
// several models is rewritten with that model's own classification.
let currentModel = null;
const applied = [];
const skipped = [];

const byKey = new Map(plan.fields.map((f) => [`${f.model}.${f.field}`, f]));

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];

  const modelStart = /^model\s+(\w+)\s*\{/.exec(line);
  if (modelStart) { currentModel = modelStart[1]; continue; }
  if (/^\}/.test(line)) { currentModel = null; continue; }
  if (!currentModel) continue;

  // `  fieldName   Float?  @default(0) // comment`
  const m = /^(\s+)(\w+)(\s+)Float(\??)(.*)$/.exec(line);
  if (!m) continue;

  const [, indent, field, gap, optional, rest] = m;
  const spec = byKey.get(`${currentModel}.${field}`);
  if (!spec) { skipped.push(`${currentModel}.${field} (not in classification)`); continue; }
  if (spec.targetType === "Float") { skipped.push(`${currentModel}.${field} (stays Float: ${spec.class})`); continue; }

  // Insert the native type attribute before any existing attributes/comment,
  // keeping @default and trailing comments intact.
  const trimmedRest = rest.trimStart();
  const restGap = trimmedRest ? rest.slice(0, rest.length - trimmedRest.length) || " " : "";
  const newRest = trimmedRest ? `${spec.native}${restGap}${trimmedRest}` : spec.native;

  lines[i] = `${indent}${field}${gap}${spec.targetType}${optional} ${newRest}`;
  applied.push(`${currentModel}.${field} -> ${spec.targetType} ${spec.native}`);
}

console.log(`\nAPPLY NUMERIC CLASSIFICATION${dry ? "  (dry run)" : ""}`);
console.log("=".repeat(70));
console.log(`  rewritten: ${applied.length}`);
console.log(`  left as Float: ${skipped.filter((s) => s.includes("stays Float")).length}`);
const unknown = skipped.filter((s) => s.includes("not in classification"));
if (unknown.length) {
  console.log(`\n  !! Float fields with no classification entry (${unknown.length}):`);
  for (const u of unknown) console.log(`     ${u}`);
}

const expected = plan.fields.filter((f) => f.targetType !== "Float").length;
if (applied.length !== expected) {
  console.error(`\n  MISMATCH: classification expects ${expected} rewrites, applied ${applied.length}`);
  process.exit(1);
}

if (!dry) {
  writeFileSync(SCHEMA, lines.join("\n"));
  console.log(`\n  written: ${SCHEMA}\n`);
} else {
  console.log("\n  (dry run — nothing written)\n");
}
