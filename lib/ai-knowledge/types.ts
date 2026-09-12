/**
 * The shape of one answerable thing the system can be asked about.
 *
 * Each entry is addressable by `id`, so an answer can be traced back to the
 * procedure it came from, feedback can be attached to it, and gaps can be
 * counted. That is the difference between a knowledge base and a blob of prose:
 * you can tell which part of the system nobody has documented yet.
 *
 * The corpus serves two readers at once:
 *   - the keyword matcher, which uses `question` + `asks` for a high-confidence
 *     exact hit and answers for free, with no model call;
 *   - the model, which receives the whole corpus as a cached prefix and uses it
 *     to answer anything the matcher missed.
 *
 * Write `steps` as what a person does, in order, naming the route they start
 * from. Do not invent a control label you have not seen — describe the action
 * instead. A tutorial that names the wrong button is worse than one that says
 * "open the row's actions menu".
 */
export type Procedure = {
  /** Stable, kebab-case, unique. Never renumber — feedback is keyed on it. */
  id: string;
  /** Sidebar area this belongs to, for grouping and for gap analysis. */
  module: Module;
  /** The canonical phrasing, as a user would ask it. */
  question: string;
  /** Other phrasings that mean the same thing. Used by the matcher. */
  asks?: string[];
  /** Roles that can actually do this. Empty means any signed-in user. */
  roles?: string[];
  /** Where the user starts. A real route in this application. */
  route?: string;
  /** The procedure, in order. */
  steps: string[];
  /** Things that surprise people, and the reasons behind the design. */
  notes?: string[];
  /** Ids of procedures a person usually needs next. */
  next?: string[];
};

export type Module =
  | "getting-started"
  | "jobs"
  | "clients"
  | "quotations"
  | "invoices"
  | "payments"
  | "documents"
  | "pos"
  | "sales"
  | "inventory"
  | "procurement"
  | "finance"
  | "reports"
  | "service"
  | "communications"
  | "settings"
  | "portal"
  | "ai"
  | "troubleshooting";

/** Every module a user can be standing in, with the route that opens it. */
export const MODULE_ROUTES: Record<Module, string> = {
  "getting-started": "/dashboard",
  jobs: "/jobs",
  clients: "/clients",
  quotations: "/documents/quotations",
  invoices: "/documents/invoices",
  payments: "/documents/receipts",
  documents: "/documents",
  pos: "/pos",
  sales: "/sales",
  inventory: "/inventory",
  procurement: "/inventory/purchase-orders",
  finance: "/finance",
  reports: "/reports",
  service: "/service",
  communications: "/communications",
  settings: "/settings",
  portal: "/portal",
  ai: "/ai-insights",
  troubleshooting: "/settings/data-heal",
};
