import { prisma } from "@/lib/prisma";
import { checkIsPlatformAdmin } from "@/lib/platform-admin";
import { PLATFORM_ADMIN_PERMISSION, PLATFORM_ROUTES } from "@/lib/platform/routes";

export async function userHasPlatformConsoleAccess(email: string): Promise<boolean> {
  if (checkIsPlatformAdmin(email)) return true;

  try {
    const rows = await prisma.$queryRaw<Array<{ permission: string }>>`
      SELECT up.permission
      FROM "UserPermission" up
      INNER JOIN "User" u ON u.id = up.userId
      WHERE lower(u.email) = lower(${email})
        AND up.permission = ${PLATFORM_ADMIN_PERMISSION}
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function resolveLoginRedirect(email: string, callbackURL = "/dashboard"): Promise<string> {
  if (await userHasPlatformConsoleAccess(email)) {
    return PLATFORM_ROUTES.home;
  }
  return callbackURL;
}
