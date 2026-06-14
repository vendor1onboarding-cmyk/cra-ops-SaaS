# SOA Load Source Split Implementation Guide

## Overview
This document describes the implementation of bank-sourced vs internal ATM-sourced load tracking in the Statement of Accounts (SOA) system.

## Business Problem
**Challenge**: When custodians pick up cash from both bank AND internal ATM sites, the total loaded amount was inflating the vendor SOA, causing reconciliation issues.

**Solution**: Split ATM loads into:
- **Bank-sourced loads**: Cash from bank (affects SOA, vendor reconciliation)
- **Internal transfers**: Cash from internal ATM sites (neutral to SOA, informational only)

## Database Schema

### New Columns
1. `atm_replenishments.source_breakdown` (JSONB):
```json
{
  "bank_source": {
    "denom_100": 50,
    "denom_200": 30,
    "denom_500": 100,
    "denom_2000": 20,
    "total_amount": 75000
  },
  "internal_source": {
    "denom_100": 10,
    "denom_200": 5,
    "denom_500": 20,
    "denom_2000": 5,
    "total_amount": 15000,
    "from_sites": [123, 456]
  },
  "combined_total": 90000
}
```

2. `cash_pickups.internal_source_metadata` (JSONB):
```json
{
  "sources": [
    {
      "site_id": 123,
      "site_name": "ATM Site ABC",
      "denominations": {...},
      "total_amount": 15000,
      "gps_lat": 12.9716,
      "gps_lng": 77.5946,
      "timestamp": "2026-02-08T10:30:00Z"
    }
  ],
  "total_internal_amount": 15000
}
```

### Helper View: `v_atm_load_sources`
Separates bank-sourced vs internal ATM loads:
```sql
SELECT 
    id,
    assignment_id,
    site_id,
    custodian_id,
    time_in,
    -- Bank-sourced (for SOA)
    bank_denom_100,
    bank_denom_200,
    bank_denom_500,
    bank_denom_2000,
    bank_total_amount,
    -- Internal (excluded from SOA)
    internal_denom_100,
    internal_denom_200,
    internal_denom_500,
    internal_denom_2000,
    internal_total_amount
FROM atm_replenishments
```

## Frontend Implementation

### File Updated: `src/pages/StatementOfAccounts.tsx`

#### 1. Type Definitions
```typescript
type SOASummaryRow = {
  // ... existing fields
  bank_loaded?: number;
  internal_transferred?: number;
};
```

#### 2. Data Fetching
```typescript
// Fetch source breakdown from v_atm_load_sources
const { data: sourceData } = await supabase
  .from("v_atm_load_sources")
  .select("assignment_id, bank_total_amount, internal_total_amount")
  .in("assignment_id", assignmentIds);

// Aggregate by assignment
const sourceMap = new Map();
sourceData.forEach((s) => {
  const existing = sourceMap.get(s.assignment_id) || { bank: 0, internal: 0 };
  sourceMap.set(s.assignment_id, {
    bank: existing.bank + s.bank_total_amount,
    internal: existing.internal + s.internal_total_amount,
  });
});
```

#### 3. UI Components

**KPI Cards** (5 cards in grid):
```typescript
<KPI label="Total Picked" value={summaryTotals.cashPicked} color="blue" />
<KPI label="Loaded (Bank)" value={summaryTotals.bankLoaded} color="green" />
<KPI label="Internal Transfers" value={summaryTotals.internalTransferred} color="slate" />
<KPI label="Travel Allowance" value={summaryTotals.allowance} color="amber" />
<KPI label="Net Position" value={summaryTotals.net} color="indigo" highlight />
```

**Table Columns**:
| Date | Status | Custodian | Picked | Bank Loaded | Internal | KM | Allowance | Final Net |
|------|--------|-----------|--------|-------------|----------|----|-----------| --------- |

**Breakdown Info Card** (shown when internal transfers > 0):
```
💡 Cash Load Breakdown
Total Cash Loaded: ₹90,000
  ├─ From Bank: ₹75,000 (included in SOA)
  └─ Internal Transfers: ₹15,000 (neutral - already accounted)

Internal ATM transfers do not affect vendor reconciliation.
```

