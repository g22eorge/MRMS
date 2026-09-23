# ADR-002: Tenant FK coverage (app-scoped vs DB-enforced orgId)

## Context
Schema has 119 models. ~41 carry `orgId String` with no `Organization` relation (e.g. `Receipt`, `InvoiceLine`, `TechnicianPayout`, `PartLocationStock`, `Conversation`, `FileAsset`, `CampaignContact`, `Ai*`). Nullable-`orgId` parents exist: `User`, `Quotation`, `Lead`, `RepairRequest`, `OutboundMessage`, `AuditLog`, `Photo`, `PosSession`, `FieldVisit`. Runtime isolation pattern is real: `requireOrgSession` (`lib/org-context.ts`), `scopedDb/orgDb` (`lib/prisma-scope.ts`, `lib/db.ts`), `can.*` matrix (`lib/permissions.ts`), `assertOrgCanMutate` (`lib/org-write.ts`).

## Problem
Join/cascade safety for orphan-`orgId` tables is app-enforced only. Exhaustive per-query scoping is UNVERIFIED. Nullable parents (`Quotation.orgId?`, `Lead.orgId?`) can host org-less children.

## Options Considered
1. Add real `Organization` FKs to all orphan-`orgId` tables + backfill + migration. Strongest guarantee; touches ~41 models and Turso reconciler.
2. Keep app-scoping, add `ORG_SCOPED_MODELS` registry + automated test asserting every orgId-carrying query scopes + non-null `orgId` where required.
3. Hybrid: FKs for financial/inventory-critical tables only (`Receipt`, `InvoiceLine`, `PaymentAllocation`, `PartLocationStock`), app-scoping elsewhere.

## Decision
PROPOSED: Option 3. Financial/inventory tables get FKs; remainder stays app-scoped with registry + tests.

## Reasons
- Evidence shows isolation pattern is consistent where inspected; full rewrite risks breaking working commercial/care split (`CARE_SINGLE_TENANT` pins `EIS_ORG_ID`).
- Targets the highest-risk tables without a 41-model migration.

## Consequences
- Must add FK migration for the critical subset + `db:drift-check` coverage.
- Permission tests must cover cross-org denial per workflow (existing `tenant-isolation.spec.ts` extended).

## Alternatives Rejected
- 41-model FK rewrite now: rejected as disproportionate pre-release.
- Pure app-scoping with no registry: rejected — untraceable.

## Date
2026-09-23

## Status
APPROVED by owner 2026-09-23. Implementation: FK migration for financial/inventory-critical subset + scoping tests.

## Implemented 2026-09-23
`Receipt`, `InvoiceLine`, `PaymentAllocation`, `PartLocationStock` gained
`org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)`
(Cascade matches Invoice/Payment/Sale) + back-fields on `Organization`.
PG variant regenerated via `scripts/pg-schema.mjs`.
Pre-existing drift found and cleared: 9 orphan `PartLocationStock` rows in
`prisma/dev.db` referencing deleted E2E orgs (backup:
`/var/folders/3_/15fvcygs3s15v1rhk4lww3qc0000gp/T/opencode/prisma-dev-pre-fk-backup.db`).
Caveats: `migrate dev` still requires reset from pre-existing push-drift
(unrelated to this change — not acted on); PG deploys need `pg:baseline`
re-run first; repo-root `dev.db` is stale (runtime/CLI/tests all resolve to
`prisma/dev.db` per `lib/prisma.ts` + `prisma.config.ts`) and was left untouched.
