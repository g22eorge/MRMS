import { headers } from "next/headers";

import { EIS_ORG_ID, isCareDomain } from "@/lib/org";

export type DeploymentContext =
  | {
      mode: "CARE_SINGLE_TENANT";
      host: string;
      fixedOrgId: typeof EIS_ORG_ID;
    }
  | {
      mode: "COMMERCIAL_MULTI_TENANT";
      host: string;
      fixedOrgId?: undefined;
    };

export function resolveDeploymentContext(host: string | null | undefined): DeploymentContext {
  const normalizedHost = (host ?? "").toLowerCase();
  if (isCareDomain(normalizedHost)) {
    return {
      mode: "CARE_SINGLE_TENANT",
      host: normalizedHost,
      fixedOrgId: EIS_ORG_ID,
    };
  }

  return {
    mode: "COMMERCIAL_MULTI_TENANT",
    host: normalizedHost,
  };
}

/**
 * The host this deployment was configured for, independent of the URL used to
 * reach it.
 *
 * Deployment mode has to be a property of the deployment, not of the request.
 * `isCareDomain` matches hosts beginning "care.", but care is also served on
 * Vercel aliases that do not — mrms-eight.vercel.app among them. Reached that
 * way, care's own database resolved as COMMERCIAL_MULTI_TENANT: /register
 * rendered, and a signup with no orgId would have been sent to /onboarding to
 * create a second organisation inside a single-tenant deployment.
 *
 * Both projects already set these to their canonical origin, so this needs no
 * new configuration. Falls back to the request host when neither is set, which
 * is the local-development case.
 */
export function pickDeploymentHost(
  configuredUrls: Array<string | null | undefined>,
  requestHost: string | null | undefined,
): string | null {
  for (const value of configuredUrls) {
    if (!value?.trim()) continue;
    try {
      return new URL(value.trim()).host;
    } catch {
      // Malformed value — try the next one rather than falling back to the
      // request, which is the thing we are trying not to trust.
    }
  }
  return requestHost ?? null;
}

export async function getDeploymentContext() {
  const requestHost = (await headers()).get("host");
  return resolveDeploymentContext(
    pickDeploymentHost([process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL], requestHost),
  );
}
