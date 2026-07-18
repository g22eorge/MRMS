# UI Cleanup & Refactor Plan

Audit date: 2026-07-14. Goal: remove duplicated links and duplicated UI across pages, adopt shared components, and get a compact, consistent, clean UI. Implement items one at a time, top to bottom.

---

## Findings summary

### A. Navigation — duplicated links, no single source of truth
There are **7+ independent link registries** that each hardcode the same routes with different labels:

| Registry | File |
|---|---|
| Sidebar model ("almost" canonical, incomplete) | `lib/nav/sidebar-model.ts` |
| Mobile bottom nav + More groups | `components/layout/BottomNav.tsx` |
| Mobile More page | `app/(app)/more/page.tsx` |
| Command palette actions | `lib/command-palette/quick-actions.ts` |
| Mobile quick-actions grid | `components/layout/MobileQuickActions.tsx` |
| FAB / speed-dial builders | `app/(app)/layout.tsx` (~L257, L275) |
| Header PRIMARY_TABS + user menu | `components/layout/Header.tsx` (~L68) |
| Dashboard (60+ hardcoded hrefs) | `app/(app)/dashboard/page.tsx` (~1650 lines) |

Concrete bugs/inconsistencies:
- **Duplicate links in the same menu**: `BottomNav.tsx` has two entries for `/reports` (`ITEMS.reports` L66 and `ITEMS.activity` L89) and two for `/documents/invoices` (L74 and L87).
- **Same page, different labels**: `/jobs` = Jobs/Queue/Work Queue; `/pos` = Point of Sale/POS/Product Sale/Sale/Record Sale; `/dashboard` = Dashboard/Home; `/intake` = Intake/Requests; `/technicians` = Techs/Technicians; `/inventory` = Inventory Items/Inventory; `/ai-insights` = AI Insights/AI Guide.
- **`hrefModule` map duplicated** in `sidebar-model.ts` L180–211 and `BottomNav.tsx` L93–105 (drift independently).
- **Dead entries** in `sidebar-model.ts`: `roleOrder`/`hrefModule` reference hrefs not in `NAV[]` (`/payout-followups`, `/field`, `/technicians`, `/reports`, `/ai-insights`, …) so they never render.
- **Desktop vs mobile expose different destinations**: `/technicians`, `/reports`, `/ai-insights`, `/field`, `/complaints` exist only on mobile surfaces.

Good in-repo pattern to copy: `lib/documents/routes.ts` and `lib/communications/routes.ts` (typed ROUTES + NAV + navForRole()).

### B. Duplicated page UI (should be components)
| Pattern | Scope | Existing component (underused) |
|---|---|---|
| Hand-rolled `<table>` markup | ~55+ pages (64 files) | `components/ui/DataTable.tsx` — used by only 3 pages |
| Inline page header (eyebrow + h1 + actions card) | ~70+ pages | `components/documents/DocumentPageHeader.tsx` — used by 2 pages |
| Inline KPI/stat strips | ~30+ pages | `components/documents/DocumentKpiStrip.tsx` — used by 2 pages |
| Local status-badge color maps | 47 files / 94 badge spans | only `JobStatusBadge` is shared |
| Hand-rolled filter/search bars | ~15–20 list pages | `components/documents/DocumentFilterBar.tsx` |
| Inline empty states | most list pages | `components/page-state/PageEmptyState.tsx` (only used in error/loading routes) |
| Pagination | 3 divergent implementations | `DataTable`'s `TablePagination` |
| Checkbox inputs (incl. hidden-"false" idiom) | 19 files, no `<Checkbox>` primitive | none |
| Tax toggle + subtotal/tax/total block | ~8 commerce forms | none (`CommercialLineItemsEditor` is close) |
| Bespoke 630-line `JobTable` | duplicates DataTable's pagination/mobile cards | should converge on `DataTable` |

Tax/checkbox duplication sites: `sales/quotations/new/NewQuotationForm.tsx` L385–393, `documents/invoices/CreateStandaloneInvoiceForm.tsx`, `components/jobs/JobDetailTabs.tsx` L1822 (VAT 18%), `inventory/supplier-bills/new/*`, `inventory/purchase-orders/new/*`, `pos/[id]/page.tsx`, `documents/credit-notes/CreateCreditNoteDialog.tsx`.

### C. Cramped UI causes
- Inconsistent cell padding per page: `px-3 py-2` vs `px-4 py-2.5` vs `px-4 py-3`.
- Ad-hoc tiny type: `text-[10px]`…`text-[13px]` used interchangeably.
- No `ListPageLayout` shell — every page hand-stacks header → KPIs → filters → table with its own borders/spacing (`space-y-3` vs `space-y-5`).
- Double headers: `PageThemeHeader` renders a route title AND pages render their own inline header card.

---

## Implementation plan (one item at a time)

### 1. Nav registry — single source of truth  ✅ quick wins first
- 1a. Remove duplicate `ITEMS.activity` (→/reports) and `ITEMS.invoices` (→/documents/invoices) in `BottomNav.tsx`.
- 1b. Merge the two `hrefModule` maps into one exported constant in `lib/nav/`.
- 1c. Extend `lib/nav/sidebar-model.ts` NAV into a full registry: `{ key, href, label, shortLabel?, iconKey, group, roles, module, surfaces[] }`; add missing leaf routes.
- 1d. Derive BottomNav, `/more` page, command palette, MobileQuickActions, FAB actions, and Header PRIMARY_TABS from the registry. One canonical label per route.

