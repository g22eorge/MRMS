/** Standard page state flow: loading → content | empty | not-found | error */

export type PageStateKind = "loading" | "content" | "empty" | "not-found" | "error";

export const PAGE_STATE_KINDS: readonly PageStateKind[] = [
  "loading",
  "content",
  "empty",
  "not-found",
  "error",
] as const;

/** Segments that are routes, not entity record ids (e.g. /jobs/new). */
export const RESERVED_ROUTE_SEGMENTS = new Set(["new", "board"]);

export function isEntityRecordId(segment: string) {
  if (!segment || RESERVED_ROUTE_SEGMENTS.has(segment)) return false;
  if (segment.length < 8) return false;
  return /^[a-z0-9_-]+$/i.test(segment);
}
