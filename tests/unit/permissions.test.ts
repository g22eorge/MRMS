import { describe, it, expect, afterEach } from "bun:test";
import { can, asPermissionUser } from "../../lib/permissions";
import type { PermissionUser } from "../../lib/permissions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function user(role: PermissionUser["role"], permissions?: string[]): PermissionUser {
  return { role, permissions };
}


// ── can.viewClientInfo() ──────────────────────────────────────────────────────

describe("can.viewClientInfo()", () => {
  it("permits ADMIN, OPS, SALES, FRONT_DESK, and manager roles", () => {
    for (const role of ["ADMIN", "OPS", "SALES", "FRONT_DESK", "TECH_MANAGER", "SALES_MANAGER"] as const) {
      expect(can.viewClientInfo(user(role))).toBe(true);
    }
  });

  it("denies TECHNICIAN_INTERNAL and TECHNICIAN_EXTERNAL by default", () => {
    expect(can.viewClientInfo(user("TECHNICIAN_INTERNAL"))).toBe(false);
    expect(can.viewClientInfo(user("TECHNICIAN_EXTERNAL"))).toBe(false);
  });

  it("grants TECHNICIAN_INTERNAL via can_intake extra permission", () => {
    expect(can.viewClientInfo(user("TECHNICIAN_INTERNAL", ["can_intake"]))).toBe(true);
  });
});

// ── can.viewFinancials() ──────────────────────────────────────────────────────

describe("can.viewFinancials()", () => {
  it("permits ADMIN, OPS, TECH_MANAGER, SALES_MANAGER", () => {
    for (const role of ["ADMIN", "MANAGER", "OPS", "FINANCE", "FRONT_DESK", "SALES_MANAGER"] as const) {
      expect(can.viewFinancials(user(role))).toBe(true);
    }
  });

  it("denies TECHNICIAN_EXTERNAL by default", () => {
    expect(can.viewFinancials(user("TECHNICIAN_EXTERNAL"))).toBe(false);
  });

  it("keeps TECHNICIAN_EXTERNAL denied despite can_approve_invoices", () => {
    expect(can.viewFinancials(user("TECHNICIAN_EXTERNAL", ["can_approve_invoices"]))).toBe(false);
  });

  it("grants TECHNICIAN_INTERNAL via can_review_external_bills", () => {
    expect(can.viewFinancials(user("TECHNICIAN_INTERNAL", ["can_review_external_bills"]))).toBe(true);
  });
});

// ── can.editDiagnosis() ───────────────────────────────────────────────────────

describe("can.editDiagnosis()", () => {
  it("permits internal technicians and admins", () => {
    for (const role of ["ADMIN", "MANAGER", "TECH_MANAGER", "TECHNICIAN_INTERNAL", "TECH_FIELD"] as const) {
      expect(can.editDiagnosis(user(role))).toBe(true);
    }
  });

  it("permits TECHNICIAN_EXTERNAL (they submit external diagnosis)", () => {
    expect(can.editDiagnosis(user("TECHNICIAN_EXTERNAL"))).toBe(true);
  });

  it("denies SALES by default", () => {
    expect(can.editDiagnosis(user("SALES"))).toBe(false);
  });

  it("grants SALES via can_run_internal_repairs", () => {
    expect(can.editDiagnosis(user("SALES", ["can_run_internal_repairs"]))).toBe(true);
  });
});

// ── can.manageUsers() ─────────────────────────────────────────────────────────

describe("can.manageUsers()", () => {
  it("permits ADMIN", () => {
    expect(can.manageUsers(user("ADMIN"))).toBe(true);
  });

  it("denies every non-ADMIN role", () => {
    for (const role of ["MANAGER", "OPS", "SALES", "FRONT_DESK", "FINANCE", "TECH_MANAGER", "TECHNICIAN_INTERNAL", "TECHNICIAN_EXTERNAL"] as const) {
      expect(can.manageUsers(user(role))).toBe(false);
    }
  });

  it("is ADMIN-only — no extra permission can grant it", () => {
    expect(can.manageUsers(user("OPS", ["platform_admin"]))).toBe(false);
  });
});

// ── can.searchJobs() ─────────────────────────────────────────────────────────

describe("can.searchJobs()", () => {
  it("permits all roles except TECHNICIAN_EXTERNAL", () => {
    for (const role of ["ADMIN", "OPS", "SALES", "FRONT_DESK", "TECHNICIAN_INTERNAL", "CASHIER"] as const) {
      expect(can.searchJobs(user(role))).toBe(true);
    }
  });

  it("denies TECHNICIAN_EXTERNAL by default", () => {
    expect(can.searchJobs(user("TECHNICIAN_EXTERNAL"))).toBe(false);
  });

  it("keeps TECHNICIAN_EXTERNAL denied despite can_search_jobs", () => {
    expect(can.searchJobs(user("TECHNICIAN_EXTERNAL", ["can_approve_invoices"]))).toBe(false);
  });
});

// ── can.manageInventory() ─────────────────────────────────────────────────────

describe("can.manageInventory()", () => {
  it("permits OPS-tier roles", () => {
    for (const role of ["ADMIN", "MANAGER", "OPS", "TECH_MANAGER"] as const) {
      expect(can.manageInventory(user(role))).toBe(true);
    }
  });

  it("denies non-OPS roles", () => {
    for (const role of ["SALES", "FRONT_DESK", "TECHNICIAN_INTERNAL", "TECHNICIAN_EXTERNAL"] as const) {
      expect(can.manageInventory(user(role))).toBe(false);
    }
  });
});

// ── can.approveInvoices() ─────────────────────────────────────────────────────

describe("can.approveInvoices()", () => {
  it("permits ADMIN, TECH_MANAGER, SALES_MANAGER", () => {
    for (const role of ["ADMIN", "TECH_MANAGER", "SALES_MANAGER"] as const) {
      expect(can.approveInvoices(user(role))).toBe(true);
    }
  });

  it("allows OPS (OPS is in the allowlist)", () => {
    expect(can.approveInvoices(user("OPS"))).toBe(true);
  });

  it("grants OPS via can_approve_invoices", () => {
    expect(can.approveInvoices(user("OPS", ["can_approve_invoices"]))).toBe(true);
  });
});

// ── can.overrideDiscount() ────────────────────────────────────────────────────

describe("can.overrideDiscount()", () => {
  it("permits only ADMIN and SALES_MANAGER", () => {
    expect(can.overrideDiscount(user("ADMIN"))).toBe(true);
    expect(can.overrideDiscount(user("SALES_MANAGER"))).toBe(true);
  });

  it("denies TECH_MANAGER, OPS, and lower roles", () => {
    for (const role of ["OPS", "TECH_MANAGER", "SALES", "CASHIER", "FRONT_DESK"] as const) {
      expect(can.overrideDiscount(user(role))).toBe(false);
    }
  });
});

// ── asPermissionUser() helper ─────────────────────────────────────────────────

describe("asPermissionUser()", () => {
  it("returns an object with the given role and permissions", () => {
    const u = asPermissionUser("OPS", ["can_intake"]);
    expect(u.role).toBe("OPS");
    expect(u.permissions).toEqual(["can_intake"]);
  });

  it("returns an object with undefined permissions when not provided", () => {
    const u = asPermissionUser("ADMIN");
    expect(u.permissions).toBeUndefined();
  });
});
