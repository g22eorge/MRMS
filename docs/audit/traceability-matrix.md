# Traceability Matrix (baseline — evidence only, no VERIFIED without test)

| Requirement | Design | Implementation | Test | Status |
|---|---|---|---|---|
| Sales quote→invoice→pay→receipt | `document-workflow.ts`, `payment-sync.ts` | `sales/actions.ts`, `pos/[id]/page.tsx`, `invoices/add-payment` | E2E `document-lifecycle` (prior run) | PARTIAL (no `Quotation.saleId`) |
| Purchasing receive→bill→pay | 3-way match | `purchase-orders/actions.ts`, `supplier-bills/actions.ts` | UNVERIFIED (no dedicated E2E) | IMPLEMENTED (code) / UNVERIFIED (test) |
| Repair request→job→invoice | `job-status.ts`, `job-workflow.ts` | `jobs/[id]/actions.ts`, `JobDetailTabs.tsx` | E2E authz/tenant | PARTIAL (parts gap) |
| Repair parts tracking | ADR-003 (proposed) | `inventory-service.ts`, `consume-repair-parts.ts` | None covering free-text bypass | PARTIAL |
| Warranty open→settle | `warranty/cost.ts` | `warranty-actions.ts` | UNVERIFIED | IMPLEMENTED (code) / UNVERIFIED (test) |
| Returns receive→refund→stock | `credit-note-parent.ts` | `credit-notes/page.tsx` | UNVERIFIED | IMPLEMENTED (code) / UNVERIFIED (test) |
| Role permissions | `permissions.ts`, `org-context.ts` | `requireOrgSession`, `assertOrgCanMutate` | E2E `role-escalation`, `tenant-isolation`, `read-only-security` | IMPLEMENTED (pattern) |
| Money correctness | ADR-001 (proposed) | Float fields + FX snapshots | None (rounding) | UNVERIFIED |

Rule: mark VERIFIED only with a passing, named test. Code presence alone = IMPLEMENTED (code) at best.
