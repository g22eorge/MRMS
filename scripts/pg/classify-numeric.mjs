/**
 * Classifies every Float field in schema.prisma into the numeric class it
 * should become under Postgres.
 *
 * SQLite has one numeric type (REAL), so the schema could not distinguish
 * "money" from "GPS latitude". Postgres can, and the owner has asked for exact
 * money, so each field needs a deliberate target type. This script proposes the
 * classification from field/model naming and writes it out for review; Phase 2
 * applies the reviewed file to the schema.
 *
 *   node scripts/pg/classify-numeric.mjs [--write]
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { parseSchema } from "./schema-model.mjs";

/**
 * Target classes.
 *  money    exact currency amounts -> Decimal(18, 2)
 *  rate     multipliers / percentages -> Decimal(12, 6)
 *  factor   unit-of-measure conversion factors -> Decimal(18, 6)
 *  quantity stock quantities, which are fractional in this schema -> Decimal(18, 3)
 *  measure  physical or statistical values where float is correct -> stays Float
 */
const CLASSES = {
  money:    { prismaType: "Decimal", native: "@db.Decimal(18, 2)" },
  rate:     { prismaType: "Decimal", native: "@db.Decimal(12, 6)" },
  factor:   { prismaType: "Decimal", native: "@db.Decimal(18, 6)" },
  quantity: { prismaType: "Decimal", native: "@db.Decimal(18, 3)" },
  measure:  { prismaType: "Float",   native: null },
};

/** Explicit overrides win over the name heuristics below. */
const OVERRIDES = {
  "FieldVisit.gpsLat": "measure",
  "FieldVisit.gpsLng": "measure",
  // A generic metric bucket: holds counts, byte totals and money depending on
  // the `metric` discriminator, so it cannot be a fixed-scale decimal.
  "OrgUsageSnapshot.value": "measure",
  // A plan limit (seats, jobs, storage) — a count, not an amount.
  "OrgFeatureEntitlement.limitValue": "measure",
  // Timeline confidence/duration style fields are counts, handled as Int already.
  "Part.qtyOnHand": "quantity",
  "PartStockTransaction.quantity": "quantity",
  "InvoiceLine.quantity": "quantity",
  "RecurringInvoiceItem.quantity": "quantity",
  // Percent, stored as a percentage number (e.g. 18 for 18%).
  "DocumentBrandingSettings.vatRatePercent": "rate",
  // SalesTarget.targetValue/actualValue track whatever the target's metric is
  // (revenue or unit count), so keep them float like OrgUsageSnapshot.value.
  "SalesTarget.targetValue": "measure",
  "SalesTarget.actualValue": "measure",
  // QuotationItem.discount is an amount off the line, not a percentage.
  "QuotationItem.discount": "money",
};

const RATE_NAMES = /^(exchangeRateToBase|taxRate|rate)$/;
const FACTOR_NAMES = /UomFactor$/;

function classify(model, field) {
  const key = `${model}.${field}`;
  if (OVERRIDES[key]) return OVERRIDES[key];
  if (RATE_NAMES.test(field)) return "rate";
  if (FACTOR_NAMES.test(field)) return "factor";
  // Everything else in this schema's Float set is currency: amounts, totals,
  // prices, costs, balances, floats of cash, debits and credits.
  return "money";
}

const { models } = parseSchema();
const out = { generatedAt: new Date().toISOString(), classes: CLASSES, fields: [] };

for (const [modelName, model] of models) {
  for (const col of model.columns.values()) {
    if (col.type !== "Float") continue;
    const cls = classify(modelName, col.field);
    out.fields.push({
      model: modelName,
      field: col.field,
      column: col.column,
      optional: col.optional,
      class: cls,
      targetType: CLASSES[cls].prismaType,
      native: CLASSES[cls].native,
    });
  }
}

const byClass = out.fields.reduce((acc, f) => {
  acc[f.class] = (acc[f.class] ?? 0) + 1;
  return acc;
}, {});

console.log(`\nNUMERIC CLASSIFICATION  (${out.fields.length} Float fields)`);
console.log("=".repeat(70));
for (const [cls, n] of Object.entries(byClass)) {
  const c = CLASSES[cls];
  console.log(`  ${String(n).padStart(4)}  ${cls.padEnd(9)} -> ${c.prismaType}${c.native ? " " + c.native : " (unchanged)"}`);
}
for (const cls of Object.keys(CLASSES)) {
  const fields = out.fields.filter((f) => f.class === cls);
  if (!fields.length || cls === "money") continue;
  console.log(`\n  ${cls}:`);
  for (const f of fields) console.log(`    ${f.model}.${f.field}${f.optional ? "?" : ""}`);
}

if (process.argv.includes("--write")) {
  const p = path.join("docs", "pg-migration", "numeric-classification.json");
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`\n  written: ${p}\n`);
} else {
  console.log("\n  (pass --write to save docs/pg-migration/numeric-classification.json)\n");
}
