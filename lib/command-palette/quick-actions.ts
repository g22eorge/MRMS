import { type Role } from "@prisma/client";

import { COMMUNICATIONS_ROUTES, canAccessCommunications } from "@/lib/communications/routes";
import { DOCUMENTS_ROUTES } from "@/lib/documents/routes";
import { can } from "@/lib/permissions";

import type { CommandPaletteAction } from "./types";

export type CommandPaletteUser = {
  role: Role;
  permissions?: string[];
};

export function normalizeCommandQuery(value: string) {
  return value.trim().toLowerCase();
}

export function filterCommandPaletteActions(actions: CommandPaletteAction[], query: string) {
  const q = normalizeCommandQuery(query);
  if (!q) return actions;
  return actions.filter((action) => {
    const haystack = [action.label, action.description ?? "", ...(action.keywords ?? [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function buildCommandPaletteQuickActions(user: CommandPaletteUser): CommandPaletteAction[] {
  const actions: CommandPaletteAction[] = [];

  if (can.createJob(user)) {
    actions.push({
      id: "new-job",
      label: "New Repair Job",
      description: "Capture a new repair intake",
      href: "/jobs/new",
      group: "Quick actions",
      keywords: ["create", "intake", "repair"],
    });
  }

  if (can.viewIntake(user)) {
    actions.push({
      id: "new-intake",
      label: "New Intake",
      description: "Front-desk repair request",
      href: "/intake",
      group: "Quick actions",
      keywords: ["request", "walk-in"],
    });
  }

  if (can.viewFinancials(user)) {
    actions.push({
      id: "record-payment",
      label: "Record Payment",
      description: "Issue a receipt against an invoice or sale",
      href: `${DOCUMENTS_ROUTES.receipts}?new=1`,
      group: "Quick actions",
      keywords: ["collect", "receipt", "cash"],
    });
    actions.push({
      id: "invoices",
      label: "Open Invoices",
      description: "Browse and collect receivables",
      href: DOCUMENTS_ROUTES.invoices,
      group: "Go to",
      keywords: ["billing", "invoice"],
    });
    actions.push({
      id: "expenses",
      label: "Add Expense",
      description: "Log a business expense",
      href: "/finance/expenses",
      group: "Quick actions",
      keywords: ["cost", "spend"],
    });
  }

  if (can.openPosSession(user)) {
    actions.push({
      id: "pos-sale",
      label: "Product Sale",
      description: "Open point of sale",
      href: "/pos",
      group: "Quick actions",
      keywords: ["retail", "sale", "pos"],
    });
  }

  if (["ADMIN", "MANAGER", "TECH_MANAGER", "OPS"].includes(user.role)) {
    actions.push({
      id: "purchase-order",
      label: "Purchase Order",
      description: "Create a supplier purchase order",
      href: "/inventory/purchase-orders/new",
      group: "Quick actions",
      keywords: ["procurement", "stock", "supplier"],
    });
  }

  if (can.searchJobs(user)) {
    actions.push({
      id: "jobs",
      label: "Open Jobs",
      description: "Repair job queue",
      href: "/jobs",
      group: "Go to",
      keywords: ["repairs", "queue"],
    });
  }

  if (can.viewClientInfo(user)) {
    actions.push({
      id: "clients",
      label: "Open Clients",
      description: "Customer directory",
      href: "/clients",
      group: "Go to",
      keywords: ["customer", "phone"],
    });
  }

  if (canAccessCommunications(user.role)) {
    actions.push({
      id: "outbox",
      label: "Open Outbox",
      description: "WhatsApp and email delivery queue",
      href: COMMUNICATIONS_ROUTES.outbox,
      group: "Go to",
      keywords: ["messages", "whatsapp", "failed"],
    });
  }

  actions.push({
    id: "dashboard",
    label: "Open Dashboard",
    description: "Operations overview",
    href: "/dashboard",
    group: "Go to",
    keywords: ["home", "overview"],
  });

  return actions;
}