### 2. `StatusBadge` component
Generic `<StatusBadge tone|colorKey>` extracted from `JobStatusBadge`; replace the 47 local color maps incrementally.

### 3. `ListPageLayout` + generalize `PageHeader`
Promote `DocumentPageHeader` → `components/ui/PageHeader.tsx`; add `ListPageLayout` (header / kpis / filters / children slots) with one spacing scale. Kill double-header rendering.

### 4. Generalize `DocumentKpiStrip` → `StatStrip`
Replace ~30 inline stat grids.

### 5. Migrate tables to `DataTable`
Cluster by module: documents (invoices, quotations, credit-notes, refunds first — sibling pages already use the doc components) → inventory → finance → sales/pos/rest. Consolidate all pagination on `TablePagination`. Fold `JobTable` onto `DataTable` last (biggest/riskiest).

### 6. Form primitives: `CheckboxField` + `TaxToggleField` + `LineItemTotals`
- `CheckboxField` standardizes the checkbox + hidden-"false" idiom (19 files).
- `TaxToggleField` + `LineItemTotals` unify the tax checkbox and subtotal/tax/total block across the ~8 commerce forms.

### 7. Empty states + density pass
Route inline "No records" blocks through `PageEmptyState`; settle one type/padding scale (e.g. labels `text-[11px]`, cells `px-3 py-2`) applied via the shared components.

### 8. Dashboard slim-down
`app/(app)/dashboard/page.tsx` (~1650 lines): pull hrefs from the nav registry, split into section components, reuse StatStrip/DataTable.

---

## Status

| # | Item | Status |
|---|---|---|
| 1a | BottomNav duplicate links | ✅ done (2026-07-14) — removed dup `activity`/`invoices`/dead `finance` ITEMS; More menu now generically excludes anything already in the primary bar |
| 1b | Unified hrefModule | ✅ done (2026-07-14) — new `lib/nav/href-module.ts` (`HREF_MODULE` + `hrefModuleAllowed`), consumed by sidebar-model and BottomNav |
| 1c | Full nav registry | ✅ done (2026-07-14) — `lib/nav/registry.ts` (ROUTE map, routeLabel/routeShortLabel), one canonical label per route |
| 1d | Derive all surfaces from registry | ✅ done — sidebar NAV, BottomNav ITEMS, /more NavRows, command palette, MobileQuickActions, FAB/speed-dial, Header primary tabs (now derived from BottomNav via getPrimaryHrefs) |
| 2 | StatusBadge | ✅ done — `components/ui/StatusBadge.tsx` (13 tones + toneFor); adopted across documents, inventory, finance, sales, pos, complaints, payout-followups list pages |
| 3 | ListPageLayout / PageHeader | ✅ done — `components/ui/PageHeader.tsx` + `ListPageLayout.tsx`; Document* wrappers now delegate; PageThemeHeader suppressed on /documents + /communications (double-header fix) |
| 4 | StatStrip | ✅ done — `components/ui/StatStrip.tsx` (embedded/cards); DocumentKpiStrip delegates |
| 5 | DataTable migration | ✅ done — ~27 list pages migrated (documents, inventory ×8, finance ×6, sales/pos/complaints/payout-followups/campaigns/shifts). Deliberately kept: deeply interactive tables (technicians board, sales leads, bank ledger w/ tfoot, journal cards); JobTable convergence still open |
| 6 | CheckboxField / TaxToggleField / LineItemTotals | ✅ done — `components/forms/` primitives; adopted in NewQuotationForm, CreateStandaloneInvoiceForm, JobDetailTabs (VAT), NewSupplierBillForm, CreateCreditNoteDialog. PO form skipped (tfoot totals, no toggle) |
| 7 | Empty states + density | ✅ done — empty states via DataTable `empty` prop / PageEmptyState; density unified through shared components |
| 8 | Dashboard slim-down | ✅ done — page.tsx 3003 → 84 lines (role dispatcher) + sections/ per role; labels canonicalized via routeLabel |

### Also fixed (2026-07-14)
- Topbar: bell/BottomNav badges resized to fit (10px in 16px dot + panel ring), user pill locked to h-9, role chip proportional — controls now align.
- Finance hub: removed the redundant Quick Links strip that duplicated Invoices/Expenses/P&L/Balance Sheet/Bank/Payouts tiles; group tiles labeled from the registry.

### Table unification (2026-07-14, second pass)
- `DataTable` extended: `rowClassName`, `tableFooter` (tfoot totals), `renderSectionRow` (group separators), `dense`, `hideHeader`, `onRowClick`, `colCount` helper.
- ALL remaining hand-rolled tables migrated (~40 files): finance (bank/journal/accounts-ledger/P&L/cash-flow), reports, settings (audit/data-heal/groups), platform (orgs/audit/payments), all inventory detail pages + line-item editors, pos/[id], quotations/[id], procurement, field, intake client, JobTable (631→565), technicians board, sales leads, JobDetailTabs, AdminTechLeaderboard.
- `DocumentListTable` deleted (its 2 consumers now use DataTable directly).
- Only intentional exception: `app/(legal)/privacy/page.tsx` (hardcoded dark marketing theme — DataTable's theme vars would break it).

### Remaining (optional follow-ups)
- Pre-existing tsc errors (untouched baseline): documents/invoices/reminder-actions.ts, service/page.tsx, settings/notifications/whatsapp/actions.ts, lib/queue/*.
- Pre-existing eslint errors: PageThemeHeader.tsx + NotificationBell.tsx (setState-in-effect patterns).
