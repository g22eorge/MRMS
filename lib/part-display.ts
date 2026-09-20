/**
 * The one-liner shown for an inventory item in tables: the user-picked short
 * line when set, otherwise the description's first line. Never the full
 * narrative — that lives on the item detail page.
 */
export function partShortView(part: {
  shortDescription?: string | null;
  description?: string | null;
}): string {
  const picked = (part.shortDescription ?? "").trim();
  if (picked) return picked;
  const firstLine = (part.description ?? "").split("\n", 1)[0]?.trim() ?? "";
  return firstLine;
}
