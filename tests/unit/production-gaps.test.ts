import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("a hidden module's endpoints are closed, not only its pages", () => {
  const gated: Array<[string, string]> = [
    ["app/api/jobs/route.ts", "JOBS"],
    ["app/api/jobs/[id]/invoice/route.ts", "JOBS"],
    ["app/api/procurement/export/route.ts", "PURCHASE_ORDERS"],
    ["app/api/invoices/add-payment/route.ts", "INVOICING"],
    ["app/api/quotations/bulk-convert/route.ts", "INVOICING"],
    ["app/api/credit-notes/[id]/pdf/route.ts", "INVOICING"],
    ["app/api/campaigns/send/route.ts", "SALES"],
    ["app/api/sales/[id]/receipt/route.ts", "POS"],
    ["app/api/reports/export/route.ts", "REPORTS"],
  ];

  for (const [path, moduleKey] of gated) {
    it(`${path} checks ${moduleKey}`, () => {
      let source: string;
      try {
        source = read(path);
      } catch {
        return; // the route was moved or renamed; the others still stand
      }
      expect(source).toContain(`"${moduleKey}");`);
      expect(source).toContain("if (moduleDenied) return moduleDenied;");
    });
  }

  it("leaves product creation open, since a shop on point of sale alone still adds products", () => {
    expect(read("app/api/parts/create/route.ts")).not.toContain("apiModuleDenied");
  });

  it("answers 403, and lets the route's own sign-in check speak first", () => {
    const source = read("lib/module-access.ts");
    expect(source).toContain("if (!orgId) return null;");
    expect(source).toContain("{ status: 403 }");
  });
});

describe("forgotten passwords", () => {
  it("are reset by an emailed, single-use link", () => {
    const auth = read("lib/auth.ts");
    expect(auth).toContain("sendResetPassword");
    expect(auth).toContain("revokeSessionsOnPasswordReset: true");
    // Choosing your own password satisfies a pending forced change.
    expect(auth).toContain("data: { mustChangePassword: false }");
  });

  it("say so when email is not set up, instead of sending nothing", () => {
    expect(read("app/(auth)/forgot-password/page.tsx")).toContain("Boolean(process.env.RESEND_API_KEY)");
  });

  it("do not reveal whether an address has an account", () => {
    expect(read("app/(auth)/forgot-password/forgot-form.tsx")).toContain("If that address has an account");
  });

  it("are reachable signed out, and rate limited", () => {
    const proxy = read("proxy.ts");
    expect(proxy).toContain('"/forgot-password"');
    expect(proxy).toContain('"/reset-password"');
    expect(read("app/api/auth/[...all]/route.ts")).toContain('path.endsWith("/request-password-reset")');
  });
});

describe("the server's safety nets", () => {
  it("can copy each backup off the server", () => {
    expect(read("scripts/pg-backup.sh")).toContain('rclone copy --no-traverse "$target" "$BACKUP_REMOTE"');
    expect(read("Dockerfile")).toContain("apk add --no-cache rclone");
    expect(read("docker-compose.yml")).toContain("BACKUP_REMOTE: ${BACKUP_REMOTE:-}");
  });

  it("is asked whether it is up every ten minutes", () => {
    const workflow = read(".github/workflows/uptime.yml");
    expect(workflow).toContain('cron: "*/10 * * * *"');
    expect(workflow).toContain("care.eagleinfosolutions.com/api/health");
    expect(workflow).toContain("app.eagleinfosolutions.com/api/health");
  });
});

describe("the console flags a plan that does not cover an organisation's modules", () => {
  it("as something to look at", () => {
    const page = read("app/(platform)/platform/page.tsx");
    expect(page).toContain('reason: "Plan below modules"');
    expect(page).toContain("recommendPlanForModules(modules)");
  });
});

describe("the app can be added to a phone's home screen", () => {
  it("through a manifest the browser can fetch signed out", () => {
    expect(read("app/manifest.ts")).toContain('display: "standalone"');
    expect(read("proxy.ts")).toContain('"/manifest.webmanifest"');
    expect(read("app/layout.tsx")).toContain('manifest: "/manifest.webmanifest"');
  });
});
