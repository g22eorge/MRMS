// Check required Prisma models exist in the generated client using the DMMF
// (Data Model Meta Format) — zero database connection, no URL validation.
// PrismaClient instantiation triggers Prisma's runtime schema check against
// DATABASE_URL. With a postgresql provider no connection is needed to read
// the generated client, so this runs without a reachable database.
import { Prisma } from "@prisma/client";

const requiredModels = [
  "supplier",
  "stockLocation",
  "stockTransfer",
  "purchaseRequest",
  "purchaseOrder",
  "goodsReceived",
  "supplierBill",
  "supplierPayment",
  "stockCount",
  "recurringExpense",
  "expensePayment",
];

// Field-level pins: a client generated from an older schema passes the model
// check above but crashes at runtime with PrismaClientValidationError on the
// first select of a new column (exactly what happened with Expense.paidAmount
// on the Payables page). Pin the hot fields so staleness fails the build.
const requiredFields = {
  Expense: ["paidAmount", "dueAt"],
  BankAccount: ["ledgerCode"],
};

// Read generated model names from DMMF — no DB connection needed
const generatedModels = new Set(
  Prisma.dmmf.datamodel.models.map(
    (m) => m.name.charAt(0).toLowerCase() + m.name.slice(1)
  )
);

const missing = requiredModels.filter((model) => !generatedModels.has(model));

const fieldsByModel = new Map(
  Prisma.dmmf.datamodel.models.map((m) => [m.name, new Set(m.fields.map((f) => f.name))]),
);
const missingFields = [];
for (const [model, fields] of Object.entries(requiredFields)) {
  const available = fieldsByModel.get(model);
  if (!available) {
    missingFields.push(`${model} (model missing)`);
    continue;
  }
  for (const field of fields) {
    if (!available.has(field)) missingFields.push(`${model}.${field}`);
  }
}

if (missing.length > 0 || missingFields.length > 0) {
  if (missing.length > 0) {
    console.error(`Generated Prisma Client is missing required models: ${missing.join(", ")}`);
  }
  if (missingFields.length > 0) {
    console.error(`Generated Prisma Client is missing required fields: ${missingFields.join(", ")}`);
  }
  console.error("Run `bunx prisma generate` from the current schema before building/deploying.");
  process.exit(1);
}

console.log(`✓ All ${requiredModels.length} required Prisma models and ${Object.values(requiredFields).flat().length} pinned fields present.`);
