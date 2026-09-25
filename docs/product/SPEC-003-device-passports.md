# SPEC-003: QR device passports (scan-to-history + warranty proof)

Status: SPEC (not built). Date: 2026-09-25.

## Problem
A device's life (repairs, parts, warranty) lives in staff screens. Resale,
repeat visits, and warranty claims all start from zero — the customer proves
nothing, the shop re-asks everything.

## Current state (evidence)
- Identity stored: `Device.serialOrImei`, `Job.serialOrImei`, request serials;
  shown in staff intake/edit, portal repairs, job-card PDF. `Part` has no serial.
- Warranty stored + shown (portal active/expired text, staff panel, claims).
- QR used exactly once: job-card status URL (`generate-job-card.ts:57`).
- No public warranty lookup; public tracker deliberately excludes serials.

## Requirements
1. Per-device unguessable passport token (`Device.passportToken`, unique,
   nullable; generated on demand, rotatable). Never the serial, never the job number.
2. Public `/passport/[token]`: device identity, repair timeline (dates +
   work summaries, no prices/PII beyond what the holder already knows),
   warranty status with expiry, claim CTA.
3. QR of the passport URL printed on job cards + a stick-on label format.
4. Staff: "Issue / rotate passport" action on the device; portal links it.

## Acceptance criteria
- E2E: issue passport → public URL shows history + warranty, no prices;
  rotate → old URL 404s.
- Security: token entropy ≥ 128 bits; enumeration of `/status` numbers must
  not resolve passports; expired warranty states "expired", never silently.
- Unit: token generation uniqueness + rotation invalidation.

## Risks
- Physical labels outlive data corrections — passport shows live data, print
  only the URL.
- Part-level serials explicitly out of scope (no schema field; separate project).

## Verification
- New `device-passport` E2E + permission tests (no PII leakage to anonymous
  holders beyond the agreed surface).
