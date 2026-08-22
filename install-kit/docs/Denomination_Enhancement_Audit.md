# Denomination Enhancement Audit

Scope: repository analysis (frontend + docs) excluding further SQL scanning per instruction. Findings based on `src/` and markdown artifacts.

1) Every affected files / components (frontend)
- `src/components/DenominationFields.tsx` — core denomination input UI (single field "Count" per denom).
- `src/components/ATMSiteSelector.tsx` — per-site denom inputs and availability display.
- `src/pages/ATMReplenishment.tsx` — denom state, `DENOM_VALUES`, `sumDenomsAmount`, validations, totalNotes calculations.
- `src/pages/ATMExcessCash.tsx` — denomination entry and `totalNotes` calculations.
- `src/pages/ATMCashAdjustment.tsx` — denom fields used for adjustments and amount calculation.
- `src/pages/AdminEODDetail.tsx` — displays denom amounts via `(row.denom_X * X)` to compute totals.
- `src/pages/DenominationPlan.tsx` — denominational planning UI, differences reported in notes.
- `src/pages/CashPickup.tsx` (exists in workspace references and backups) — uses `denom_*` fields and `totalNotes`.
- `src/pages/CashTransitCertificate.tsx` — printing/summary uses `plan.denom_*` values.
- Other UI references in analytics and helper modules where `denom_*` objects are aggregated (e.g., `ROBUST_SOURCE_BREAKDOWN_IMPLEMENTATION.md` examples and `AdvancedAnalytics` pages).

2) Where denomination values are entered vs. displayed
- Most input UIs expose a single numeric input labelled `Count` or `Count/notes` per denomination (example: `DenominationFields.tsx`, `ATMSiteSelector.tsx`).
- Amounts are computed client-side by multiplying `count * denomination_value` and shown as `₹{amount}`; totals are sum of such products.

3) Existing database representation (summary from repo DDL/docs previously available)
- Tables contain columns named `denom_10, denom_20, denom_50, denom_100, denom_200, denom_500, denom_2000` as integer columns defaulting to 0.
- Timestamp columns for events (e.g., `pickup_time`, `time_in`, `time_out`, `created_at`) are `timestamp with time zone` in schema.
- Current production semantics: frontend and SQL layers multiply the integer denom columns by face values (100,200.. etc.) to compute amounts. There is no evidence (in frontend code) that any denom_* column stores "bundles" rather than raw note counts.

4) Existing calculation logic in the app
- Client-side: amount = `denom_X * X` and total = sum(amounts). Example in `DenominationFields.tsx`, `ATMSiteSelector.tsx`, `AdminEODDetail.tsx`, `ATMReplenishment.tsx`.
- Some server-side/view SQL (referenced in docs) also compute amounts as `(COALESCE(denom_100,0) * 100) + ...` for aggregated totals and SOA views.

5) Whether existing records can be interpreted as note counts
- Yes: current UI and application logic treat denom_* as raw note counts. There is no evidence of storing bundles. Therefore existing production data are note counts.

6) Trigger / function / SOA / EOD dependencies (high level, non-SQL focused)
- SOA/EOD views and materialized views reference denom_* columns when computing totals and balances (docs and view-migration references indicate this).
- Do NOT change database semantics: existing reports, SOA, EOD, and triggers assume denom_* are counts; modifying their meaning will break calculations.

7) Backward-compatible enhancement recommendation (design)
- Keep DB denom_* columns as note counts (no schema changes).
- Frontend: introduce a second input per denomination for `Bundles` alongside existing `Notes` (or repurpose the current single `Count` input into a pair of inputs). UI rules:
  - Accept either Notes OR Bundles OR both. Effective note count = notes + (bundles * 100).
  - When both fields are edited, compute effective_notes deterministically (prefer last-updated strategy or treat the pair as additive but ensure no double-counting). Recommended: treat both as additive but show derived effective count; if business wants parity, provide explicit guidance and validation.
- Implement these changes only in UI components and form submission layers (convert effective note count to denom_* integer fields when saving to the backend). No DB changes required.

8) Implementation surface (files to change)
- `src/components/DenominationFields.tsx` — change each denom row to expose two numeric inputs: `Notes` and `Bundles` (bundles integer). Compute effective count = notes + bundles * 100 and use that for displayed amount and callbacks to parent.
- `src/components/ATMSiteSelector.tsx` — replace existing single-per-denom input with the new dual-input pattern or adapt to accept an effective count from `DenominationFields`.
- `src/pages/ATMReplenishment.tsx`, `src/pages/ATMExcessCash.tsx`, `src/pages/ATMCashAdjustment.tsx`, `src/pages/DenominationPlan.tsx`, `src/pages/CashPickup.tsx`, `src/pages/AdminEODDetail.tsx` — ensure any local denom-total calculations use the effective note counts produced by updated components.
- API/form submit layers that send `denom_*` to Supabase: ensure they send the effective note counts (notes + bundles*100) into the existing `denom_*` integer columns.
- Reports/print/PDF components (e.g., `CashTransitCertificate.tsx`) — update display to optionally show bundles next to notes for clarity.

9) Data migration requirements
- None required if the frontend converts bundles to note counts on save. Existing DB rows remain valid as note counts.
- If historical UX requires showing previously-entered bundles, there is no stored bundle data to show; optional: add auxiliary columns (NOT RECOMMENDED without stakeholder approval). Avoid schema changes.

10) Risks
- UX ambiguity: if both bundles and notes are allowed simultaneously, users may double-enter the same value; mitigate by clear labels and placeholder tooltips and optionally by validating that bundles are integer multiples and showing derived effective notes prominently.
- Validation: existing validations (max available, non-negative) must run on effective notes, not on the `bundles` field alone.
- Reporting mismatch: existing exports and reports assume denom_* = note counts. Any change to DB semantics would break reporting. Keep DB semantics unchanged.

11) Test cases required
- Unit tests for `DenominationFields` to verify: entering notes only -> amount correct; entering bundles only -> amount correct; entering both -> amount = notes + bundles*100 and not double-counted.
- Integration test: submit a cash pickup / atm replenishment form with bundles only; verify `denom_*` saved to backend equals bundles*100.
- Validation tests: attempts to enter decimals in bundles (reject), negative numbers (reject unless `allowNegative` used), and available-limit checks use effective notes.
- Backward compatibility: load an existing record with only `denom_*` populated — UI should display notes = denom_*, bundles = 0.

12) Summary recommendation
- Implement UI-level dual inputs (`Notes` + `Bundles`) in `DenominationFields` and propagate effective note counts to save paths.
- Do not change DB schema or triggers. No data migration needed if frontend computes effective notes prior to save.
- Add validation and UX hints to avoid double-counting.

---
Revision note: this audit intentionally avoided scanning additional `.sql` files beyond earlier contextual references as requested. For a final implementation, involve a small DB/analytics verification step to ensure no hidden ETL expects bundles semantics.
