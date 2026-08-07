import { OrgModule, OrgPlan } from "@prisma/client";

export { OrgModule };

export const MODULE_LABELS: Record<OrgModule, string> = {
  JOBS: "Jobs & Repairs",
  INVENTORY: "Inventory",
  POS: "Point of Sale",
  PURCHASE_ORDERS: "Purchase Orders",
  INVOICING: "Invoicing & Documents",
  COMPLAINTS: "Complaints",
  REPORTS: "Reports",
  SALES: "Sales CRM",
  FIELD: "Field Visits",
  TARGETS: "Targets",
};

/**
 * Line-icon path data per module (Lucide-style, 24x24 viewBox, stroke-based).
 * Rendered monochrome in the accent colour via <ModuleIcon> so module chips
 * stay on-brand instead of using multi-colour emoji.
 */
export const MODULE_ICON_PATHS: Record<OrgModule, string> = {
  JOBS: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  INVENTORY: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z M3.3 7l8.7 5 8.7-5 M12 22V12",
  POS: "M8 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M2 3h2l2.4 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6",
  PURCHASE_ORDERS: "M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2 M9 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z M8 12h8 M8 16h8 M8 8h1",
  INVOICING: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  COMPLAINTS: "M3 11l18-5v12L3 14v-3z M11.6 16.8a3 3 0 1 1-5.8-1.6",
  REPORTS: "M3 3v18h18 M19 9l-5 5-4-4-3 3",
  SALES: "M2 7h20v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
  FIELD: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z M12 10a3 3 0 1 0 0-.01",
  TARGETS: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
};

export const MODULE_DESCRIPTIONS: Record<OrgModule, string> = {
  JOBS: "Track repair jobs end-to-end — intake, diagnosis, status, and completion",
  INVENTORY: "Manage inventory item stock, reorder alerts, and supplier items",
  POS: "Walk-in sales, product checkout, and receipts",
  PURCHASE_ORDERS: "Raise purchase orders to suppliers and manage goods received",
  INVOICING: "Generate invoices, send to clients, and track payments",
  COMPLAINTS: "Log customer complaints and manage resolution workflows",
  REPORTS: "Revenue reports, performance dashboards, and CSV exports",
  SALES: "Leads pipeline, corporate accounts, and sales team management",
  FIELD: "Dispatch field technicians and manage on-site job visits",
  TARGETS: "Set revenue and performance targets, track attainment",
};

export const MODULE_MIN_PLAN: Record<OrgModule, OrgPlan> = {
  JOBS: "STARTER",
  REPORTS: "STARTER",
  COMPLAINTS: "STARTER",
  INVOICING: "STANDARD",
  SALES: "STANDARD",
  INVENTORY: "STANDARD",
  TARGETS: "STANDARD",
  POS: "GROWTH",
  PURCHASE_ORDERS: "GROWTH",
  FIELD: "GROWTH",
};

const PLAN_ORDER: OrgPlan[] = ["STARTER", "STANDARD", "GROWTH", "PREMIUM", "ENTERPRISE"];

export function recommendPlanForModules(modules: OrgModule[]): OrgPlan {
  if (modules.length === 0) return "STARTER";
  return modules.reduce<OrgPlan>((max, module) => {
    const plan = MODULE_MIN_PLAN[module];
    return PLAN_ORDER.indexOf(plan) > PLAN_ORDER.indexOf(max) ? plan : max;
  }, "STARTER");
}

export const ALL_MODULES: OrgModule[] = (() => {
  try {
    const vals = Object.values(OrgModule ?? {});
    if (vals.length > 0) return vals as OrgModule[];
  } catch {
    // fall through to static enum list
  }
  return ["JOBS", "INVENTORY", "POS", "PURCHASE_ORDERS", "INVOICING", "COMPLAINTS", "REPORTS", "SALES", "FIELD", "TARGETS"] as OrgModule[];
})();
