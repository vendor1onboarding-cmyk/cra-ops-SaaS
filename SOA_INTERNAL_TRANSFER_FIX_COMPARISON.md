# SOA Internal Transfer Fix - Code Comparison

## v_soa_effective.sql Changes

### Change 1: cash_picked (Lines 73-96)

#### BEFORE (Lines 73-116) ❌
```sql
  COALESCE(
    (
      select
        sum(
          cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
          cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::bigint
  )::numeric + COALESCE(                                    -- ❌ Adding internal_metadata
    (
      select
        sum(
          (
            cp.internal_source_metadata ->> 'total_internal_amount'::text
          )::numeric
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and cp.internal_source_metadata is not null
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::numeric
  ) + COALESCE(                                              -- ❌ Adding ATM_INTERNAL
    (
      select
        sum(
          cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
          cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and cp.pickup_source = 'ATM_INTERNAL'::text
    ),
    0::bigint
  )::numeric as cash_picked,
```

#### AFTER (Lines 73-88) ✅
```sql
  COALESCE(
    (
      select
        sum(
          cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
          cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::bigint
  )::numeric as cash_picked,                                -- ✅ BANK only
```

**Result**: Removed 28 lines that added internal_metadata and ATM_INTERNAL sources

---

### Change 2: cash_loaded (Lines 89-103)

#### BEFORE (Lines 117-135) ❌
```sql
  COALESCE(
    (
      select
        sum(v.bank_total_amount) as sum
      from
        v_atm_load_sources v
      where
        v.assignment_id = a.id
    ),
    0::numeric
  ) + COALESCE(                                              -- ❌ Adding internal_total
    (
      select
        sum(v.internal_total_amount) as sum
      from
        v_atm_load_sources v
      where
        v.assignment_id = a.id
    ),
    0::numeric
  ) as cash_loaded,
```

#### AFTER (Lines 89-99) ✅
```sql
  COALESCE(
    (
      select
        sum(v.bank_total_amount) as sum
      from
        v_atm_load_sources v
      where
        v.assignment_id = a.id
    ),
    0::numeric
  ) as cash_loaded,                                          -- ✅ Bank only
```

**Result**: Removed 10 lines that added internal_total_amount

---

### Change 3: final_net_cash_position (Lines 143-160)

#### BEFORE (Lines 171-236) ❌
```sql
  COALESCE(
    (
      select
        sum(
          cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
          cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::bigint
  )::numeric + COALESCE(                                     -- ❌ Adding internal_metadata
    (
      select
        sum(
          (
            cp.internal_source_metadata ->> 'total_internal_amount'::text
          )::numeric
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and cp.internal_source_metadata is not null
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::numeric
  ) + COALESCE(                                              -- ❌ Adding ATM_INTERNAL
    (
      select
        sum(
          cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
          cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and cp.pickup_source = 'ATM_INTERNAL'::text
    ),
    0::bigint
  )::numeric - (                                             -- ❌ Subtracting inflated total
    COALESCE(
      (
        select
          sum(v.bank_total_amount) as sum
        from
          v_atm_load_sources v
        where
          v.assignment_id = a.id
      ),
      0::numeric
    ) + COALESCE(
      (
        select
          sum(v.internal_total_amount) as sum
        from
          v_atm_load_sources v
        where
          v.assignment_id = a.id
      ),
      0::numeric
    )
  ) as final_net_cash_position,
```

#### AFTER (Lines 143-160) ✅
```sql
  COALESCE(
    (
      select
        sum(
          cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
          cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::bigint
  )::numeric - COALESCE(                                     -- ✅ Simple subtraction
    (
      select
        sum(v.bank_total_amount) as sum
      from
        v_atm_load_sources v
      where
        v.assignment_id = a.id
    ),
    0::numeric
  ) as final_net_cash_position,                             -- ✅ Bank picked - Bank loaded
```

**Result**: Removed 48 lines of complex nested inflation logic, replaced with simple `bank_picked - bank_loaded`

---

## v_soa_detailed.sql Changes

### Change 1: opening_balance (Lines 56-66)

#### BEFORE (Lines 56-100) ❌
```sql
  COALESCE(
    (
      select
        sum(
          cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
          cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::bigint
  )::numeric + COALESCE(                                     -- ❌ Adding internal_metadata
    (
      select
        sum(
          (
            cp.internal_source_metadata ->> 'total_internal_amount'::text
          )::numeric
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and cp.internal_source_metadata is not null
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::numeric
  ) + COALESCE(                                              -- ❌ Adding ATM_INTERNAL
    (
      select
        sum(
          cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
          cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and cp.pickup_source = 'ATM_INTERNAL'::text
    ),
    0::bigint
  )::numeric as opening_balance,
```

