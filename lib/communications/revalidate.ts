import { revalidatePath } from "next/cache";

import { COMMUNICATIONS_ROUTES } from "@/lib/communications/routes";

export function revalidateCommunicationsOutbox() {
  revalidatePath(COMMUNICATIONS_ROUTES.outbox);
  revalidatePath(COMMUNICATIONS_ROUTES.legacyOutbox);
}

export function revalidateCommunicationsTemplates() {
  revalidatePath(COMMUNICATIONS_ROUTES.templates);
  revalidatePath(COMMUNICATIONS_ROUTES.legacyTemplates);
}

export function revalidateCommunicationsWhatsapp() {
  revalidatePath(COMMUNICATIONS_ROUTES.whatsapp);
  revalidatePath(COMMUNICATIONS_ROUTES.legacyWhatsapp);
}

export function revalidateCommunicationsAll() {
  revalidateCommunicationsOutbox();
  revalidateCommunicationsTemplates();
  revalidateCommunicationsWhatsapp();
  revalidatePath(COMMUNICATIONS_ROUTES.home);
}
