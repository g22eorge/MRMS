import { describe, it, expect } from "bun:test";

import { healDocumentNumbers } from "@/lib/document-number-heal";
import type { Db } from "@/lib/prisma";

type Seq = { orgId: string; type: string; year: number; month: number; value: number };

/**
 * A stand-in for the client with just what the heal touches. `$queryRaw` is
 * called twice, in order: numbers in use, then clashing invoice numbers.
 */
function fakeDb(state: {
  inUse: Array<{ orgId: string; type: string; year: number; month: number; max: number }>;
  sequences: Seq[];
  clashes?: Array<{ jobId: string; jobNumber: string; orgId: string; invoiceNumber: string; invoiceIssuedAt: Date | null; createdById: string }>;
  invoiceNumbers?: string[];
  jobInvoiceNumbers?: Record<string, string>;
}) {
  const audit: Array<{ action: string; detail: string; userId: string }> = [];
  const jobNumbers = state.jobInvoiceNumbers ?? {};
  const find = (k: Omit<Seq, "value">) =>
    state.sequences.find((s) => s.orgId === k.orgId && s.type === k.type && s.year === k.year && s.month === k.month);
  let rawCalls = 0;

  const db = {
    $queryRaw: async () => ((rawCalls += 1) === 1 ? state.inUse : (state.clashes ?? [])),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    documentBrandingSettings: { findFirst: async () => ({ quotePrefix: "EIS", sequencePadLength: 4 }) },
    documentSequence: {
      findUnique: async ({ where }: { where: { orgId_type_year_month: Omit<Seq, "value"> } }) => {
        const row = find(where.orgId_type_year_month);
        return row ? { value: row.value } : null;
      },
      updateMany: async ({ where, data }: { where: Omit<Seq, "value"> & { value: { lt: number } }; data: { value: number } }) => {
        const row = find(where);
        if (row && row.value < where.value.lt) row.value = data.value;
        return { count: row ? 1 : 0 };
      },
      upsert: async ({ where, create, update }: {
        where: { orgId_type_year_month: Omit<Seq, "value"> };
        create: Seq;
        update: { value?: { increment: number } };
      }) => {
        const row = find(where.orgId_type_year_month);
        if (!row) {
          state.sequences.push({ ...create });
          return { value: create.value };
        }
        if (update.value) row.value += update.value.increment;
        return { value: row.value };
      },
    },
    invoice: {
      findFirst: async ({ where }: { where: { invoiceNumber: string } }) =>
        (state.invoiceNumbers ?? []).includes(where.invoiceNumber) ? { id: "inv" } : null,
    },
    job: {
      findFirst: async ({ where }: { where: { invoiceNumber: string } }) =>
        Object.values(jobNumbers).includes(where.invoiceNumber) ? { id: "job" } : null,
      findUnique: async ({ where }: { where: { id: string } }) => ({ invoiceNumber: jobNumbers[where.id] ?? null }),
      update: async ({ where, data }: { where: { id: string }; data: { invoiceNumber: string } }) => {
        jobNumbers[where.id] = data.invoiceNumber;
      },
    },
    auditLog: {
      create: async ({ data }: { data: { action: string; detail: string; userId: string } }) => {
        audit.push(data);
      },
    },
  };
  return { db: db as unknown as Db, audit, jobNumbers };
}

const nov = { orgId: "org-heal", type: "INV", year: 2026, month: 11 };

describe("healDocumentNumbers: counters", () => {
  it("raises a counter that is behind and creates one that is missing", async () => {
    const sequences: Seq[] = [{ ...nov, value: 2 }];
    const { db } = fakeDb({
      inUse: [{ ...nov, max: 4 }, { ...nov, type: "JOB", max: 3 }],
      sequences,
    });
    const result = await healDocumentNumbers(db);
    expect(result.countersRaised).toBe(2);
    expect(sequences.find((s) => s.type === "INV")?.value).toBe(4);
    expect(sequences.find((s) => s.type === "JOB")?.value).toBe(3);
  });

  it("never lowers a counter that is already ahead", async () => {
    const sequences: Seq[] = [{ ...nov, value: 9 }];
    const { db } = fakeDb({ inUse: [{ ...nov, max: 4 }], sequences });
    const result = await healDocumentNumbers(db);
    expect(result.countersBehind).toEqual([]);
    expect(sequences[0].value).toBe(9);
  });

  it("reports without writing on a dry run", async () => {
    const sequences: Seq[] = [{ ...nov, value: 2 }];
    const { db } = fakeDb({ inUse: [{ ...nov, max: 4 }], sequences });
    const result = await healDocumentNumbers(db, { dryRun: true });
    expect(result.countersBehind).toEqual([{ ...nov, from: 2, to: 4 }]);
    expect(result.countersRaised).toBe(0);
    expect(sequences[0].value).toBe(2);
  });
});

describe("healDocumentNumbers: one invoice number on two documents", () => {
  const clash = {
    jobId: "job-1",
    jobNumber: "EIS/JOB/2026/10/0009",
    orgId: "org-heal",
    invoiceNumber: "EIS/INV/2026/11/0001",
    invoiceIssuedAt: new Date("2026-11-02T09:00:00.000Z"),
    createdById: "user-creator",
  };

  it("leaves the invoice its number, renumbers the job and records it", async () => {
    const { db, audit, jobNumbers } = fakeDb({
      inUse: [{ ...nov, max: 4 }],
      sequences: [{ ...nov, value: 2 }],
      clashes: [clash],
      invoiceNumbers: ["EIS/INV/2026/11/0001", "EIS/INV/2026/11/0002"],
      jobInvoiceNumbers: { "job-1": "EIS/INV/2026/11/0001", "job-3": "EIS/INV/2026/11/0003", "job-4": "EIS/INV/2026/11/0004" },
    });
    const result = await healDocumentNumbers(db);
    expect(result.invoiceNumbersReassigned).toBe(1);
    expect(jobNumbers["job-1"]).toBe("EIS/INV/2026/11/0005");
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("DATA_HEAL_INVOICE_RENUMBERED");
    expect(audit[0].userId).toBe("user-creator");
    expect(JSON.parse(audit[0].detail)).toMatchObject({ from: "EIS/INV/2026/11/0001", to: "EIS/INV/2026/11/0005" });
  });

  it("changes nothing on a dry run", async () => {
    const { db, audit, jobNumbers } = fakeDb({
      inUse: [],
      sequences: [{ ...nov, value: 4 }],
      clashes: [clash],
      invoiceNumbers: ["EIS/INV/2026/11/0001"],
      jobInvoiceNumbers: { "job-1": "EIS/INV/2026/11/0001" },
    });
    const result = await healDocumentNumbers(db, { dryRun: true });
    expect(result.duplicateInvoiceNumbers).toEqual([
      { jobId: "job-1", jobNumber: "EIS/JOB/2026/10/0009", from: "EIS/INV/2026/11/0001", to: null },
    ]);
    expect(jobNumbers["job-1"]).toBe("EIS/INV/2026/11/0001");
    expect(audit).toHaveLength(0);
  });

  it("skips a job the app has already renumbered", async () => {
    const { db, audit } = fakeDb({
      inUse: [],
      sequences: [{ ...nov, value: 6 }],
      clashes: [clash],
      invoiceNumbers: ["EIS/INV/2026/11/0001"],
      jobInvoiceNumbers: { "job-1": "EIS/INV/2026/11/0006" },
    });
    const result = await healDocumentNumbers(db);
    expect(result.invoiceNumbersReassigned).toBe(0);
    expect(audit).toHaveLength(0);
  });
});
