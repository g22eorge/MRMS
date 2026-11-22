# Tables retired at the Postgres migration

These tables exist in the production SQLite database but are **not** carried into
Postgres. Each was verified to have zero code references across `app/`, `lib/`,
`components/` and `scripts/` before being retired. The dropped row contents are
recorded here so the decision is reversible from this document alone — and the
original dump remains the authoritative copy regardless.

The exclusion list itself lives in `scripts/pg/junk-tables.mjs`.

## Debris from past emergency repairs

### `Organisation` — 1 row

A UK-spelling duplicate of `Organization`, created by an old raw-DDL typo. The
live `Organization` table holds the real record for the same organisation. The
only occurrences of the word "Organisation" in the codebase are UI label text.

Dropped row: `org_eis_01` / Eagle Info Solutions / `eagle-info-solutions` /
ENTERPRISE / Africa/Kampala / UGX — all of which are present in `Organization`.

### `Job_restore_backup_20260426` — 1 row

A one-off backup table taken during the 2026-04-26 `Job` column repair. No code
references it.

## Abandoned features: DDL created, never read

Branch-level document numbering, branch opening hours and per-org security
policy were provisioned as tables but the features were never built. Document
numbering is resolved from `DocumentBrandingSettings` instead — see
`lib/commercial/org-number.ts`.

### `BranchNumberingSettings` — 1 row

Its prefixes duplicate what `DocumentBrandingSettings` already stores and what
the app actually uses, so nothing functional is lost:

| Column | Value |
| --- | --- |
| `id` | `branch_num_eis_main` |
| `branchId` | `branch_eis_main` |
| `jobPrefix` | `EI` |
| `invoicePrefix` | `INV` |
| `salePrefix` | `SALE` |
| `quotePrefix` | `QT` |
| `quotationPrefix` | `QT` |
| `receiptPrefix` | `RCT` |
| `nextJobSequence` | `1` |
| `nextSaleSequence` | `1` |
| `updatedAt` | `2026-05-25 11:10:00` |

Note the duplicated `quotePrefix` / `quotationPrefix` and the unused
`nextJobSequence` / `nextSaleSequence` counters — the table had been patched by
successive `ALTER TABLE` runs without the first set ever being removed, which is
itself evidence it was never in use.

### `BranchOperatingHours` — 0 rows

Empty. Also carried duplicate column pairs from repeated patching
(`openTime`/`opensAt`, `closeTime`/`closesAt`, `isOpen`/`isClosed`).

### `OrgSecurityPolicy` — 0 rows

Empty. Intended to hold `mfaRequired`, `sessionTimeoutMinutes` and
`ipAllowlist`; none of those are read anywhere.

## If any of these features is built later

Model it properly in `prisma/schema.prisma` and let a migration create it. Do
not resurrect the raw-DDL pattern: it is what produced the 51-column /
16-column / 6-table drift this migration had to reconcile in the first place.
