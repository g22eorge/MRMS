# Issue Register

| ID | Finding | Priority | Status | Owner |
|---|---|---|---|---|
| P0-01 | New commercial registrations crashed on /onboarding (client bundle imported @prisma/client via module-catalog/ModuleIcon/plan-prices chains) | P0 | RESOLVED 2026-09-24 — client-safe split (type-only enum imports, plan-price-table, ModuleIcon); `onboarding-flow` E2E 1/1; full E2E 32/32 | Backend + QA |
| P1-01 | Repair parts free-text bypass (ADR-003) | P1 | RESOLVED 2026-09-23 — notes-only labels + `tests/e2e/repair-parts.spec.ts` (reserve→CONSUMED→stock→ledger, 1/1 pass) | Backend + QA |
| P1-02 | Money Float rounding discipline + tests (ADR-001) | P1 | RESOLVED 2026-09-23 — `payment-sync.ts` returns rounded on all paths (`toDocumentBase`, both paid sums); helper locked by `money-rounding.test.ts`; full unit 1108/0 fail | Backend + QA |
| P1-03 | Tenant FK critical subset + scoping tests (ADR-002) | P1 | RESOLVED 2026-09-23 — 4 FKs live (push-verified on prisma/dev.db + fresh test.db), PG regen, unit 1108/0 fail, drift-check OK, repair-parts E2E 1/1 | Architect + DB |
| P2-01 | Governance docs skeleton + traceability upkeep | P2 | IN PROGRESS (this baseline) | Tech Writer |
| P2-02 | Upload-limit drift (docs 5MB vs code 15MB) + test imports validator | P2 | RESOLVED 2026-09-23 — limits+validator moved to dependency-free `lib/upload-limits.ts`, re-exported by `lib/blob-storage.ts`; test imports real logic; checklist corrected to 15MB/2MB | Backend |
| P3-01 | Split >2000-line components on next touch (`JobDetailTabs`, `db-fix`) | P3 | DEFERRED | Frontend |

Rules: P0 = blocker, P1 = critical, P2 = important, P3 = improvement. No P0 claimed — release was already NOT READY, so nothing new blocks.
