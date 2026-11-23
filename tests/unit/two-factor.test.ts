import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

/**
 * Two-step sign-in is opt-in: an account without it signs in exactly as before.
 * The behaviour itself is exercised against a running app (password, code,
 * backup code, reuse, switching off); these pin the wiring around it.
 */
describe("two-step sign-in", () => {
  it("is provided by the sign-in library's plugin, not hand-rolled", () => {
    const auth = read("lib/auth.ts");
    expect(auth).toContain('import { twoFactor } from "better-auth/plugins";');
    expect(auth).toContain("plugins: [twoFactor(");
  });

  it("sends a two-step account to the code page instead of the dashboard", () => {
    const form = read("app/(auth)/login/login-form.tsx");
    expect(form).toContain("if (body.twoFactorRedirect) {");
    expect(form).toContain('window.location.href = "/login/verify";');
  });

  it("accepts an app code or a backup code on that page", () => {
    const form = read("app/(auth)/login/verify/verify-form.tsx");
    expect(form).toContain("/api/auth/two-factor/verify-totp");
    expect(form).toContain("/api/auth/two-factor/verify-backup-code");
  });

  it("rate limits the code step by address", () => {
    expect(read("app/api/auth/[...all]/route.ts")).toContain('path.includes("/two-factor/verify-")');
  });

  it("only takes effect once a first code is confirmed", () => {
    // The card shows the QR code first and marks it on after verify-totp
    // succeeds, so a half-finished setup cannot lock anyone out.
    const card = read("components/settings/TwoFactorCard.tsx");
    expect(card.indexOf('post("enable"')).toBeLessThan(card.indexOf('post("verify-totp"'));
    expect(card).toContain("They won&apos;t be shown again.");
  });
});

describe("recovering someone locked out of two-step sign-in", () => {
  it("lets their administrator switch it off, within the same organisation", () => {
    const page = read("app/(app)/settings/users/page.tsx");
    expect(page).toContain("async function resetUserTwoFactor(formData: FormData)");
    expect(page).toContain("where: { id: targetId, orgId: actorOrgId }");
    expect(page).toContain('action: "USER_TWO_FACTOR_RESET"');
  });

  it("clears it when the platform resets a locked-out administrator's password", () => {
    const actions = read("app/(platform)/platform/actions.ts");
    expect(actions).toContain("await tx.twoFactor.deleteMany({ where: { userId } });");
    expect(actions).toContain("twoFactorEnabled: false");
  });

  it("removes a user's secrets with the user", () => {
    expect(read("prisma/schema.prisma")).toMatch(/model TwoFactor \{[\s\S]*onDelete: Cascade/);
  });
});
