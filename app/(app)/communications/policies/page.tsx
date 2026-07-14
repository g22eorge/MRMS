import { redirect } from "next/navigation";

import { COMMUNICATIONS_ROUTES } from "@/lib/communications/routes";

export default function CommunicationsPoliciesPage() {
  redirect(`${COMMUNICATIONS_ROUTES.templates}#policies`);
}
