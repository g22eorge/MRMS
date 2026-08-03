import { redirect } from "next/navigation";

// Absorbed into Settings → Communications → Outbox.
export default function CommunicationsOutboxRedirect() {
  redirect("/settings/notifications/outbox");
}
