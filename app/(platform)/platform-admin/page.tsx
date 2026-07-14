import { redirect } from "next/navigation";

import { PLATFORM_ROUTES } from "@/lib/platform/routes";

// Legacy duplicate of /platform. Redirect to the canonical platform console.
export default function PlatformAdminRedirect() {
  redirect(PLATFORM_ROUTES.home);
}
