import { redirect } from "next/navigation";

import { COMMUNICATIONS_ROUTES } from "@/lib/communications/routes";

export default function CommunicationsHomePage() {
  redirect(COMMUNICATIONS_ROUTES.outbox);
}
