import { redirect } from "next/navigation";

// Absorbed into Settings → Communications → WhatsApp.
export default function CommunicationsWhatsappRedirect() {
  redirect("/settings/notifications/whatsapp");
}
