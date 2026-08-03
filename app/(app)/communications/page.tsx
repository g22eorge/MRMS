import { redirect } from "next/navigation";

// Communications has been absorbed into Settings → Communications.
export default function CommunicationsHomePage() {
  redirect("/settings/notifications/outbox");
}
