/**
 * Shared list-table pagination helpers.
 *
 * Every list page in the app paginates on the same contract so the UI (via
 * `DataTable`'s `pagination` prop / `TablePagination`) stays consistent:
 *   - one page size app-wide (`PAGE_SIZE`)
 *   - `parsePage` normalizes the `?page=` param
 *   - `pageHrefBuilder` produces filter-preserving hrefs for the footer links
 */

/** App-wide list page size. Keep every table on this number. */
export const PAGE_SIZE = 20;

/** Normalize a `?page=` search param to a 1-based page number. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Prisma `skip` for a given page. */
export function pageSkip(page: number, size: number = PAGE_SIZE): number {
  return (Math.max(1, page) - 1) * size;
}

/**
 * Derive the values `TablePagination` needs from a page number and total count.
 * Use for the explicit `<TablePagination {...paginationView(page, total)} .../>`
 * footer that every list page renders once (mobile + desktop share it).
 */
export function paginationView(page: number, total: number, size: number = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    page: current,
    totalPages,
    total,
    skip: (current - 1) * size,
    take: size,
    rangeStart: total === 0 ? 0 : (current - 1) * size + 1,
    rangeEnd: Math.min(current * size, total),
  };
}

type ParamValue = string | number | null | undefined;

/**
 * Build a `hrefForPage(target)` function that preserves the current filters.
 *
 * Pass the base path and the currently-active filters (already narrowed to the
 * values you want carried across pages). `page` is added only when > 1 so the
 * first page stays clean.
 *
 *   const hrefForPage = pageHrefBuilder("/documents/invoices", { status, q });
 *   <DataTable pagination={{ page, pageSize: PAGE_SIZE, total, hrefForPage }} />
 */
export function pageHrefBuilder(
  basePath: string,
  filters: Record<string, ParamValue> = {},
): (target: number) => string {
  return (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined) continue;
      const str = String(value).trim();
      if (str.length > 0) params.set(key, str);
    }
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
}
