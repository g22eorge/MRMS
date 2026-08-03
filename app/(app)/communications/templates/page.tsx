import { redirect } from "next/navigation";

// Absorbed into Settings → Communications → Templates.
export default function CommunicationsTemplatesRedirect() {
  redirect("/settings/notifications/templates");
}
