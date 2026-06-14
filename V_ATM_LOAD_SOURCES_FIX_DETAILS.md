# v_atm_load_sources Critical Fix - Technical Details

## The Problem

The `v_atm_load_sources` view had a dangerous COALESCE fallback that was silently assigning ALL ATM load denominations to `bank_total_amount` when `source_breakdown` was missing or incomplete.

### Symptom Example

```sql
-- ATM load without source_breakdown (internal transfer)
INSERT INTO atm_replenishments (
  assignment_id, 
  site_id, 
  denom_100, denom_200, denom_500, denom_2000,
  source_breakdown  -- NULL or missing bank_source
) VALUES (
  123,
  'ATM-C',
  100, 200, 300, 400,
  NULL  -- or '{"internal_source": {...}}'
);

-- OLD VIEW (WRONG):
bank_total_amount = 1,360,000  -- ❌ Incorrectly assigned to bank!
internal_total_amount = 0

-- NEW VIEW (CORRECT):
bank_total_amount = 0  -- ✅ Not a bank load
internal_total_amount = 1,360,000  -- ✅ Properly classified
```

## Root Cause

### Old Logic (WRONG) ❌

```sql
-- Lines 62-70 in v_atm_load_sources.sql
bank_total_amount = COALESCE(
  (source_breakdown -> 'bank_source' ->> 'total_amount')::numeric,
  -- ❌ DANGEROUS FALLBACK: If bank_source missing, use total denoms
  (denom_100 * 100 + denom_200 * 200 + denom_500 * 500 + denom_2000 * 2000)::numeric
)
```

**Problem**: This fallback assumed that if `source_breakdown.bank_source` was missing, the load must be from bank. This is FALSE for:
- Internal ATM-to-ATM transfers (should be `internal_source`)
- Loads created before source_breakdown was implemented (unknown source)
- Data migration issues or manual entries

### New Logic (CORRECT) ✅

```sql
-- Fixed logic uses explicit CASE WHEN
bank_total_amount = CASE 
  WHEN source_breakdown IS NOT NULL 
    AND source_breakdown ? 'bank_source'  -- JSON key exists check
  THEN ((source_breakdown -> 'bank_source') ->> 'total_amount')::numeric
  ELSE 0::numeric  -- ✅ No fallback! If not explicitly bank, it's NOT bank
END
```

**Solution**: Explicit check that `source_breakdown` exists AND contains `bank_source` key. If either condition fails, `bank_total_amount = 0`.

## Code Changes

### Change 1: bank_denom_* columns (Lines 11-34)

**BEFORE** ❌
```sql
bank_denom_100 = COALESCE(
  (source_breakdown -> 'bank_source' ->> 'denom_100')::integer,
  denom_100  -- ❌ Fallback to total
)
bank_denom_200 = COALESCE(
  (source_breakdown -> 'bank_source' ->> 'denom_200')::integer,
  denom_200  -- ❌ Fallback to total
)
-- ... same for 500, 2000
```

**AFTER** ✅
```sql
bank_denom_100 = CASE 
  WHEN source_breakdown IS NOT NULL AND source_breakdown ? 'bank_source'
  THEN COALESCE(((source_breakdown -> 'bank_source') ->> 'denom_100')::integer, 0)
  ELSE 0
END
bank_denom_200 = CASE 
  WHEN source_breakdown IS NOT NULL AND source_breakdown ? 'bank_source'
  THEN COALESCE(((source_breakdown -> 'bank_source') ->> 'denom_200')::integer, 0)
  ELSE 0
END
-- ... same for 500, 2000
```

### Change 2: bank_total_amount (Lines 62-70)

**BEFORE** ❌
```sql
bank_total_amount = COALESCE(
  ((source_breakdown -> 'bank_source') ->> 'total_amount')::numeric,
  (COALESCE(denom_100, 0) * 100 + 
   COALESCE(denom_200, 0) * 200 + 
   COALESCE(denom_500, 0) * 500 + 
   COALESCE(denom_2000, 0) * 2000)::numeric  -- ❌ DANGEROUS FALLBACK
)
```

**AFTER** ✅
```sql
bank_total_amount = CASE 
  WHEN source_breakdown IS NOT NULL 
    AND source_breakdown ? 'bank_source'
  THEN ((source_breakdown -> 'bank_source') ->> 'total_amount')::numeric
  ELSE 0::numeric  -- ✅ Explicit: no bank_source = not a bank load
END
```

### Change 3: internal_total_amount (Lines 71-76)

**ALREADY CORRECT** ✅ (unchanged)
```sql
internal_total_amount = COALESCE(
  ((source_breakdown -> 'internal_source') ->> 'total_amount')::numeric,
  0::numeric  -- ✅ Already had correct default of 0
)
```

**Enhanced to CASE WHEN for consistency**:
```sql
internal_total_amount = CASE 
  WHEN source_breakdown IS NOT NULL 
    AND source_breakdown ? 'internal_source'
  THEN ((source_breakdown -> 'internal_source') ->> 'total_amount')::numeric
  ELSE 0::numeric
END
```

## Impact on SOA Calculations

### Before Fix (WRONG)

```
ATM Load (Internal Transfer):
  denom_2000: 30 (₹60,000)
  source_breakdown: NULL

  ↓ v_atm_load_sources (OLD)

  bank_total_amount: ₹60,000  ❌ Wrongly assigned to bank
  internal_total_amount: ₹0

  ↓ v_soa_effective

  cash_loaded: ₹42,60,000  ❌ Inflated (₹42L bank + ₹60K internal)
  final_net: -₹60,000  ❌ Incorrect (should be ₹0)
```

### After Fix (CORRECT)

