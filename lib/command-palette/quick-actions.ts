import type { OrgModule } from "@prisma/client";
import type { Role } from "@prisma/client";

import { canAccessCommunications } from "@/lib/communications/routes";
import { COMMUNICATIONS_ROUTES } from "@/lib/communications/routes";
import { DOCUMENTS_ROUTES } from "@/lib/documents/routes";
import { can } from "@/lib/permissions";

export type CommandPaletteAction = {
  id: string;
  label: string;
  description: string;
  href: string;
  keywords: string[];
  group: "quick" | "navigate";
};

export type CommandPaletteSearchResult = {
  id: string;
  kind: "job" | "client" | "invoice";
  label: string;
  description: string;
  href: string;
};

export function normalizeCommandQuery(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

export function filterCommandActions(actions: CommandPaletteAction[], query: string) {
  const q = normalizeCommandQuery(query).toLowerCase();
  if (!q) return actions;
  return actions.filter((action) => {
    const haystack = [action.label, action.description, ...action.keywords].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

export function buildCommandPaletteActions(input: {
  role: Role;
  permissions?: string[];
  enabledModules: Set<OrgModule> | OrgModule[];
}): CommandPaletteAction[] {
  const enabled =
    input.enabledModules instanceof Set ? input.enabledModules : new Set(input.enabledModules);
  const user = { role: input.role, permissions: input.permissions ?? [] };
  const actions: CommandPaletteAction[] = [];

  const push = (action: CommandPaletteAction | false | null | undefined) => {
    if (action) actions.push(action);
  };

  push(
    can.createJob(user) &&
      enabled.has("JOBS") && {
        id: "new-job",
        label: "New Repair Job",
        description: "Capture a new repair intake",
        href: "/jobs/new",
        keywords: ["create", "repair", "intake", "job"],
        group: "quick",
      },
  );

  push(
    can.viewIntake(user) && {
      id: "new-intake",
      label: "New Intake",
      description: "Front-desk repair request capture",
      href: "/intake",
      keywords: ["intake", "request", "front desk"],
      group: "quick",
    },
  );

  push(
    can.viewFinancials(user) &&
      enabled.has("INVOICING") && {
        id: "record-payment",
        label: "Record Payment",
        description: "Issue a receipt against an invoice or sale",
        href: `${DOCUMENTS_ROUTES.receipts}?new=1`,
        keywords: ["payment", "receipt", "collect", "cash"],
        group: "quick",
      },
  );

  push(
    can.openPosSession(user) &&
      enabled.has("POS") && {
        id: "product-sale",
        label: "Product Sale",
        description: "Open point-of-sale checkout",
        href: "/pos",
        keywords: ["pos", "sale", "retail", "product"],
        group: "quick",
      },
  );

  push(
    can.runFinancialReports(user) && {
      id: "add-expense",
      label: "Add Expense",
      description: "Log a business expense",
      href: "/finance/expenses",
      keywords: ["expense", "cost", "finance"],
      group: "quick",
    },
  );

  push(
    can.manageInventory(user) &&
      enabled.has("PURCHASE_ORDERS") && {
        id: "purchase-order",
        label: "Purchase Order",
        description: "Create a supplier purchase order",
        href: "/inventory/purchase-orders/new",
        keywords: ["po", "procurement", "supplier", "stock"],
        group: "quick",
      },
  );

  push(
    can.viewFinancials(user) &&
      enabled.has("INVOICING") && {
        id: "open-invoices",
        label: "Open Invoices",
        description: "Browse and collect on customer invoices",
        href: DOCUMENTS_ROUTES.invoices,
        keywords: ["invoice", "billing", "documents"],
        group: "navigate",
      },
  );

  push(
    canAccessCommunications(user.role) && {
      id: "open-outbox",
      label: "Open Outbox",
      description: "WhatsApp and email delivery queue",
      href: COMMUNICATIONS_ROUTES.outbox,
      keywords: ["outbox", "whatsapp", "messages", "communications"],
      group: "navigate",
    },
  );

  push(
    can.searchJobs(user) && {
      id: "open-jobs",
      label: "Open Jobs",
      description: "Repair job list and filters",
      href: "/jobs",
      keywords: ["jobs", "repairs", "queue"],
      group: "navigate",
    },
  );

  push(
    can.viewClientInfo(user) && {
      id: "open-clients",
      label: "Open Clients",
      description: "Customer directory",
      href: "/clients",
      keywords: ["clients", "customers", "phone"],
      group: "navigate",
    },
  );

  return actions;
}
