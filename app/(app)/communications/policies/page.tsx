import { redirect } from "next/navigation";

// Absorbed into Settings → Communications; policies live within Templates.
// Redirect pages must not be prerendered.
export const dynamic = "force-dynamic";

export default function CommunicationsPoliciesRedirect() {
  redirect("/settings/notifications/templates#policies");
}
