import { describe, it, expect, mock, beforeEach } from "bun:test";

/**
 * A password set from the platform console is known to the platform admin.
 * The reset has to leave the user flagged so requireOrgSession holds them at
 * /change-password until they choose their own — the same rule the two
 * in-app reset paths follow. This path was missed when the flag was added.
 */
type Update = { where: { id: string }; data: { mustChangePassword: boolean } };

const userUpdates: Update[] = [];
const sessionDeletes: string[] = [];
const accountWrites: string[] = [];

const tx = {
  account: {
    updateMany: async ({ where }: { where: { userId: string } }) => {
      accountWrites.push(where.userId);
      return { count: 1 };
    },
    create: async () => ({}),
  },
  user: {
    update: async (args: Update) => {
      userUpdates.push(args);
      return {};
    },
  },
  session: {
    deleteMany: async ({ where }: { where: { userId: string } }) => {
      sessionDeletes.push(where.userId);
      return { count: 1 };
    },
  },
};

mock.module("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        orgId: "org-tenant",
        email: `${where.id}@example.test`,
      }),
    },
    $transaction: async (fn: (client: typeof tx) => Promise<void>) => fn(tx),
  },
}));
mock.module("@/lib/platform-admin", () => ({
  requirePlatformAdmin: async () => ({ id: "platform-admin", email: "admin@example.test", role: "ADMIN" }),
}));
mock.module("better-auth/crypto", () => ({ hashPassword: async (value: string) => `hashed:${value.length}` }));
mock.module("@/lib/commercial/audit", () => ({ writeSystemAuditEvent: async () => undefined }));
mock.module("@/lib/session", () => ({ getCurrentUserRole: async () => ({ session: null, user: null }) }));
mock.module("@/lib/platform/revalidate", () => ({
  revalidatePlatformHome: () => undefined,
  revalidatePlatformOrg: () => undefined,
  revalidatePlatformOrgAndHome: () => undefined,
}));
mock.module("@/lib/platform/impersonation", () => ({
  setImpersonationCookie: async () => undefined,
  clearImpersonationCookie: async () => undefined,
  readImpersonation: async () => null,
  IMPERSONATION_MAX_AGE_MS: 0,
}));
mock.module("@/lib/org-whatsapp-config", () => ({ setOrgAtSenderId: async () => undefined }));
mock.module("@/lib/module-access", () => ({ orgModulesTag: (id: string) => `org-modules:${id}` }));
mock.module("next/cache", () => ({ revalidateTag: () => undefined, revalidatePath: () => undefined }));
mock.module("next/navigation", () => ({ redirect: () => undefined }));

function form(userId: string, password = "a-new-password", confirm = password) {
  const data = new FormData();
  data.set("userId", userId);
  data.set("password", password);
  data.set("confirm", confirm);
  return data;
}

describe("resetOrgAdminPasswordAction", () => {
  beforeEach(() => {
    userUpdates.length = 0;
    sessionDeletes.length = 0;
    accountWrites.length = 0;
  });

  it("flags another user to choose their own password, and signs them out", async () => {
    const { resetOrgAdminPasswordAction } = await import("@/app/(platform)/platform/actions");
    const result = await resetOrgAdminPasswordAction({}, form("tenant-admin"));

    expect(result.error).toBeUndefined();
    expect(accountWrites).toEqual(["tenant-admin"]);
    expect(userUpdates).toEqual([{ where: { id: "tenant-admin" }, data: { mustChangePassword: true } }]);
    expect(sessionDeletes).toEqual(["tenant-admin"]);
  });

  it("does not flag a platform admin resetting their own password", async () => {
    const { resetOrgAdminPasswordAction } = await import("@/app/(platform)/platform/actions");
    await resetOrgAdminPasswordAction({}, form("platform-admin"));

    expect(userUpdates).toEqual([{ where: { id: "platform-admin" }, data: { mustChangePassword: false } }]);
  });

  it("changes nothing when the passwords do not match", async () => {
    const { resetOrgAdminPasswordAction } = await import("@/app/(platform)/platform/actions");
    const result = await resetOrgAdminPasswordAction({}, form("tenant-admin", "a-new-password", "different-one"));

    expect(result.error).toBe("Passwords do not match");
    expect(userUpdates).toEqual([]);
    expect(accountWrites).toEqual([]);
  });
});
