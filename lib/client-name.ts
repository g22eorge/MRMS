/**
 * What to call a client on screen and on paper.
 *
 * A `Client` row holds two names: `organization` (the business being billed)
 * and `fullName` (the person you actually deal with there). Corporate accounts
 * fill both — C-Care IHK's contact is Saaka — while walk-in customers fill only
 * the name.
 *
 * Everything customer-facing was showing `fullName`, so a corporate account
 * appeared under its contact's personal name: an invoice addressed to "Saaka"
 * rather than "C-Care IHK", and a client list you could not scan by company.
 * The organisation is the account, so it leads wherever a single label is shown.
 */

export type NameableClient = {
  fullName?: string | null;
  organization?: string | null;
} | null | undefined;

/**
 * Anything that can name the customer of a POS sale: the linked client, and the
 * sale's own `name`.
 */
export type NameableSale = {
  name?: string | null;
  client?: NameableClient;
} | null | undefined;

/**
 * The primary label: the organisation when there is one, otherwise the person.
 *
 * `fallback` covers a genuinely absent client — a POS walk-in with no record at
 * all — which is a different thing from a client whose organisation is blank.
 */
export function clientDisplayName(client: NameableClient, fallback = "—"): string {
  const org = (client?.organization ?? "").trim();
  if (org) return org;
  const name = (client?.fullName ?? "").trim();
  return name || fallback;
}

/**
 * What to call the customer of a POS sale.
 *
 * A POS sale is usually anonymous — there is no Client row and no client picker
 * at the till — so every screen and every printed receipt said "Walk-in" even
 * after the cashier typed who was buying. `Sale.name` is that label, so it
 * stands in for the customer whenever no client is linked. A linked client
 * always wins: it is the real account, and its organisation leads.
 *
 * `fallback` is for the genuinely nameless walk-in. Pass the wording the caller
 * already used ("Walk-in", "Walk-in Customer") so the copy stays put.
 */
export function saleCustomerName(sale: NameableSale, fallback = "Walk-in"): string {
  const linked = clientDisplayName(sale?.client, "");
  if (linked) return linked;
  const name = (sale?.name ?? "").trim();
  return name || fallback;
}

/**
 * The person, when the primary label is already showing the organisation.
 *
 * Returns null for an individual customer, so callers can render a contact line
 * only when it adds something rather than repeating the label above it.
 */
export function clientContactName(client: NameableClient): string | null {
  const org = (client?.organization ?? "").trim();
  if (!org) return null;
  const name = (client?.fullName ?? "").trim();
  return name || null;
}

/**
 * Both names in one string, e.g. "C-Care IHK (Saaka)".
 *
 * For places with a single line and room to spare — search results, pickers,
 * audit summaries — where knowing the contact saves opening the record.
 */
export function clientFullLabel(client: NameableClient, fallback = "—"): string {
  const primary = clientDisplayName(client, fallback);
  const contact = clientContactName(client);
  return contact ? `${primary} (${contact})` : primary;
}
