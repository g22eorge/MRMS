import { redirect } from "next/navigation";

import { COMMUNICATIONS_ROUTES } from "@/lib/communications/routes";

export default function OutboxShortcutPage() {
  redirect(COMMUNICATIONS_ROUTES.outbox);
}
