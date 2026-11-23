/**
 * The start of other languages: the menus, in Swahili and French.
 *
 * Text is looked up by its English wording, so nothing has to be renamed to be
 * translated and anything without an entry simply stays in English. That keeps
 * a half-translated screen readable instead of showing keys, and lets the
 * translated surface grow one phrase at a time.
 *
 * These were written without a native reviewer. They cover navigation only;
 * pages, documents and messages are still English.
 */
export const LOCALES = [
  { code: "en", label: "English" },
  { code: "sw", label: "Kiswahili" },
  { code: "fr", label: "Français" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.some((locale) => locale.code === value);
}

export function localeOrDefault(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

const SW: Record<string, string> = {
  Dashboard: "Dashibodi", Home: "Nyumbani", Jobs: "Kazi", Intake: "Mapokezi", "Service Hub": "Kituo cha Huduma",
  Warranty: "Dhamana", Technicians: "Mafundi", Techs: "Mafundi", "My Payouts": "Malipo Yangu", Field: "Kazi za Nje",
  Complaints: "Malalamiko", Clients: "Wateja", "Sales CRM": "Mauzo", Sales: "Mauzo", Campaigns: "Kampeni",
  "Point of Sale": "Kituo cha Mauzo", POS: "POS", Targets: "Malengo", Documents: "Nyaraka", "Job Cards": "Kadi za Kazi",
  Quotations: "Nukuu za Bei", Quotes: "Nukuu", Invoices: "Ankara", Receipts: "Risiti", "Delivery Notes": "Hati za Uwasilishaji",
  Delivery: "Uwasilishaji", "Credit Notes": "Hati za Mkopo", Refunds: "Marejesho", "Finance Hub": "Fedha", Finance: "Fedha",
  Expenses: "Matumizi", Payables: "Madeni", Collections: "Makusanyo", Collect: "Kusanya", Reports: "Ripoti",
  "AI Insights": "Maarifa ya AI", Insights: "Maarifa", Inventory: "Bidhaa", Suppliers: "Wasambazaji",
  "Purchase Orders": "Oda za Ununuzi", Settings: "Mipangilio", Service: "Huduma", Workspace: "Eneo la Kazi", More: "Zaidi",
};

const FR: Record<string, string> = {
  Dashboard: "Tableau de bord", Home: "Accueil", Jobs: "Réparations", Intake: "Réception", "Service Hub": "Service",
  Warranty: "Garantie", Technicians: "Techniciens", Techs: "Techs", "My Payouts": "Mes paiements", Field: "Terrain",
  Complaints: "Réclamations", Clients: "Clients", "Sales CRM": "Ventes", Sales: "Ventes", Campaigns: "Campagnes",
  "Point of Sale": "Point de vente", POS: "Caisse", Targets: "Objectifs", Documents: "Documents", "Job Cards": "Fiches de travail",
  Quotations: "Devis", Quotes: "Devis", Invoices: "Factures", Receipts: "Reçus", "Delivery Notes": "Bons de livraison",
  Delivery: "Livraison", "Credit Notes": "Avoirs", Refunds: "Remboursements", "Finance Hub": "Finances", Finance: "Finances",
  Expenses: "Dépenses", Payables: "Dettes fournisseurs", Collections: "Encaissements", Collect: "Encaisser", Reports: "Rapports",
  "AI Insights": "Analyses IA", Insights: "Analyses", Inventory: "Stock", Suppliers: "Fournisseurs",
  "Purchase Orders": "Bons de commande", Settings: "Paramètres", Service: "Service", Workspace: "Espace de travail", More: "Plus",
};

const TABLES: Record<Locale, Record<string, string>> = { en: {}, sw: SW, fr: FR };

/** The text in `locale`, or the English it was given when there is no entry. */
export function translate(text: string, locale: string | null | undefined): string {
  return TABLES[localeOrDefault(locale)][text] ?? text;
}
