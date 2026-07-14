import { describe, expect, it, mock, afterEach } from "bun:test";

const mockQueryRaw = mock(async (): Promise<Array<{ permission: string }>> => []);

mock.module("@/lib/prisma", () => ({
  prisma: { $queryRaw: mockQueryRaw },
}));

const { resolveLoginRedirect, userHasPlatformConsoleAccess } = await import("../../lib/platform/login-redirect");

describe("userHasPlatformConsoleAccess()", () => {
  afterEach(() => {
    delete process.env.PLATFORM_ADMIN_EMAIL;
    mockQueryRaw.mockReset();
  });

  it("returns true for configured platform admin email", async () => {
    process.env.PLATFORM_ADMIN_EMAIL = "admin@example.com";
    expect(await userHasPlatformConsoleAccess("admin@example.com")).toBe(true);
    expect(mockQueryRaw.mock.calls.length).toBe(0);
  });

  it("returns true when platform_admin permission exists", async () => {
    mockQueryRaw.mockImplementation(async () => [{ permission: "platform_admin" }]);
    expect(await userHasPlatformConsoleAccess("ops@example.com")).toBe(true);
  });

  it("returns false when no email match and no permission", async () => {
    mockQueryRaw.mockImplementation(async () => []);
    expect(await userHasPlatformConsoleAccess("ops@example.com")).toBe(false);
  });
});

describe("resolveLoginRedirect()", () => {
  afterEach(() => {
    delete process.env.PLATFORM_ADMIN_EMAIL;
    mockQueryRaw.mockReset();
  });

  it("sends platform admins to /platform", async () => {
    process.env.PLATFORM_ADMIN_EMAIL = "admin@example.com";
    expect(await resolveLoginRedirect("admin@example.com", "/dashboard")).toBe("/platform");
  });

  it("keeps regular users on callback URL", async () => {
    mockQueryRaw.mockImplementation(async () => []);
    expect(await resolveLoginRedirect("user@example.com", "/jobs")).toBe("/jobs");
  });
});
