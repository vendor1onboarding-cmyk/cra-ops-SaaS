# SOA Internal Transfer Inflation Fix - Complete Guide

## Problem Statement

**Critical Bug**: Internal ATM transfers were being counted TWICE in Statement of Accounts calculations, causing inflated totals and incorrect net cash positions.

### Symptom Example
```
User Expected:
  Bank Picked: ₹42,00,000 (42L from bank)
  Cash Loaded: ₹42,00,000 (42L to ATMs)
  Final Net: ₹0 (42L - 42L = 0)

Actual (BROKEN):
  Cash Picked: ₹1,02,000 (Bank 42L + ATM Internal 60K = inflated)
  Cash Loaded: ₹1,02,000 (Bank 42L + Internal 60K = inflated)
  Final Net: ₹0 (correct by accident, but intermediate values wrong)

Root Cause:
- Internal transfer 60K counted in ATM_INTERNAL pickups
- Same 60K counted again in internal_source_metadata from BANK pickups
- Result: Double-counting inflated KPIs and cash-in-hand tracking
```

## Solution Architecture

### Two-Flow Model

**Bank Flow (Affects Cash-in-Hand)**
- Source: Cash pickups with `pickup_source = 'BANK'`
- Loads: ATM loads funded by `source_breakdown.bank_source`
- Impact: These transactions affect actual cash-in-hand balances
- Net calculation: `bank_picked - bank_loaded = final_net_cash_position`

**Internal Flow (Neutral for Reconciliation)**
- Source: Cash pickups with `pickup_source = 'ATM_INTERNAL'` + `internal_source_metadata` from BANK pickups
- Loads: ATM loads funded by `source_breakdown.internal_source`
- Impact: These are internal transfers between ATMs (no net cash change)
- Net calculation: Visible for audit but doesn't affect final net position

### Column Mapping

| Column | Old (BROKEN) | New (FIXED) |
|--------|-------------|-------------|
| `bank_picked` | BANK pickups only | BANK pickups only (unchanged) |
| `internal_picked` | ATM_INTERNAL + metadata | ATM_INTERNAL + metadata (unchanged) |
| `cash_picked` | BANK + ATM_INTERNAL + metadata | **BANK only** |
| `cash_loaded` | bank_total + internal_total | **bank_total only** |
| `final_net_cash_position` | (BANK + ATM_INTERNAL + metadata) - (bank + internal) | **BANK - bank_total** |

## Files Modified

### 1. v_soa_effective.sql

**Before** (Lines 73-116):
```sql
-- WRONG: Adding all three sources
cash_picked = BANK + internal_metadata + ATM_INTERNAL
cash_loaded = bank_total + internal_total
```

**After** (Lines 73-96):
```sql
-- CORRECT: Only bank flow
cash_picked = BANK only
cash_loaded = bank_total only
```

**Before** (Lines 171-236):
```sql
-- WRONG: Subtracting inflated totals
final_net = (BANK + metadata + ATM_INTERNAL) - (bank_total + internal_total)
```

**After** (Lines 143-160):
```sql
-- CORRECT: Only bank flow
final_net = BANK - bank_total
```

### 2. v_soa_detailed.sql

**Before** (Lines 56-116):
```sql
-- WRONG: Mixing flows
opening_balance = BANK + metadata + ATM_INTERNAL
total_withdrawals = BANK + metadata + ATM_INTERNAL
total_loads = bank_total + internal_total
```

**After** (Lines 56-86):
```sql
-- CORRECT: Separated flows
opening_balance = BANK only
total_withdrawals = BANK only
total_loads = bank_total only
```

## Deployment Steps

### Prerequisites
- Supabase project access with DDL permissions
- Backup existing data (optional but recommended)
- Test environment for validation

### Step 1: Deploy SQL Changes
```bash
# Navigate to project root
cd c:\Users\retha\OneDrive\Documents\sruthi-cra

# Open Supabase SQL Editor
# Copy contents of SOA_INTERNAL_TRANSFER_FIX.sql
# Execute script (will drop and recreate both views)
```