```
ATM Load (Internal Transfer):
  denom_2000: 30 (₹60,000)
  source_breakdown: NULL

  ↓ v_atm_load_sources (NEW)

  bank_total_amount: ₹0  ✅ No bank_source in breakdown
  internal_total_amount: ₹0  ✅ No internal_source either (unknown)

  ↓ v_soa_effective

  cash_loaded: ₹42,00,000  ✅ Only explicit bank loads
  final_net: ₹0  ✅ Correct (₹42L picked - ₹42L loaded)
```

## JSON Key Check Syntax

The `?` operator in PostgreSQL checks if a JSON key EXISTS:

```sql
source_breakdown ? 'bank_source'
-- Returns TRUE if 'bank_source' key exists (even if value is null)
-- Returns FALSE if source_breakdown is NULL or doesn't have 'bank_source' key

-- Combined with IS NOT NULL check:
source_breakdown IS NOT NULL AND source_breakdown ? 'bank_source'
-- Ensures both that JSON exists AND contains the specific key
```

## Data Migration Considerations

### Existing Records Without source_breakdown

**Impact**: ATM loads created before source_breakdown was implemented will have:
- `bank_total_amount = 0`
- `internal_total_amount = 0`

**Solution Options**:

1. **Accept as-is** (Recommended): Historical data without proper classification shows as neither bank nor internal. This is accurate - we don't know the source.

2. **Backfill script** (Optional): If you want to assume old records were all bank loads:
```sql
-- Update old ATM loads to add source_breakdown
UPDATE atm_replenishments 
SET source_breakdown = jsonb_build_object(
  'bank_source', jsonb_build_object(
    'denom_100', denom_100,
    'denom_200', denom_200,
    'denom_500', denom_500,
    'denom_2000', denom_2000,
    'total_amount', (
      COALESCE(denom_100, 0) * 100 + 
      COALESCE(denom_200, 0) * 200 + 
      COALESCE(denom_500, 0) * 500 + 
      COALESCE(denom_2000, 0) * 2000
    )
  )
)
WHERE source_breakdown IS NULL
  AND created_at < '2025-01-01';  -- Before source_breakdown was implemented
```

## Testing

### Test Case 1: Explicit Bank Load
```sql
INSERT INTO atm_replenishments (..., source_breakdown) VALUES (...,
  '{"bank_source": {"denom_2000": 20, "total_amount": 40000}}'
);

-- Expected:
-- bank_total_amount = 40000 ✅
-- internal_total_amount = 0 ✅
```

### Test Case 2: Explicit Internal Load
```sql
INSERT INTO atm_replenishments (..., source_breakdown) VALUES (...,
  '{"internal_source": {"denom_2000": 30, "total_amount": 60000}}'
);

-- Expected:
-- bank_total_amount = 0 ✅
-- internal_total_amount = 60000 ✅
```

### Test Case 3: Mixed Load (Bank + Internal)
```sql
INSERT INTO atm_replenishments (..., source_breakdown) VALUES (...,
  '{
    "bank_source": {"denom_2000": 20, "total_amount": 40000},
    "internal_source": {"denom_2000": 30, "total_amount": 60000}
  }'
);

-- Expected:
-- bank_total_amount = 40000 ✅
-- internal_total_amount = 60000 ✅
```

### Test Case 4: No source_breakdown (Unknown/Legacy)
```sql
INSERT INTO atm_replenishments (..., source_breakdown) VALUES (..., NULL);

-- Expected:
-- bank_total_amount = 0 ✅ (was total_denoms before ❌)
-- internal_total_amount = 0 ✅
```

## Verification Query

```sql
-- Check classification accuracy
SELECT 
  ar.id,
  ar.assignment_id,
  ar.site_id,
  -- Total denominations
  (COALESCE(ar.denom_100, 0) * 100 + 
   COALESCE(ar.denom_200, 0) * 200 + 
   COALESCE(ar.denom_500, 0) * 500 + 
   COALESCE(ar.denom_2000, 0) * 2000) as total_denoms,
  -- Classified amounts from view
  v.bank_total_amount,
  v.internal_total_amount,
  -- Check if source_breakdown exists
  CASE 
    WHEN ar.source_breakdown IS NULL THEN 'No breakdown'
    WHEN ar.source_breakdown ? 'bank_source' THEN 'Has bank_source'
    WHEN ar.source_breakdown ? 'internal_source' THEN 'Has internal_source'
    ELSE 'Unknown'
  END as breakdown_status
FROM atm_replenishments ar
JOIN v_atm_load_sources v ON v.id = ar.id
WHERE ar.assignment_id = <test_assignment_id>
ORDER BY ar.time_in;

-- ✅ Verify: bank_total_amount should be 0 when breakdown_status != 'Has bank_source'
-- ✅ Verify: internal_total_amount should be 0 when breakdown_status != 'Has internal_source'
-- ✅ Verify: bank_total_amount + internal_total_amount <= total_denoms
```

## Summary

**What Changed**: Removed COALESCE fallback logic that assigned total denominations to `bank_total_amount`

**Why**: Fallback incorrectly classified internal transfers and unknown sources as bank loads

**Fix**: Explicit CASE WHEN checks that `source_breakdown` exists AND contains the specific key (`bank_source` or `internal_source`)

**Result**: 
- Bank loads ONLY counted when explicitly marked in `source_breakdown.bank_source`
- Internal loads ONLY counted when explicitly marked in `source_breakdown.internal_source`
- Unknown/legacy loads (no breakdown) show as neither (both = 0)
- Prevents inflation of `cash_loaded` in SOA views

**Deployment**: Must be done FIRST (before SOA views) as other views depend on accurate source classification
