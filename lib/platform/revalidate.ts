import { revalidatePath } from "next/cache";

import { PLATFORM_ROUTES } from "@/lib/platform/routes";

export function revalidatePlatformHome() {
  revalidatePath(PLATFORM_ROUTES.home);
}

export function revalidatePlatformOrg(orgId: string) {
  revalidatePath(PLATFORM_ROUTES.org(orgId));
}

export function revalidatePlatformOrgAndHome(orgId: string) {
  revalidatePlatformHome();
  revalidatePlatformOrg(orgId);
}

export function revalidatePlatformSettings() {
  revalidatePath(PLATFORM_ROUTES.settings);
}
