# Findings (baseline 2026-09-23)

Only material, evidence-backed findings. Status language: IMPLEMENTED / PARTIALLY / NOT IMPLEMENTED / BROKEN / UNVERIFIED.

1. Money as Float (all ledger fields) — type risk, no failing test observed. UNVERIFIED (rounding discipline). → ADR-001.
2. Tenant FK fragmentation (~41 orphan-`orgId` models; nullable parents `Quotation/Lead/RepairRequest`). Pattern IMPLEMENTED, exhaustive scoping UNVERIFIED. → ADR-002.
3. Repair parts dual-track (free-text bypasses reservations/ledger). PARTIALLY IMPLEMENTED. → ADR-003.
4. Polymorphic links without FK (`PaymentAllocation`, `FileAsset`, `DocumentTaxLine`, `Complaint.saleId`, `Quotation.convertedToInvoiceId`). App-enforced (UNVERIFIED exhaustively).
5. Mixed stock units (Float vs Int across `Part`/`PartLocationStock`/`Transaction`/`SaleItem`/`InvoiceLine`). PARTIALLY IMPLEMENTED.
6. Governance layers missing (`docs/product…audit`, `agents/ skills/ mcps/`). NOT IMPLEMENTED. This baseline starts the record.
7. Observability thin (no structured logger; backup script without `backups/`; restore UNVERIFIED). PARTIALLY IMPLEMENTED.

Non-findings (sound, left alone): purchasing 3-way match + GRN ledger, warranty single-OPEN guard + cost, returns ceiling/FX/dedupe, expenses cap/ledger, org isolation pattern, upload magic-byte validation.