### Step 2: Verify View Structure
```sql
-- Check v_soa_effective columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'v_soa_effective' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Expected columns:
-- soa_id, assignment_id, custodian_id, assignment_date
-- bank_picked, internal_picked, bank_loaded, internal_loaded
-- cash_picked, cash_loaded, cash_adjusted
-- excess_reported, travel_km, travel_allowance
-- final_net_cash_position, posted_at
```

### Step 3: Test with Real Data
```sql
-- Find a custodian with internal transfers
SELECT 
  a.id as assignment_id,
  a.assignment_date,
  a.custodian_id,
  p.full_name,
  (SELECT COUNT(*) FROM cash_pickups WHERE assignment_id = a.id AND pickup_source = 'ATM_INTERNAL') as internal_count,
  (SELECT COUNT(*) FROM cash_pickups WHERE assignment_id = a.id AND internal_source_metadata IS NOT NULL) as metadata_count
FROM assignments a
JOIN profiles p ON p.id = a.custodian_id
WHERE EXISTS (
  SELECT 1 FROM cash_pickups cp 
  WHERE cp.assignment_id = a.id 
    AND (cp.pickup_source = 'ATM_INTERNAL' OR cp.internal_source_metadata IS NOT NULL)
)
ORDER BY a.assignment_date DESC
LIMIT 5;

-- Test the view with that assignment
SELECT 
  assignment_date,
  bank_picked,
  internal_picked,
  bank_loaded,
  internal_loaded,
  cash_picked,
  cash_loaded,
  final_net_cash_position
FROM v_soa_effective
WHERE assignment_id = <test_assignment_id>;

-- Validate:
-- 1. cash_picked should equal bank_picked (not bank_picked + internal_picked)
-- 2. cash_loaded should equal bank_loaded (not bank_loaded + internal_loaded)
-- 3. final_net_cash_position should equal (bank_picked - bank_loaded)
```

### Step 4: Verify UI Display
```bash
# Start development server
npm run dev

# Open browser to http://localhost:5175
# Login as custodian with internal transfers
# Navigate to Statement of Accounts page

# Check table display:
# - "Bank Picked" column shows bank_picked value
# - "ATM Picked" column shows internal_picked value
# - "Bank Loaded" column shows bank_loaded value
# - "Internal Movement" column shows internal_loaded value
# - "Final Net" column shows final_net_cash_position

# Verify calculation:
# Final Net should equal (Bank Picked - Bank Loaded)
# NOT (Bank Picked + ATM Picked - Bank Loaded - Internal Movement)
```

## Validation Test Cases

### Test Case 1: Pure Bank Flow
```sql
-- Assignment with only bank pickups and loads
-- Expected: cash_picked = bank_picked, internal_picked = 0
-- Expected: cash_loaded = bank_loaded, internal_loaded = 0
-- Expected: final_net = bank_picked - bank_loaded
```

### Test Case 2: Bank + Internal Flow
```sql
-- Assignment with bank pickup + internal pickup
-- Bank: 42L, Internal: 60K
-- Expected: bank_picked = 4200000, internal_picked = 60000
-- Expected: cash_picked = 4200000 (NOT 4260000)
-- Expected: cash_loaded = bank_total (NOT bank_total + internal_total)
-- Expected: final_net = bank_picked - bank_loaded (internal flow neutral)
```

### Test Case 3: Internal Metadata Split
```sql
-- Assignment with bank pickup that has internal_source_metadata
-- Bank denominations: 50L
-- Internal metadata: 8L (transferred to another ATM during same pickup)
-- Expected: bank_picked = 5000000, internal_picked = 800000
-- Expected: cash_picked = 5000000 (metadata doesn't inflate)
-- Expected: final_net based on bank flow only
```

## Backward Compatibility

### UI Compatibility
✅ **No UI changes required** - StatementOfAccounts.tsx already:
- Checks for `bank_picked ?? cash_picked` fallback (line 224)
- Displays separate columns for bank vs internal flows (lines 1356-1365)
- Calculates final net from view (no client-side recalculation)

