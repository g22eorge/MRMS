/**
 * org-context.ts
 *
 * Central helper for multi-tenant org scoping.
 *
 * All server actions and page components that touch business data
 * should call requireOrgSession() instead of getCurrentUserRole()
 * directly. This guarantees:
 *   1. The user is authenticated.
 *   2. The user belongs to an org — otherwise they're redirected to /onboarding.
 *   3. The orgId is always available for Prisma query scoping.
 */

import { redirect } from "next/navigation";

import { getAppCurrency, normalizeCurrency, parseSupportedCurrencies } from "@/lib/currency";
import { getOrgAccess } from "@/lib/billing-access";
import { PLATFORM_ROUTES } from "@/lib/platform/routes";
import { getCurrentUserRole, getCurrentUserRoleOptional } from "@/lib/session";
import { checkIsPlatformAdmin } from "@/lib/platform-admin";
import { getDeploymentContext } from "@/lib/deployment-context";
import { EIS_ORG_ID } from "@/lib/org";

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

/** Use in server components and server actions that require a full org context. */
export async function requireOrgSession() {
  const { session, user } = await getCurrentUserRole();

  // An admin has just set this user's password, so the admin knows it. Nothing
  // in the app opens until they have chosen their own. /change-password sits
  // outside the (app) segment and reads the session directly, so it does not
  // come back through here and bounce against itself.
  if (user!.mustChangePassword) redirect("/change-password");

  const deployment = await getDeploymentContext();

  if (deployment.mode === "CARE_SINGLE_TENANT") {
    // A platform admin who is also a member of the care organisation uses the
    // app like any other member. This used to send every platform admin to the
    // console unconditionally, on the assumption that one has no organisation.
    // Care's own administrator is both: every app page bounced them back to
    // /platform, including the console's own "← App" link, so the shop's admin
    // could not open the shop. Only a platform admin from outside the care
    // organisation belongs on the console here.
    if (user!.orgId !== EIS_ORG_ID && checkIsPlatformAdmin(user!.email)) {
      redirect(PLATFORM_ROUTES.home);
    }

    if (user!.orgId !== EIS_ORG_ID) {
      // Use the force-logout route, not /login — otherwise the login page
      // re-bounces the user back to /dashboard because their session is still
      // valid, and requireOrgSession bounces them back to /login, ad nauseam.
      redirect("/api/auth/force-logout");
    }

    return buildOrgSession(session, user!, deployment.fixedOrgId);
  }

  if (!user!.orgId) {
    if (checkIsPlatformAdmin(user!.email)) {
      redirect(PLATFORM_ROUTES.home);
    }
    redirect("/onboarding");
  }

  return buildOrgSession(session, user!, user!.orgId as string);
}

async function buildOrgSession(
  session: Awaited<ReturnType<typeof getCurrentUserRole>>["session"],
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUserRole>>["user"]>,
  orgId: string,
) {
  const prisma = await getPrisma();
  const orgRow = await prisma.organization
    .findUnique({
      where: { id: orgId },
      select: {
        name: true,
        baseCurrency: true,
        supportedCurrencies: true,
        plan: true,
        billingStatus: true,
        isActive: true,
        trialEndsAt: true,
        planRenewsAt: true,
        planCancelledAt: true,
      },
    })
    .catch(() => null);
  const baseCurrency = normalizeCurrency(orgRow?.baseCurrency, getAppCurrency());
  const supportedCurrencies = parseSupportedCurrencies(orgRow?.supportedCurrencies, baseCurrency);
  const access = getOrgAccess(orgRow ? {
    plan: orgRow.plan,
    billingStatus: orgRow.billingStatus,
    trialEndsAt: orgRow.trialEndsAt ?? null,
    planRenewsAt: orgRow.planRenewsAt ?? null,
    planCancelledAt: orgRow.planCancelledAt ?? null,
    isActive: orgRow.isActive,
  } : null);

  return {
    session,
    user,
    orgId,
    org: {
      name: orgRow?.name ?? null,
      baseCurrency,
      supportedCurrencies,
      plan: orgRow?.plan ?? "STARTER",
      billingStatus: orgRow?.billingStatus ?? "TRIALING",
      trialEndsAt: orgRow?.trialEndsAt ?? null,
      planRenewsAt: orgRow?.planRenewsAt ?? null,
      planCancelledAt: orgRow?.planCancelledAt ?? null,
      access,
    },
  };
}

/**
 * Use in API routes / background workers that must not redirect.
 * Returns null orgId if the user has no org — caller decides what to do.
 */
export async function getOrgSessionOptional() {
  const { session, user } = await getCurrentUserRoleOptional();

  return {
    session,
    user,
    orgId: user?.orgId ?? null,
  };
}
