import { type Role } from "@prisma/client";

import { can } from "@/lib/permissions";

export const DOCUMENTS_ROUTES = {
  home: "/documents",
  jobCards: "/documents/job-cards",
  quotations: "/documents/quotations",
  invoices: "/documents/invoices",
  receipts: "/documents/receipts",
  deliveryNotes: "/documents/delivery-notes",
  creditNotes: "/documents/credit-notes",
  refunds: "/documents/refunds",
  templates: "/documents/templates",
} as const;

export type DocumentsNavKey =
  | "job_cards"
  | "quotations"
  | "invoices"
  | "receipts"
  | "delivery_notes"
  | "credit_notes"
  | "refunds"
  | "templates";

export const DOCUMENTS_NAV: Array<{
  key: DocumentsNavKey;
  href: string;
  label: string;
  description: string;
  roles: readonly string[];
}> = [
  {
    key: "job_cards",
    href: DOCUMENTS_ROUTES.jobCards,
    label: "Job Cards",
    description: "Print and share repair job cards",
    roles: ["ADMIN", "MANAGER", "TECH_MANAGER", "OPS", "FRONT_DESK", "TECHNICIAN_INTERNAL"],
  },
  {
    key: "invoices",
    href: DOCUMENTS_ROUTES.invoices,
    label: "Invoices",
    description: "Bill customers and collect payment",
    roles: ["ADMIN", "MANAGER", "OPS", "FINANCE", "SALES_MANAGER", "SALES_CORPORATE", "TECH_MANAGER"],
  },
  {
    key: "quotations",
    href: DOCUMENTS_ROUTES.quotations,
    label: "Quotations",
    description: "Issue and track customer quotes",
    roles: ["ADMIN", "MANAGER", "TECH_MANAGER", "OPS", "SALES", "TECHNICIAN_INTERNAL", "SALES_MANAGER", "SALES_CORPORATE", "SALES_RETAIL"],
  },
  {
    key: "receipts",
    href: DOCUMENTS_ROUTES.receipts,
    label: "Receipts",
    description: "Proof of payment for customers",
    roles: ["ADMIN", "MANAGER", "OPS", "FRONT_DESK", "SALES", "SALES_MANAGER", "SALES_RETAIL"],
  },
  {
    key: "delivery_notes",
    href: DOCUMENTS_ROUTES.deliveryNotes,
    label: "Delivery Notes",
    description: "Confirm devices handed back to client",
    roles: ["ADMIN", "MANAGER", "OPS", "FRONT_DESK", "TECHNICIAN_INTERNAL"],
  },
  {
    key: "credit_notes",
    href: DOCUMENTS_ROUTES.creditNotes,
    label: "Credit Notes",
    description: "Issue credit against sales",
    roles: ["ADMIN", "MANAGER", "OPS", "FINANCE"],
  },
  {
    key: "refunds",
    href: DOCUMENTS_ROUTES.refunds,
    label: "Refunds",
    description: "Process and track customer refunds",
    roles: ["ADMIN", "MANAGER", "OPS", "FINANCE"],
  },
  {
    key: "templates",
    href: DOCUMENTS_ROUTES.templates,
    label: "Templates",
    description: "PDF layout and branding templates",
    roles: ["ADMIN", "MANAGER", "OPS"],
  },
];

export function documentsNavForRole(role: string) {
  return DOCUMENTS_NAV.filter((item) => item.roles.includes(role));
}

export function canAccessDocumentsHub(role: string) {
  return documentsNavForRole(role).length > 0;
}

export function defaultDocumentsRouteForRole(role: string) {
  const items = documentsNavForRole(role);
  if (items.length === 0) return DOCUMENTS_ROUTES.home;
  const preferred = items.find((item) => item.key === "invoices") ?? items.find((item) => item.key === "quotations") ?? items[0];
  return preferred.href;
}

export function canViewJobDocumentTimeline(user: { role: Role; permissions?: string[] }) {
  const permissionUser = { role: user.role, permissions: user.permissions ?? [] };
  return (
    can.viewFinancials(permissionUser) ||
    can.generateJobCards(permissionUser) ||
    ["ADMIN", "OPS", "TECHNICIAN_INTERNAL", "FRONT_DESK", "SALES", "SALES_MANAGER"].includes(user.role) ||
    can.viewApprovedCost(permissionUser)
  );
}
