# DESIGN.md — the system design contract

**The Documents module is the canonical design identity for this app.** Every page —
list, detail, hub, form — is assembled from the same kit, in the same places, so a
user who learns Documents finds the title, status, primary action, overflow menu,
filters, and "Back" in the *exact same spots* everywhere. Consistency is the identity.

This file is the single source of truth. New pages MUST follow it; existing pages are
being swept into conformance module by module. Reference implementations to copy:
`app/(app)/documents/invoices/page.tsx` (list) and `documents/invoices/[id]/page.tsx`
(detail).

---

## 1. The kit (never hand-roll these)

| Concern | Component | Path |
|---|---|---|
| List page frame | `ListPageLayout` | `components/ui/ListPageLayout.tsx` |
| Page header + KPI band | `PageHeader` (via `ListPageLayout.header`) | `components/ui/PageHeader.tsx` |
| Table | `DataTable` (+ `renderMobileCard`) | `components/ui/DataTable.tsx` |
| Row / record actions menu | `RowActionsMenu` + `MenuActionLink` / `MenuActionButton` / `MenuSection` / `MenuDestructiveRow` | `components/shared/RowActionsMenu.tsx` |
| Detail header + action bar | `RecordActionBar` | `components/record/RecordActionBar.tsx` |
| Detail right-hand summary | `RecordSummaryRail` | `components/record/RecordSummaryRail.tsx` |
| Status pill | `StatusBadge` + `toneFor` (`BadgeTone`) | `components/ui/StatusBadge.tsx` |
| Multi-page module nav | tab-pill Shell (see §5) | `components/{documents,communications,finance}/*Shell.tsx` |

---

## 2. List pages

```
<ListPageLayout header={{ eyebrow, title, kpis, actions }} filters={…}>
  <DataTable rows columns actions renderMobileCard getRowKey pagination empty />
</ListPageLayout>
```

Rules:
- **Header** = `eyebrow` (the module, e.g. "Inventory") + `title` + a **KPI stat band**
  (`kpis: [{ label, value, sub?, valueClass? }]`) + a right-aligned `actions` cluster
  (primary create button last). Prefer a KPI band over a `description` string when there
  are numbers to show.
- **Table** = `DataTable`. **Always pass `renderMobileCard`** so it shows cards below
  `lg` and a table at `lg+`. A raw `<table>` or a table with no mobile card is a bug.
- **Row actions** = an `actions={renderRowActions}` function that returns a
  `RowActionsMenu` (or a small button cluster). It MUST also be rendered inside
  `renderMobileCard` — extract it to a named `const renderXActions = (row) => …` and use
  it in both places (`renderMobileCard` does not receive `actions`).
- **Empty state** = the `empty` prop, one friendly sentence.

---

## 3. Detail pages

```
<RecordActionBar backHref eyebrow title status primary secondary overflow />
<div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
  <div className="space-y-4"> …main content… </div>
  <RecordSummaryRail headline rows party related activity />
</div>
```

Rules:
- **Never hand-roll the header.** `RecordActionBar` renders: `Back` (via `backHref`, →
  the list) · `eyebrow` + `title` · `status` pill · then the ranked action cluster.
- **Action ranking is fixed and identical everywhere:**
  - `primary` — the ONE contextual main action (Collect Payment, Convert, Issue…).
  - `secondary` — common actions (PDF, Edit, Preview).
  - `overflow` — the ⋮ menu for **rare / destructive** actions (Cancel, Delete, Void,
    Reverse) and share options. Destructive actions never sit loose in the main row or
    at the bottom of the page.
- **Summary rail** (right column) via `RecordSummaryRail`: `headline` (the big number,
  e.g. Total), `rows` (key facts), `party` (counterparty card — client/supplier/lead),
  `related` (linked docs with `href`), `activity` (timeline). Same shape on every record.

---

## 4. Actions — the same slots on every screen

- Create/primary: right end of the list header.
- Row/record primary: `RecordActionBar.primary` / list row leading action.
- Common: `secondary`.
- Rare + destructive: the `⋮` `RowActionsMenu` — nowhere else.
- "Back" always returns to the parent list via `RecordActionBar.backHref`.

---

## 5. Multi-page modules → a tab-pill Shell

A module with several pages gets a `Shell` (a `layout.tsx` wrapping children in a
tab-pill nav), so its sub-pages read as one hub. Pattern: a `lib/<module>/routes.ts`
(`<MODULE>_NAV` + `<module>NavForRole`) + a `<Module>Shell` mirroring
`components/documents/DocumentsShell.tsx` + an `app/(app)/<module>/layout.tsx`.
Live examples: Documents, Communications, Finance.

---

## 6. Tokens (one palette)

Use only: `--line` (borders), `--panel` / `--panel-strong` (surfaces), `--ink` /
`--ink-muted` (text), `--accent` (brand). Active pill = `bg-[var(--accent)] text-black`.
Never `bg-white`, `--surface`, `--border`, `--surface-raised`, or hardcoded
`border-emerald-200`-style light-mode colors — they break dark mode. Use the `mono`
class, not `font-mono`.

**One surface language ("bordered & tight").** Every panel/card/KPI tile is a hairline
border on `--panel` at the canonical 12px radius (rounded-xl) — add `panel-shadow` for
elevation. Radius is rounded-xl everywhere, never rounded-2xl. The dc token family
(names beginning `--dc-`) is NOT a page-body surface language: don't hand-use the
`dc-card` class, dc backgrounds, or dc box-shadows in a page. The `dc-card` class itself
now renders as the bordered surface, and the dc status colors (good / warn / crit) are
consumed only via the `StatCards` / `StatStrip` `tone` prop — never hand-passed as a dc
text colour.

**Colour = meaning, not decoration.** The whole app draws from ONE locked palette.
Colour is reserved for status/semantic meaning; everything structural is neutral.

- Brand / active / primary → the gold accent (`--accent`). Primary buttons, the active
  nav item, brand marks. Nothing else is gold.
- Success (paid, ready, completed, positive) → emerald.
- Warning (due, pending, needs attention) → amber.
- Critical (overdue, unpaid, failed, danger) → red.
- Info (in-progress, neutral highlight) → sky.
- Everything else — surfaces, text, borders, and all decorative / module / nav icons —
  is neutral (`--ink`, `--ink-muted`, `--panel`, `--panel-strong`, `--line`).

Module and nav icons are monochrome (neutral, or gold only when active/primary) — they
do NOT get their own decorative hue. Retired hues: green → emerald, orange → amber,
rose → red; and violet / purple / teal / fuchsia / pink / indigo / cyan / yellow are not
part of the palette — fold them into the five above or neutral.

---

## 7. Conformance checklist (per page)

- [ ] List: `ListPageLayout` + KPI-band header + `DataTable` **with `renderMobileCard`**
- [ ] List: row actions reachable on mobile (inside the mobile card)
- [ ] Detail: `RecordActionBar` (back · eyebrow+title · status · primary/secondary/**⋮**)
- [ ] Detail: destructive actions in the `⋮` overflow only
- [ ] Detail: `RecordSummaryRail` in a right column
- [ ] Module hub: tab-pill Shell via a layout
- [ ] Tokens: `--line`/`--panel`/`--ink`/`--accent` only; no `bg-white`/`font-mono`
- [ ] Verified: tsc + lint + `vercel-build` green; page renders 200 in the browser
