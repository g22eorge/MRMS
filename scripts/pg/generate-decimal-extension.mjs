/**
 * Generates lib/prisma-decimal.ts from the numeric classification.
 *
 * Money is stored as exact `numeric` in Postgres but the application works in
 * `number`. A Prisma `result` extension is the supported way to express that:
 * it overrides each Decimal field's type *and* its runtime value, so the
 * generated client's types and what the code actually receives agree.
 *
 * Generated rather than hand-written because it is 93 near-identical blocks that
 * must stay in lockstep with docs/pg-migration/numeric-classification.json.
 *
 *   node scripts/pg/generate-decimal-extension.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";

const plan = JSON.parse(readFileSync("docs/pg-migration/numeric-classification.json", "utf8"));
const decimalFields = plan.fields.filter((f) => f.targetType === "Decimal");

const byModel = new Map();
for (const f of decimalFields) {
  const key = f.model.charAt(0).toLowerCase() + f.model.slice(1);
  if (!byModel.has(key)) byModel.set(key, []);
  byModel.get(key).push(f);
}

const blocks = [...byModel.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([model, fields]) => {
    const inner = fields
      .sort((a, b) => a.field.localeCompare(b.field))
      .map((f) => {
        const body = f.optional
          ? `r.${f.field} === null || r.${f.field} === undefined ? null : Number(r.${f.field})`
          : `Number(r.${f.field})`;
        return [
          `      ${f.field}: {`,
          `        needs: { ${f.field}: true },`,
          `        compute(r) {`,
          `          return ${body};`,
          `        },`,
          `      },`,
        ].join("\n");
      })
      .join("\n");
    return `    ${model}: {\n${inner}\n    },`;
  })
  .join("\n");

const out = `import { Prisma } from "@prisma/client";

/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/pg/generate-decimal-extension.mjs
 *
 * Maps every \`Decimal\` column to \`number\` at the Prisma boundary.
 *
 * Money is stored as exact \`numeric\` in Postgres (see
 * docs/pg-migration/numeric-classification.json: ${decimalFields.length} columns across
 * ${byModel.size} models) while the application reads and writes plain numbers. A
 * \`result\` extension is what makes those two facts consistent: it changes the
 * field's declared type as well as its value, so TypeScript and the runtime
 * agree. Without it the generated types promise \`Decimal\` while the code —
 * ~3150 references across ~197 files — treats money as \`number\`.
 *
 * Optional columns keep \`null\`; they do not become \`0\`.
 */

export const decimalToNumberExtension = Prisma.defineExtension({
  name: "decimal-to-number",
  result: {
${blocks}
  },
});
`;

writeFileSync("lib/prisma-decimal.ts", out);
console.log(`  models: ${byModel.size}`);
console.log(`  fields: ${decimalFields.length}`);
console.log("  written: lib/prisma-decimal.ts");
