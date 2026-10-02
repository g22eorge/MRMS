# SPEC-006: Corporate credit (limits, terms, statements)

Status: SPEC (not built). Date: 2026-09-25.

## Problem
B2B shops sell on credit with no rails: no per-client limit, no terms, no
automatic statements. Overdues are chased by memory.

## Current state (evidence)
- `Client` has NO `creditLimit`/`paymentTerms` (grep: zero hits). Terms exist
  only as a global fallback (`PaymentReminderSettings.paymentTermsDays=30`).
- Statements IMPLEMENTED (`getClientStatement`/`getSupplierStatement`) and
  wired to client page, statement API, and portal.
- Invoice reminders IMPLEMENTED (cron ladder + bulk button); supplier auto-
  chase absent; no aged-receivables route (invoice list buckets instead).

## Requirements
1. `Client.creditLimit Float?` + `Client.paymentTermsDays Int?` (null = global
   fallback; explicit 0/empty = cash only).
2. Credit check at invoice issue + POS charge-to-account: warn when the new
   balance would exceed the limit (block only with an explicit override
   permission — same pattern as discount overrides).
3. Statements already exist: link them from the client page and the overdue
   reminder (the ladder already pulls multi-invoice statements).
4. Overdue ladder reuses per-client terms instead of the global fallback.

## Acceptance criteria
- Unit: check math (at/over/under limit, null-limit fallback, cash-only).
- E2E: set limit → over-limit invoice blocked with message → override with
  permission succeeds → statement shows the balance.
- Migration: additive nullable columns; existing clients unconstrained.

## Risks
- Currency: limits denominated in org base; foreign invoices convert at their
  snapshot rate (same rule as payment-sync).
- Do not auto-block without the override path — goodwill credit is a business
  decision, the system advises.

## Verification
- New `corporate-credit` E2E + unit; existing invoice/payment specs green.
