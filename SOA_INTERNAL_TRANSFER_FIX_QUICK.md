# SOA Internal Transfer Fix - Quick Reference

## Problem
Internal ATM transfers counted TWICE in SOA totals, inflating `cash_picked` and `cash_loaded`.

**Root Cause**:
1. Internal transfers counted in both ATM_INTERNAL pickups AND internal_source_metadata
2. v_atm_load_sources had fallback: if source_breakdown missing → assign ALL denoms to bank_total_amount ❌

## Solution  
1. Fixed v_atm_load_sources: **Removed COALESCE fallback** - bank_total_amount now REQUIRES explicit source_breakdown.bank_source
2. Changed SOA views to separate **Bank Flow** (affects cash-in-hand) from **Internal Flow** (neutral)

## What Changed

### v_atm_load_sources (CRITICAL FIX)
```sql
-- BEFORE (WRONG): Fallback inflated bank totals
bank_total_amount = COALESCE(
  source_breakdown.bank_source.total_amount,
  total_denominations  -- ❌ This assigned internal loads to bank!
)

-- AFTER (CORRECT): Explicit check only
bank_total_amount = CASE 
  WHEN source_breakdown ? 'bank_source' 
  THEN source_breakdown.bank_source.total_amount
  ELSE 0  -- ✅ No fallback!
END
```

### SOA Views

### Before (WRONG)
```
cash_picked = BANK + ATM_INTERNAL + internal_metadata = 102K
cash_loaded = bank_total + internal_total = 102K
final_net = 102K - 102K = 0 (correct by accident)
```

### After (CORRECT)
```
cash_picked = BANK only = 42L
cash_loaded = bank_total only = 42L
final_net = 42L - 42L = 0 (correct at all stages)

internal_picked = 60K (visible but separate)
internal_loaded = 60K (visible but separate)
```

## Deploy Now

### Option 1: Supabase SQL Editor
1. Open [https://supabase.com/dashboard/project/<your-project>/sql/new](https://supabase.com/dashboard)
2. Copy contents of `SOA_INTERNAL_TRANSFER_FIX.sql`
3. Click "Run" (takes ~2 seconds)
4. Done ✅

### Option 2: Supabase CLI
```bash
supabase db push --file SOA_INTERNAL_TRANSFER_FIX.sql
```

## Validation (30 seconds)

```sql
-- Test query (replace <your_custodian_id> with real ID)
SELECT 
  assignment_date,
  cash_picked,
  bank_picked,
  internal_picked,
  cash_loaded,
  bank_loaded,
  internal_loaded,
  final_net_cash_position
FROM v_soa_effective
WHERE custodian_id = <your_custodian_id>
  AND assignment_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY assignment_date DESC;

-- ✅ Verify: cash_picked = bank_picked
-- ✅ Verify: cash_loaded = bank_loaded
-- ✅ Verify: final_net = (bank_picked - bank_loaded)
```

## Files Modified
- ✅ `v_atm_load_sources.sql` - **CRITICAL**: Removed fallback logic that assigned total denoms to bank
- ✅ `v_soa_effective.sql` - Main SOA view (bank flow only)
- ✅ `v_soa_detailed.sql` - Detailed SOA view (bank flow only)
- ✅ `SOA_INTERNAL_TRANSFER_FIX.sql` - Deployment script (NEW, includes all 3 views)
- ⚠️ **No UI changes needed** - StatementOfAccounts.tsx already compatible

## Impact
- **Lower KPI values** (correct bank-only totals)
- **Accurate cash-in-hand tracking**
- **Internal transfers still visible** (separate columns)
- **Backward compatible** (no breaking changes)

## Rollback
```sql
-- If needed, restore from git:
git checkout HEAD~1 v_soa_effective.sql v_soa_detailed.sql
-- Then re-run in Supabase SQL Editor
```

## Support
- Full guide: `SOA_INTERNAL_TRANSFER_FIX_GUIDE.md`
- Technical docs: `DATABASE_TRIGGERS_SOA_WORKFLOW.md`
- UI reference: `src/pages/StatementOfAccounts.tsx` (lines 1350-1450)
