"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  sendOverdueInvoiceReminder,
  sendOverdueInvoiceRemindersForBucket,
  type OverdueAgingBucket,
} from "@/lib/commercial/invoice-reminders";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { can } from "@/lib/permissions";

const VALID_BUCKETS = new Set<string>(["1-30", "31-60", "61+", "all"]);

function canSendInvoiceReminders(user: { role: string; permissions?: string[] }) {
  return ["ADMIN", "OPS"].includes(user.role) || can.approveInvoices(user);
}

function safeReturnPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/documents/invoices")) return "/documents/invoices";
  return trimmed.split("?")[0] ?? "/documents/invoices";
}

function appendQuery(path: string, query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function sendOverdueInvoiceReminderAction(formData: FormData) {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({
    access: org.access,
    userRole: user.role,
    userAccessMode: user.accessMode,
    kind: "GENERAL",
  });

  const returnTo = safeReturnPath(String(formData.get("returnTo") ?? "/documents/invoices"));
  const aging = String(formData.get("aging") ?? "").trim() || undefined;

  if (!canSendInvoiceReminders(user)) {
    redirect(appendQuery(returnTo, { reminderError: "forbidden", aging }));
  }

  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  if (!invoiceId) {
    redirect(appendQuery(returnTo, { reminderError: "missing-invoice", aging }));
  }

  const result = await sendOverdueInvoiceReminder({
    orgId,
    invoiceId,
    actorUserId: user.id,
  });

  revalidatePath("/documents/invoices");

  if (!result.ok) {
    redirect(
      appendQuery(returnTo, {
        reminderError: result.error,
        aging,
      }),
    );
  }

  redirect(appendQuery(returnTo, { reminded: "1", aging }));
}

export async function sendOverdueInvoiceRemindersBulkAction(formData: FormData) {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({
    access: org.access,
    userRole: user.role,
    userAccessMode: user.accessMode,
    kind: "GENERAL",
  });

  const returnTo = safeReturnPath(String(formData.get("returnTo") ?? "/documents/invoices"));
  const aging = String(formData.get("aging") ?? "").trim();

  if (!canSendInvoiceReminders(user)) {
    redirect(appendQuery(returnTo, { reminderError: "forbidden", aging }));
  }

  if (!VALID_BUCKETS.has(aging)) {
    redirect(appendQuery(returnTo, { reminderError: "invalid-bucket", aging }));
  }

  const summary = await sendOverdueInvoiceRemindersForBucket({
    orgId,
    bucket: aging as OverdueAgingBucket,
    actorUserId: user.id,
  });

  revalidatePath("/documents/invoices");

  redirect(
    appendQuery(returnTo, {
      remindedBulk: summary.sent,
      reminderSkipped: summary.skipped,
      reminderFailed: summary.failed,
      aging,
    }),
  );
}