### Data Compatibility
✅ **Existing data unaffected** - Views query same tables:
- `cash_pickups` table structure unchanged
- `atm_replenishments` table structure unchanged
- `v_atm_load_sources` view unchanged
- Only aggregation logic in SOA views modified

### API Compatibility
✅ **Same column names returned**:
- All existing columns preserved
- No columns removed or renamed
- TypeScript interfaces compatible (optional fields handled)

## Rollback Plan

If issues arise after deployment:

```sql
-- Restore previous view definitions
-- (Copy from git history or backup)

DROP VIEW IF EXISTS public.v_soa_effective CASCADE;
CREATE VIEW public.v_soa_effective AS
-- [paste old definition]

DROP VIEW IF EXISTS public.v_soa_detailed CASCADE;
CREATE VIEW public.v_soa_detailed AS
-- [paste old definition]
```

## Impact Assessment

### What Changed
- **KPI Values**: `cash_picked` and `cash_loaded` will show LOWER values (correct bank flow only)
- **Final Net**: No change in zero-balanced cases, but intermediate values now accurate
- **Opening Balance**: Shows bank flow only (correct cash-in-hand tracking)

### What Stayed Same
- Internal flow still visible in `internal_picked` and `internal_loaded` columns
- UI displays both flows separately (no visual changes)
- Row-level drill-down still works (shows source breakdown)
- Status badges, custodian filters, date ranges all unaffected

### User-Visible Changes
1. **Dashboard KPIs**: Cash picked/loaded totals will decrease (showing correct bank-only values)
2. **SOA Table**: "Bank Picked" and "Bank Loaded" columns remain accurate
3. **SOA Table**: "ATM Picked" and "Internal Movement" show internal transfers separately
4. **EOD Summary**: Net position remains accurate (was coincidentally correct due to double inflation canceling out)

## Troubleshooting

### Issue: View creation fails
**Cause**: Dependent views or policies referencing old structure
**Fix**: Drop dependent views first, recreate in correct order

### Issue: UI shows NaN or null values
**Cause**: TypeScript type mismatch or SQL null handling
**Fix**: Check COALESCE() clauses in view definition, ensure all numeric fields default to 0

### Issue: Final net doesn't match manual calculation
**Cause**: Expecting old behavior (bank + internal)
**Fix**: Confirm calculation uses bank flow only: `bank_picked - bank_loaded`

## References

- [v_soa_effective.sql](c:\Users\retha\OneDrive\Documents\sruthi-cra\v_soa_effective.sql) - Fixed view definition
- [v_soa_detailed.sql](c:\Users\retha\OneDrive\Documents\sruthi-cra\v_soa_detailed.sql) - Fixed view definition
- [SOA_INTERNAL_TRANSFER_FIX.sql](c:\Users\retha\OneDrive\Documents\sruthi-cra\SOA_INTERNAL_TRANSFER_FIX.sql) - Deployment script
- [StatementOfAccounts.tsx](c:\Users\retha\OneDrive\Documents\sruthi-cra\src\pages\StatementOfAccounts.tsx) - UI implementation (no changes needed)
- [DATABASE_TRIGGERS_SOA_WORKFLOW.md](c:\Users\retha\OneDrive\Documents\sruthi-cra\DATABASE_TRIGGERS_SOA_WORKFLOW.md) - SOA architecture documentation
- [SOA_TECHNICAL_GUIDE.md](c:\Users\retha\OneDrive\Documents\sruthi-cra\SOA_TECHNICAL_GUIDE.md) - Technical overview

## Success Criteria

✅ `cash_picked` equals `bank_picked` (not sum of all sources)
✅ `cash_loaded` equals `bank_loaded` (not sum of bank + internal)
✅ `final_net_cash_position` equals `bank_picked - bank_loaded`
✅ `internal_picked` and `internal_loaded` still visible for audit
✅ UI displays correctly with no code changes
✅ All existing data queries work without modification
✅ KPI values reflect accurate bank cash flow (lower than before)
✅ Zero-balanced assignments remain zero-balanced
