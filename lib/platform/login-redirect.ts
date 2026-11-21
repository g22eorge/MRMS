import { getDeploymentContext } from "@/lib/deployment-context";
import { EIS_ORG_ID } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { checkIsPlatformAdmin } from "@/lib/platform-admin";
import { PLATFORM_ADMIN_PERMISSION, PLATFORM_ROUTES } from "@/lib/platform/routes";

export async function userHasPlatformConsoleAccess(email: string): Promise<boolean> {
  if (checkIsPlatformAdmin(email)) return true;

  try {
    const rows = await prisma.$queryRaw<Array<{ permission: string }>>`
      SELECT up.permission
      FROM "UserPermission" up
      INNER JOIN "User" u ON u.id = up."userId"
      WHERE lower(u.email) = lower(${email})
        AND up.permission = ${PLATFORM_ADMIN_PERMISSION}
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * On the single-tenant care deployment, is this user a member of the care
 * organisation? Such a user signs in to the shop, whatever else they can reach.
 *
 * False on any failure, and outside a request: the caller then falls back to
 * the console redirect, which is the behaviour this refines.
 */
async function isCareMemberOnCare(email: string): Promise<boolean> {
  try {
    const deployment = await getDeploymentContext();
    if (deployment.mode !== "CARE_SINGLE_TENANT") return false;
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { orgId: true },
    });
    return user?.orgId === EIS_ORG_ID;
  } catch {
    return false;
  }
}

export async function resolveLoginRedirect(email: string, callbackURL = "/dashboard"): Promise<string> {
  if (await userHasPlatformConsoleAccess(email)) {
    // Care's own administrator is also the platform admin. Signing in to care
    // should open the shop; the console stays one click away in the header.
    if (await isCareMemberOnCare(email)) return callbackURL;
    return PLATFORM_ROUTES.home;
  }
  return callbackURL;
}
