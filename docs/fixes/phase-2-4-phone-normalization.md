# Fix 2.4 — Unified phone normalization

**Phase:** 2 (data correctness & trust)  
**Source:** [`system-analysis.md`](../system-analysis.md) UX-8 / Phase 2 item 4  
**Date:** 2026-07-14  
**Status:** Applied

---

## Problem

Three duplicate Uganda phone normalizers drifted apart:

| Location | Output shape |
|----------|--------------|
| `lib/notifications/sms.ts` | E.164 `+256…` |
| `lib/notifications/whatsapp.ts` | Digits `256…` (no `+`) |
| `app/api/webhooks/whatsapp/route.ts` | Same as WhatsApp |

Clients were saved and displayed as entered (`077…` vs `+256…`), so the list mixed formats and wa.me links stripped digits inline.

---

## Change

### New: `lib/phone.ts`

| Export | Purpose |
|--------|---------|
| `normalizeUgPhone(input, { format })` | Single normalizer — `e164`, `whatsapp`, or `digits` |
| `normalizePhoneForStorage()` | Canonical E.164 on client create |
| `formatPhoneDisplay()` | Consistent list/detail display (`+256 7XX XXX XXX`) |
| `phoneTelHref()` / `phoneWhatsAppHref()` | Correct `tel:` and `wa.me` links |
| `phoneLookupVariants()` | Duplicate detection across stored shapes |

### Wired consumers

- `lib/notifications/sms.ts` — E.164 via shared helper
- `lib/notifications/whatsapp.ts` — WhatsApp digits via shared helper
- `app/api/webhooks/whatsapp/route.ts` — inbound sender normalization
- `app/(app)/clients/page.tsx` — normalize on create, display + action links
- `app/(app)/clients/[id]/page.tsx` — formatted display + tel link

### Test

`tests/unit/phone.test.ts` — normalization, display, lookup variants, wa.me href.

---

## Verification

```bash
pnpm exec tsc --noEmit
bun test tests/unit/phone.test.ts
```

Manual: create client with `077…` → stored as `+256…`, list shows spaced format; Call/WhatsApp icons work.

---

## Next

Phase 2.5: Route `sendPdfViaWhatsApp` through outbox.