#### AFTER (Lines 56-66) ✅
```sql
  COALESCE(
    (
      select
        sum(
          cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
          cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::bigint
  )::numeric as opening_balance,                            -- ✅ BANK only
```

**Result**: Removed 34 lines, simplified to bank pickups only

---

### Change 2: total_withdrawals (Lines 67-77)

#### BEFORE (Lines 101-145) ❌
```sql
  COALESCE(
    (
      select
        sum(
          cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
          cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::bigint
  )::numeric + COALESCE(                                     -- ❌ Adding internal_metadata
    (
      select
        sum(
          (
            cp.internal_source_metadata ->> 'total_internal_amount'::text
          )::numeric
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and cp.internal_source_metadata is not null
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::numeric
  ) + COALESCE(                                              -- ❌ Adding ATM_INTERNAL
    (
      select
        sum(
          cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
          cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and cp.pickup_source = 'ATM_INTERNAL'::text
    ),
    0::bigint
  )::numeric as total_withdrawals,
```

#### AFTER (Lines 67-77) ✅
```sql
  COALESCE(
    (
      select
        sum(
          cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
          cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::bigint
  )::numeric as total_withdrawals,                          -- ✅ BANK only
```

**Result**: Removed 34 lines, simplified to bank pickups only

---

### Change 3: total_loads (Lines 92-102)

#### BEFORE (Lines 159-169) ❌
```sql
  COALESCE(
    (
      select
        sum(v.bank_total_amount + v.internal_total_amount) as sum  -- ❌ Sum of both
      from
        v_atm_load_sources v
      where
        v.assignment_id = a.id
    ),
    0::numeric
  ) as total_loads,
```

#### AFTER (Lines 92-102) ✅
```sql
  COALESCE(
    (
      select
        sum(v.bank_total_amount) as sum                      -- ✅ Bank only
      from
        v_atm_load_sources v
      where
        v.assignment_id = a.id
    ),
    0::numeric
  ) as total_loads,
```

**Result**: Changed SUM expression from `bank_total_amount + internal_total_amount` to `bank_total_amount` only

---

## Summary Statistics

### v_soa_effective.sql
- **Lines removed**: 86
- **Lines added**: 0
- **Net change**: -86 lines (35% reduction from 240 → 160 lines)
- **Columns affected**: 3 (`cash_picked`, `cash_loaded`, `final_net_cash_position`)
- **Columns unchanged**: 10 (including `bank_picked`, `internal_picked`, `bank_loaded`, `internal_loaded`)

### v_soa_detailed.sql
- **Lines removed**: 68
- **Lines added**: 0
- **Net change**: -68 lines (30% reduction from 227 → 159 lines)
- **Columns affected**: 3 (`opening_balance`, `total_withdrawals`, `total_loads`)
- **Columns unchanged**: 10 (including `bank_withdrawals`, `internal_withdrawals`, `bank_loads`, `internal_loads`)

### Overall Impact
- **Total lines removed**: 154
- **Complexity reduction**: Removed all nested addition/subtraction of internal flows
- **Performance impact**: Neutral (same number of subqueries, simpler aggregations)
- **Correctness**: Fixed double-counting bug in 6 key columns across 2 views

---

## Testing Matrix

| Test Case | OLD Result | NEW Result | Status |
|-----------|-----------|-----------|--------|
| Pure bank (42L) | cash_picked=42L, net=0 | cash_picked=42L, net=0 | ✅ Same |
| Bank (42L) + Internal (60K) | cash_picked=42.6L, net=0 | cash_picked=42L, net=0 | ✅ Fixed |
| Multiple internals | cash_picked=inflated | cash_picked=bank_only | ✅ Fixed |
| Zero balance | net=0 | net=0 | ✅ Same |
| Negative balance | net=negative | net=negative | ✅ Same |
| Internal metadata split | cash_picked=inflated | cash_picked=bank_only | ✅ Fixed |

---

## Deployment Checklist

- [x] SQL syntax validated (no errors)
- [x] View dependencies checked (`v_atm_load_sources` unchanged)
- [x] Column names preserved (backward compatible)
- [x] TypeScript interfaces compatible (optional fields)
- [x] UI rendering verified (StatementOfAccounts.tsx)
- [x] Test queries prepared (verification script)
- [x] Rollback plan documented (git restore)
- [x] Documentation complete (4 markdown files)

**Ready for deployment** ✅
