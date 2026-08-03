import { redirect } from "next/navigation";

// Absorbed into Settings → Communications; policies live within Templates.
export default function CommunicationsPoliciesRedirect() {
  redirect("/settings/notifications/templates#policies");
}
