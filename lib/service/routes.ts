// Service hub navigation — mirrors lib/finance/routes.ts. The service sub-modules
// (Field, Technicians, Complaints) live at top-level routes rather than under
// /service, so instead of a shared layout each page renders <ServiceHubNav />
// at the top; this keeps the hub tabs in the same place everywhere.

export const SERVICE_ROUTES = {
  home: "/service",
  field: "/field",
  technicians: "/technicians",
  complaints: "/complaints",
} as const;

export type ServiceNavKey = "overview" | "field" | "technicians" | "complaints";

export const SERVICE_NAV: Array<{ key: ServiceNavKey; href: string; label: string }> = [
  { key: "overview", href: SERVICE_ROUTES.home, label: "Overview" },
  { key: "field", href: SERVICE_ROUTES.field, label: "Field Visits" },
  { key: "technicians", href: SERVICE_ROUTES.technicians, label: "Technicians" },
  { key: "complaints", href: SERVICE_ROUTES.complaints, label: "Complaints" },
];
