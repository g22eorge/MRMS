"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireOrgSession } from "@/lib/org-context";
import { assertOrgCanMutate } from "@/lib/org-write";
import { writeSystemAuditEvent } from "@/lib/commercial/audit";
import { hashPortalPassword } from "@/lib/portal-auth";
import type { PortalRole } from "@prisma/client";

const ROLES: PortalRole[] = ["ORG_ADMIN", "IT_OFFICER", "MEMBER"];

function canManagePortal(role: string) {
  return ["ADMIN", "OPS"].includes(role);
}

/** Staff provisions a corporate-client portal login. */
export async function createPortalUserAction(formData: FormData): Promise<void> {
  const { user, orgId, org } = await requireOrgSession();
  if (!canManagePortal(user.role)) return;
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

  const clientId = String(formData.get("clientId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const position = String(formData.get("position") ?? "").trim() || null;
  const roleRaw = String(formData.get("role") ?? "IT_OFFICER").trim().toUpperCase();
  const role = (ROLES.includes(roleRaw as PortalRole) ? roleRaw : "IT_OFFICER") as PortalRole;
  const password = String(formData.get("password") ?? "");

  if (!clientId || !name || !email || password.length < 8) return;

  // Client must belong to this org.
  const client = await prisma.client.findFirst({ where: { id: clientId, orgId }, select: { id: true } });
  if (!client) return;

  // Email must be unique within the org's portal.
  const existing = await prisma.portalUser.findFirst({ where: { orgId, email }, select: { id: true } });
  if (existing) return;

  const created = await prisma.portalUser.create({
    data: {
      orgId,
      clientId,
      name,
      email,
      phone,
      position,
      role,
      passwordHash: await hashPortalPassword(password),
      createdById: user.id,
    },
    select: { id: true },
  });

  await writeSystemAuditEvent({
    orgId,
    actorUserId: user.id,
    entityType: "PortalUser",
    entityId: created.id,
    action: "PORTAL_USER_CREATED",
    summary: `Portal access created for ${email} (${role})`,
  });

  revalidatePath(`/clients/${clientId}`);
}

/** Deactivate (revoke) a portal login. */
export async function togglePortalUserAction(formData: FormData): Promise<void> {
  const { user, orgId, org } = await requireOrgSession();
  if (!canManagePortal(user.role)) return;
  assertOrgCanMutate({ access: org.access, userRole: user.role, userAccessMode: user.accessMode, kind: "GENERAL" });

  const id = String(formData.get("portalUserId") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();
  if (!id) return;

  const target = await prisma.portalUser.findFirst({ where: { id, orgId }, select: { id: true, isActive: true } });
  if (!target) return;

  await prisma.portalUser.update({ where: { id }, data: { isActive: !target.isActive } });
  // Revoking access should also end any live sessions.
  if (target.isActive) await prisma.portalSession.deleteMany({ where: { portalUserId: id } });

  await writeSystemAuditEvent({
    orgId,
    actorUserId: user.id,
    entityType: "PortalUser",
    entityId: id,
    action: target.isActive ? "PORTAL_USER_DEACTIVATED" : "PORTAL_USER_REACTIVATED",
    summary: `Portal access ${target.isActive ? "revoked" : "restored"}`,
  });

  if (clientId) revalidatePath(`/clients/${clientId}`);
}
