import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * Shared, lean table used across the app.
 *
 * Server-component friendly (no hooks, no "use client") so cells can hold
 * server-action <form>s. Renders a bordered frame, a hairline header, and
 * row-separated compact rows. Provide `actions` to append a right-aligned
 * actions column — omit it entirely when a table has no row actions.
 *
 * ── Cell typography (one scale for every table in the app) ──
 * Cells inherit the table's 13px body size — do NOT set `text-xs`/`text-sm`/
 * `text-[13px]` on cells; that is what made tables disagree page to page.
 *   • identifiers / document numbers → `mono font-semibold` (never `font-mono`)
 *   • money + quantities            → `tabular-nums whitespace-nowrap`
 *                                     (`font-semibold` for the emphasis column)
 *   • secondary line inside a cell  → `text-[12px] text-[var(--ink-muted)]`
 * Use `dense` for sub-tables inside a detail card; leave list tables default.
 */

type Align = "left" | "right" | "center";

export type DataTableColumn<T> = {
  /** Unique column id. */
  key: string;
  /** Header label. Leave empty for an unlabeled column. */
  header?: ReactNode;
  /** Cell renderer. */
  cell: (row: T, index: number) => ReactNode;
  /** Extra classes on each <td> (e.g. font-mono, max-w-[220px] truncate, whitespace-nowrap). */
  className?: string;
  /** Extra classes on the <th>. */
  headerClassName?: string;
  align?: Align;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  /** Optional right-aligned actions column. May return null per row. */
  actions?: (row: T, index: number) => ReactNode;
  /** Shown when there are no rows. */
  empty?: ReactNode;
  /**
   * Optional mobile card renderer. When provided, cards show below `lg` and
   * the table shows from `lg` up. When omitted, the table scrolls
   * horizontally on small screens instead.
   */
  renderMobileCard?: (row: T, index: number) => ReactNode;
  /** Extra classes on the outer frame. */
  className?: string;
  /** Drop the bordered frame — for embedding inside an existing card. */
  frameless?: boolean;
  /**
   * Server-side pagination. When provided, the component renders a pagination
   * footer automatically below the table. Omit only for tables that genuinely
   * show every row.
   */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    hrefForPage: (page: number) => string;
    unit?: string;
  };
  /**
   * Extra classes for a specific row's <tr> — e.g. tint rows that need
   * attention ("bg-amber-500/5") or add a left status strip.
   */
  rowClassName?: (row: T, index: number) => string | undefined;
  /**
   * Rendered inside <tfoot>, after all rows. Pass complete <tr> elements
   * (use `colCount` to size colSpans). For totals/summary rows.
   */
  tableFooter?: ReactNode;
  /**
   * Render a full-width section row *before* this row (group separators,
   * date headers). Return null/undefined for no separator.
   */
  renderSectionRow?: (row: T, index: number) => ReactNode;
  /** Tighter cells (px-3 py-2) — for report tables and detail sub-tables. */
  dense?: boolean;
  /** Hide the header row (line-item editors, simple key/value tables). */
  hideHeader?: boolean;
/**
 * Row click handler (client components only — e.g. open a detail drawer).
 * Pair with `rowClassName` returning "cursor-pointer". Interactive elements
 * inside cells should stopPropagation.
 */
onRowClick?: (row: T, index: number) => void;
};

/** Total <td> count of a DataTable — for colSpan in tableFooter/section rows. */
export function colCount<T>(props: Pick<DataTableProps<T>, "columns" | "actions">) {
  return props.columns.length + (props.actions ? 1 : 0);
}