#### 4. Visual Styling
- **Bank Loaded**: Green text (`text-green-700`) - primary SOA component
- **Internal Transfers**: Gray badge (`bg-slate-100 text-slate-700`) - informational
- **Mobile**: Stacked cards with conditional display of internal transfers

#### 5. CSV Export
Updated columns:
```
Date,Custodian,Status,Cash Picked,Bank Loaded,Internal Transferred,Travel KM,Allowance,Final Net Position
```

## Business Rules

### SOA Calculation
```
Final Net Position = Cash Picked - Bank Loaded - Excess - Travel Allowance
```

**Note**: Internal transfers are NOT included in the calculation.

### Backward Compatibility
- `source_breakdown = NULL` → Treat as 100% bank-sourced
- Existing records display correctly without migration
- Legacy loads show only in "Bank Loaded" column

### Data Flow
1. Custodian picks cash from bank + internal ATM sites
2. `cash_pickups.internal_source_metadata` records internal sources
3. ATM loads store `source_breakdown` with bank/internal split
4. `v_atm_load_sources` view extracts bank vs internal amounts
5. SOA page aggregates and displays separately

## Testing Checklist

### Data Scenarios
- [ ] Legacy load (NULL source_breakdown) → All bank-sourced
- [ ] Bank-only load → Shows in "Bank Loaded", internal = 0
- [ ] Combined load → Shows both bank and internal amounts
- [ ] Internal-only load → Bank = 0, shows in "Internal Transfers"

### UI Scenarios
- [ ] KPI cards display correct totals
- [ ] Table columns show correct values
- [ ] Breakdown info card appears when internal > 0
- [ ] Mobile view renders correctly
- [ ] CSV export includes all columns
- [ ] Print/PDF format works correctly

### Role-Based Access
- [ ] Custodian sees only own records
- [ ] Admin sees all records with custodian names
- [ ] Supervisor has same access as admin

### Filtering
- [ ] Date range filter works
- [ ] Status filter works
- [ ] Custodian filter (admin only) works
- [ ] View mode toggle (Summary/Detailed) works

## Migration Notes

### Database Migration
```sql
-- Already applied in UNIFIED_ATM_LOADING_MIGRATION.sql
ALTER TABLE atm_replenishments ADD COLUMN source_breakdown JSONB;
ALTER TABLE cash_pickups ADD COLUMN internal_source_metadata JSONB;
CREATE VIEW v_atm_load_sources AS ...;
```

### No Data Migration Required
- Existing records work with NULL values
- Backward compatibility built-in
- No downtime needed

## Monitoring

### Key Metrics
1. **SOA Accuracy**: Final net position should be near 0
2. **Load Split Ratio**: Monitor bank vs internal transfer percentages
3. **Vendor Reconciliation**: Verify bank-loaded matches vendor records

### Alerts
- Large internal transfers (> threshold) → Flag for review
- Missing source_breakdown on new loads → Data quality issue
- SOA net position variance → Reconciliation issue

## Troubleshooting

### Issue: Internal transfers not showing
**Cause**: `source_breakdown` is NULL
**Fix**: Ensure ATM load process populates `source_breakdown`

### Issue: Totals don't match
**Cause**: Aggregation error in `v_atm_load_sources`
**Fix**: Check view definition and re-create if needed

### Issue: CSV export missing columns
**Cause**: Old browser cache
**Fix**: Clear cache and reload

## Related Documentation
- `UNIFIED_ATM_LOADING_MIGRATION.sql` - Database schema changes
- `ATM_LOAD_VALIDATION_IMPLEMENTATION.md` - Load validation logic
- `SOA_TECHNICAL_GUIDE.md` - SOA calculation details
- `DATABASE_TRIGGERS_SOA_WORKFLOW.md` - SOA automation

## Version History
- **v1.0** (2025-02-08): Initial implementation
  - Split bank/internal loads in SOA page
  - Added `v_atm_load_sources` view
  - Updated UI components and CSV export
