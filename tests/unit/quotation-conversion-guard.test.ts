import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

import { assertOrgCanMutate } from "@/lib/org-write";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Converting a quotation into an invoice must respect the org write guard.
 *
 * All four conversion actions checked `can.createInvoices(user)` and scoped by
 * orgId — so this was never a tenancy hole. What none of them did was call
 * `assertOrgCanMutate`, which is the only thing that enforces the two states a
 * permission check cannot see:
 *
 *   - the user's accessMode is READ_ONLY
 *   - the organisation is suspended, i.e. the subscription has lapsed
 *
 * So a read-only user could raise an invoice, and a workspace that had stopped
 * paying could keep converting quotes into invoices indefinitely. For a
 * subscription product the second is the expensive half: suspension exists to
 * stop precisely this.
 *
 * It was easy to miss because it looks guarded. `deleteQuotationAction` sits in
 * the same file with the full guard, and the whole inventory surface guards
 * through helpers like requireInventoryManager(). Conversion was the one path
 * that had grown three copies and never picked it up.
 *
 * This test is written against the source rather than by executing the actions,
 * because they are inline server actions inside page components and cannot be
 * imported. That is a weaker check than calling them — it proves the guard is
 * present, not that it fires — so it is paired with the behavioural assertions
 * on assertOrgCanMutate itself below.
 */

const CONVERSION_SITES = [
  "app/(app)/documents/quotations/page.tsx",
  "app/(app)/documents/quotations/[id]/page.tsx",
  "app/(app)/sales/quotations/[id]/page.tsx",
];

/** The body of one `async function <name>(` up to the next function in the file. */
function actionBody(src: string, name: string): string | null {
  const m = new RegExp(`async function ${name}\\s*\\(`).exec(src);
  if (!m) return null;
  const rest = src.slice(m.index + m[0].length);
  const next = rest.search(/\n\s*(?:export )?async function \w+\s*\(/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe("quotation to invoice conversion is guarded", () => {
  it("finds every conversion action, so the list cannot silently shrink", () => {
    // Guards the guard: if a file is renamed and this list is not updated, the
    // suite would pass while checking nothing.
    for (const f of CONVERSION_SITES) {
      const src = readFileSync(f, "utf8");
      expect(src).toContain("convertToInvoiceAction");
    }
  });

  it("every conversion action calls assertOrgCanMutate", () => {
    const unguarded: string[] = [];
    for (const f of CONVERSION_SITES) {
      const src = readFileSync(f, "utf8");
      for (const name of ["convertToInvoiceAction", "acceptAndInvoiceAction"]) {
        const body = actionBody(src, name);
        if (!body) continue;
        if (!body.includes("assertOrgCanMutate")) unguarded.push(`${f}:${name}`);
      }
    }
    expect(unguarded).toEqual([]);
  });

  it("guards with kind GENERAL, not PAYMENT", () => {
    // PAYMENT is the escape hatch that lets a suspended workspace still record
    // money coming in. Raising an invoice is not that, and labelling it PAYMENT
    // would re-open the hole while looking guarded.
    for (const f of CONVERSION_SITES) {
      const src = readFileSync(f, "utf8");
      for (const name of ["convertToInvoiceAction", "acceptAndInvoiceAction"]) {
        const body = actionBody(src, name);
        if (!body || !body.includes("assertOrgCanMutate")) continue;
        expect(body).toContain('kind: "GENERAL"');
      }
    }
  });

  it("reads org access from the live session, not from a render-time closure", () => {
    // The same reasoning deleteQuotationAction documents: a closure holds what
    // was true when the page rendered, so a workspace suspended since then
    // would still convert from a tab left open.
    for (const f of CONVERSION_SITES) {
      const src = readFileSync(f, "utf8");
      for (const name of ["convertToInvoiceAction", "acceptAndInvoiceAction"]) {
        const body = actionBody(src, name);
        if (!body || !body.includes("assertOrgCanMutate")) continue;
        expect(body).toContain("await requireOrgSession()");
      }
    }
  });
});

describe("the guard being asserted actually refuses", () => {
  // Behavioural cover for the source-level checks above: those prove the call
  // is present, these prove the call means something.
  const open = { isSuspended: false } as never;

  it("refuses a read-only user on a healthy workspace", () => {
    expect(() =>
      assertOrgCanMutate({ access: open, userRole: "ADMIN", userAccessMode: "READ_ONLY", kind: "GENERAL" }),
    ).toThrow(/read-only/i);
  });

  it("refuses a full-access user on a suspended workspace", () => {
    expect(() =>
      assertOrgCanMutate({
        access: { isSuspended: true } as never,
        userRole: "ADMIN",
        userAccessMode: "FULL",
        kind: "GENERAL",
      }),
    ).toThrow();
  });

  it("allows a full-access user on a healthy workspace", () => {
    expect(() =>
      assertOrgCanMutate({ access: open, userRole: "ADMIN", userAccessMode: "FULL", kind: "GENERAL" }),
    ).not.toThrow();
  });
});

describe("no other quotation surface grows an unguarded conversion", () => {
  function tsFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) tsFiles(full, out);
      else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(full);
    }
    return out;
  }

  it("scans the whole app for conversion actions, not just the known three", () => {
    // The defect existed in three copies of the same action. A fourth copy is
    // the obvious way for it to come back.
    const offenders: string[] = [];
    for (const f of tsFiles("app")) {
      const src = readFileSync(f, "utf8");
      if (!/async function (convertToInvoice|acceptAndInvoice)\w*Action/.test(src)) continue;
      for (const name of ["convertToInvoiceAction", "acceptAndInvoiceAction"]) {
        const body = actionBody(src, name);
        if (body && !body.includes("assertOrgCanMutate")) offenders.push(`${f}:${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
