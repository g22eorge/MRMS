"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  expireStaleQuotationDrafts,
  sendQuoteFollowUpForJob,
  sendQuoteFollowUpForQuotation,
  sendQuoteFollowUpsBulk,
} from "@/lib/commercial/quote-followups";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { can } from "@/lib/permissions";
import type { Role } from "@prisma/client";

function canSendQuoteFollowUps(user: { role: Role; permissions?: string[] }) {
  return (
    ["ADMIN", "OPS"].includes(user.role) ||
    can.createQuotations(user) ||
    can.approveQuotations(user)
  );
}

function safeReturnPath(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/documents/quotations")) return "/documents/quotations";
  return trimmed.split("?")[0] ?? "/documents/quotations";
}

function appendQuery(path: string, query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function sendQuoteFollowUpAction(formData: FormData) {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({
    access: org.access,
    userRole: user.role,
    userAccessMode: user.accessMode,
    kind: "GENERAL",
  });

  const returnTo = safeReturnPath(String(formData.get("returnTo") ?? "/documents/quotations"));
  const jobId = String(formData.get("jobId") ?? "").trim();
  const quotationId = String(formData.get("quotationId") ?? "").trim();

  if (!canSendQuoteFollowUps(user)) {
    redirect(appendQuery(returnTo, { followupError: "forbidden" }));
  }

  const result = jobId
    ? await sendQuoteFollowUpForJob({ orgId, jobId, actorUserId: user.id })
    : quotationId
      ? await sendQuoteFollowUpForQuotation({ orgId, quotationId, actorUserId: user.id })
      : { ok: false as const, targetType: "quotation" as const, targetId: "", error: "missing-target" };

  revalidatePath("/documents/quotations");

  if (!result.ok) {
    redirect(appendQuery(returnTo, { followupError: result.error }));
  }

  redirect(appendQuery(returnTo, { followupSent: "1" }));
}

export async function sendQuoteFollowUpsBulkAction(formData: FormData) {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({
    access: org.access,
    userRole: user.role,
    userAccessMode: user.accessMode,
    kind: "GENERAL",
  });

  const returnTo = safeReturnPath(String(formData.get("returnTo") ?? "/documents/quotations"));

  if (!canSendQuoteFollowUps(user)) {
    redirect(appendQuery(returnTo, { followupError: "forbidden" }));
  }

  const summary = await sendQuoteFollowUpsBulk({ orgId, actorUserId: user.id });
  revalidatePath("/documents/quotations");

  redirect(
    appendQuery(returnTo, {
      followupBulk: summary.sent,
      followupSkipped: summary.skipped,
      followupFailed: summary.failed,
    }),
  );
}

export async function expireStaleQuotationDraftsAction(formData: FormData) {
  const { user, org, orgId } = await requireOrgSession();
  assertOrgCanMutate({
    access: org.access,
    userRole: user.role,
    userAccessMode: user.accessMode,
    kind: "GENERAL",
  });

  const returnTo = safeReturnPath(String(formData.get("returnTo") ?? "/documents/quotations"));

  if (!can.createQuotations(user) && !["ADMIN", "OPS"].includes(user.role)) {
    redirect(appendQuery(returnTo, { followupError: "forbidden" }));
  }

  const summary = await expireStaleQuotationDrafts({ orgId, actorUserId: user.id });
  revalidatePath("/documents/quotations");

  redirect(appendQuery(returnTo, { expiredDrafts: summary.expired }));
}