function alignClass(align: Align | undefined) {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  actions,
  empty = "No records found.",
  renderMobileCard,
  className,
  frameless,
  pagination,
  rowClassName,
  tableFooter,
  renderSectionRow,
  dense,
  hideHeader,
  onRowClick,
}: DataTableProps<T>) {
  const cell = dense ? "px-3 py-2" : "px-4 py-2.5";
  const footer = pagination ? (
    <TablePagination
      page={pagination.page}
      totalPages={Math.max(1, Math.ceil(pagination.total / pagination.pageSize))}
      rangeStart={pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1}
      rangeEnd={Math.min(pagination.page * pagination.pageSize, pagination.total)}
      total={pagination.total}
      hrefForPage={pagination.hrefForPage}
      unit={pagination.unit}
    />
  ) : null;

  if (rows.length === 0) {
    return (
      <div className={frameless ? undefined : "space-y-3"}>
        <div className={frameless ? "px-6 py-16 text-center text-sm text-[var(--ink-muted)]" : "rounded-xl border border-[var(--line)] bg-[var(--panel)] px-6 py-16 text-center text-sm text-[var(--ink-muted)]"}>
          {empty}
        </div>
        {footer}
      </div>
    );
  }

  const frame = frameless
    ? (className ?? "")
    : `overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] ${className ?? ""}`;

  const table = (
    <div className={frame}>
      {/* Mobile cards */}
      {renderMobileCard ? (
        <div className="lg:hidden">
          {rows.map((row, i) => (
            <div key={getRowKey(row, i)} className={i > 0 ? "border-t border-[var(--line)]/40" : ""}>
              {renderMobileCard(row, i)}
            </div>
          ))}
        </div>
      ) : null}

      {/* Table */}
      <div className={`overflow-x-auto ${renderMobileCard ? "hidden lg:block" : "block"}`}>
        <table className="w-full text-left text-[13px]">
          {hideHeader ? null : (
            <thead>
              {/* One header treatment for every table in the app — do not
                  override per call site. */}
              <tr className="border-b border-[var(--line)]/70 bg-[var(--panel-strong)]/60 text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]/70">
                {columns.map((c) => (
                  <th key={c.key} className={`${cell} font-semibold ${alignClass(c.align)} ${c.headerClassName ?? ""}`}>
                    {c.header}
                  </th>
                ))}
                {actions ? (
                  <th className={`${cell} text-right font-semibold`}>
                    <span className="sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-[var(--line)]/60">
            {rows.map((row, i) => {
              const section = renderSectionRow?.(row, i);
              const tr = (
                <tr
                  key={getRowKey(row, i)}
                  onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                  className={`transition-colors hover:bg-[var(--panel-strong)]/40 ${rowClassName?.(row, i) ?? ""}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`${cell} ${alignClass(c.align)} ${c.className ?? ""}`}>
                      {c.cell(row, i)}
                    </td>
                  ))}
                  {actions ? (
                    <td className={`${cell} text-right`}>
                      <div className="inline-flex items-center justify-end gap-1">{actions(row, i)}</div>
                    </td>
                  ) : null}
                </tr>
              );
              if (!section) return tr;
              return (
                <Fragment key={`s-${getRowKey(row, i)}`}>
                  <tr className="bg-[var(--panel-strong)]/50">
                    <td colSpan={columns.length + (actions ? 1 : 0)} className={`${dense ? "px-3 py-1.5" : "px-4 py-2"} text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]`}>
                      {section}
                    </td>
                  </tr>
                  {tr}
                </Fragment>
              );
            })}
          </tbody>
          {tableFooter ? (
            <tfoot className="border-t border-[var(--line)] bg-[var(--panel-strong)]/40 text-[13px] font-semibold">
              {tableFooter}
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );

  if (!footer) return table;
  return (
    <div className="space-y-3">
      {table}
      {footer}
    </div>
  );
}

export type TablePaginationProps = {
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  /** Build the href for a given page number. */
  hrefForPage: (page: number) => string;
  /** Noun for the total, e.g. "messages". */
  unit?: string;
};

export function TablePagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  hrefForPage,
  unit = "records",
}: TablePaginationProps) {
  if (total <= 0) return null;

  const edge = "rounded-lg border px-3 py-1.5 font-semibold transition-colors";
  const enabled = `${edge} border-[var(--line)] text-[var(--ink)] hover:bg-[var(--panel-strong)]`;
  const disabled = `${edge} border-[var(--line)]/50 text-[var(--ink-muted)]/40`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-[var(--ink-muted)]">
      <span>
        Showing <span className="font-semibold tabular-nums text-[var(--ink)]">{rangeStart}–{rangeEnd}</span> of{" "}
        <span className="font-semibold tabular-nums text-[var(--ink)]">{total}</span> {unit}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefForPage(page - 1)} className={enabled}>Prev</Link>
        ) : (
          <span className={disabled}>Prev</span>
        )}
        <span className="tabular-nums">Page {page} / {totalPages}</span>
        {page < totalPages ? (
          <Link href={hrefForPage(page + 1)} className={enabled}>Next</Link>
        ) : (
          <span className={disabled}>Next</span>
        )}
      </div>
    </div>
  );
}
