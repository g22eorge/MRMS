# SPEC-001: Automatic tracking links (live repair tracking)

Status: SPEC (not built). Date: 2026-09-25.

## Problem
"If my laptop ready?" calls. The public tracker (`/status/[jobNumber]`) and the
staff share button exist, but no customer ever receives the link unless staff
remember to send it.

## Current state (evidence)
- Public no-auth tracker IMPLEMENTED (`app/status/[...jobNumber]/page.tsx`):
  6-step progress, dates, timeline, complaint link. Serials deliberately
  hidden (anti-harvest comment at `page.tsx:89-93`).
- Staff share IMPLEMENTED (`StatusShareButton`, copy + WhatsApp text), plus a
  status-URL QR on the printed job card (`generate-job-card.ts:57`).
- Auto-send NOT IMPLEMENTED: zero `/status/` references in
  `lib/notifications/`; status-change WhatsApp sends templates without the link.

## Requirements
1. Intake message (job received) includes the tracking link when the client
   has a phone and the org has WhatsApp enabled.
2. Every client-facing status-change message appends the same link.
3. Org-level opt-out (single toggle; default ON for new orgs).
4. Link format unchanged (`/status/[jobNumber]`); no tokens (matches the
   existing public-by-design decision — job numbers are not secrets, IMEIs are).

## Acceptance criteria
- E2E: intake a job with a phone → `OutboundMessage` row contains
  `/status/<jobNumber>`; move to DIAGNOSED → second message contains it.
- E2E: opt-out org → no link appended, messages otherwise unchanged.
- Unit: link builder (slash-number rejoining for `EIS/2026/0041` style numbers).

## Risks
- Message length/cost on metered WhatsApp templates — link goes in the
  free-text tail, not the template body.
- Sequential job numbers are enumerable by design; serials stay excluded.

## Verification
- New `tracking-link` E2E + outbox assertions; existing status-change specs
  must stay green (link is additive).
