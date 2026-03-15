-- ============================================================================
-- FIX_SOA_NEGATIVE_CASH_MIGRATION.sql
-- Fixes negative cash-in-hand issue in Statement of Accounts
-- by correcting the calculation formula at the database view level
-- ============================================================================
-- Issue: v_soa_effective was calculating:
--   final_net_cash_position = bank_picked - bank_loaded
-- But should be:
--   final_net_cash_position = (bank_picked + internal_picked) - (bank_loaded + internal_loaded)
--
-- This caused negative balances when ATM_INTERNAL pickups were used for loads
-- ============================================================================

BEGIN;

-- Step 1: Drop dependent views (if any exist)
DROP VIEW IF EXISTS v_soa_detailed CASCADE;

-- Step 2: Drop the main view to allow type changes
DROP VIEW IF EXISTS v_soa_effective CASCADE;

-- Step 3: Recreate v_soa_effective with fixed calculation
create or replace view public.v_soa_effective as
select
  id as soa_id,
  id as assignment_id,
  custodian_id,
  assignment_date,
  COALESCE(
    (
      select
        sum(
          (
            cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
          )::numeric - COALESCE(NULLIF(cp.internal_source_metadata ->> 'total_internal_amount'::text, ''::text)::numeric, 0::numeric)
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::numeric
  ) as bank_picked,
  COALESCE(
    (
      select
        sum(
          cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and cp.pickup_source = 'ATM_INTERNAL'::text
    ),
    0::bigint
  )::numeric as internal_picked,
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
  ) as bank_loaded,
  COALESCE(
    (
      select
        sum(v.internal_total_amount) as sum
      from
        v_atm_load_sources v
      where
        v.assignment_id = a.id
    ),
    0::numeric
  ) as internal_loaded,
  COALESCE(
    (
      select
        sum(
          (
            cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
          )::numeric - COALESCE(NULLIF(cp.internal_source_metadata ->> 'total_internal_amount'::text, ''::text)::numeric, 0::numeric)
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::numeric
  )::numeric as cash_picked,
  COALESCE(
    (
      select
        sum(v.bank_total_amount + COALESCE(v.internal_total_amount, 0)) as sum
      from
        v_atm_load_sources v
      where
        v.assignment_id = a.id
    ),
    0::numeric
  ) as cash_loaded,
  0 as cash_adjusted,
  COALESCE(
    (
      select
        sum(
          ec.denom_2000 * 2000 + ec.denom_500 * 500 + ec.denom_200 * 200 + ec.denom_100 * 100
        ) as sum
      from
        atm_excess_cash ec
      where
        ec.assignment_id = a.id
    ),
    0::bigint
  ) as excess_reported,
  COALESCE(
    (
      select
        sum(tl.km_covered) as sum
      from
        travel_logs tl
      where
        tl.assignment_id = a.id
    ),
    0::numeric
  ) as travel_km,
  COALESCE(
    (
      select
        sum(tl.allowance_amount) as sum
      from
        travel_logs tl
      where
        tl.assignment_id = a.id
    ),
    0::numeric
  ) as travel_allowance,
  -- FIXED: final_net_cash_position now includes both bank and internal in calculation
  (
    COALESCE(
      (
        select
          sum(
            (
              cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
            )::numeric - COALESCE(NULLIF(cp.internal_source_metadata ->> 'total_internal_amount'::text, ''::text)::numeric, 0::numeric)
          ) as sum
        from
          cash_pickups cp
        where
          cp.assignment_id = a.id
          and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
      ),
      0::numeric
    ) +
    COALESCE(
      (
        select
          sum(
            cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
          ) as sum
        from
          cash_pickups cp
        where
          cp.assignment_id = a.id
          and cp.pickup_source = 'ATM_INTERNAL'::text
      ),
      0::numeric
    )
  )::numeric 
  - COALESCE(
    (
      select
        sum(v.bank_total_amount + COALESCE(v.internal_total_amount, 0)) as sum
      from
        v_atm_load_sources v
      where
        v.assignment_id = a.id
    ),
    0::numeric  
  )
  + COALESCE(
    (
      select
        sum(
          COALESCE((sa.exchange_metadata->'delta_denominations'->>'denom_2000')::bigint, 0) * 2000 +
          COALESCE((sa.exchange_metadata->'delta_denominations'->>'denom_500')::bigint, 0) * 500 +
          COALESCE((sa.exchange_metadata->'delta_denominations'->>'denom_200')::bigint, 0) * 200 +
          COALESCE((sa.exchange_metadata->'delta_denominations'->>'denom_100')::bigint, 0) * 100 +
          COALESCE((sa.exchange_metadata->'delta_denominations'->>'denom_50')::bigint, 0) * 50 +
          COALESCE((sa.exchange_metadata->'delta_denominations'->>'denom_20')::bigint, 0) * 20 +
          COALESCE((sa.exchange_metadata->'delta_denominations'->>'denom_10')::bigint, 0) * 10
        )::numeric as sum
      from
        soa_adjustments sa
      where
        sa.assignment_id = a.id
        and sa.custodian_confirmed = true
        and (sa.exchange_metadata->>'type') = 'ADMIN_CORRECTION'
    ),
    0::numeric  
  )::numeric as final_net_cash_position,
  created_at as posted_at
from
  assignments a;

-- Step 4: Recreate v_soa_detailed with full detail columns
create or replace view public.v_soa_detailed as
select
  id as soa_id,
  id as assignment_id,
  custodian_id,
  assignment_date,
  COALESCE(
    (
      select
        sum(
          (
            cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
          )::numeric - COALESCE(NULLIF(cp.internal_source_metadata ->> 'total_internal_amount'::text, ''::text)::numeric, 0::numeric)
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::numeric
  ) as bank_withdrawals,
  COALESCE(
    (
      select
        sum(
          cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and cp.pickup_source = 'ATM_INTERNAL'::text
    ),
    0::bigint
  )::numeric as internal_withdrawals,
  COALESCE(
    (
      select
        sum(
          (
            cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
          )::numeric - COALESCE(NULLIF(cp.internal_source_metadata ->> 'total_internal_amount'::text, ''::text)::numeric, 0::numeric)
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::numeric
  )::numeric as opening_balance,
  COALESCE(
    (
      select
        sum(
          (
            cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
          )::numeric - COALESCE(NULLIF(cp.internal_source_metadata ->> 'total_internal_amount'::text, ''::text)::numeric, 0::numeric)
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::numeric
  )::numeric as total_withdrawals,
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
  ) as bank_loads,
  COALESCE(
    (
      select
        sum(v.internal_total_amount) as sum
      from
        v_atm_load_sources v
      where
        v.assignment_id = a.id
    ),
    0::numeric
  ) as internal_loads,
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
  ) as total_loads,
  COALESCE(
    (
      select
        sum(
          COALESCE((sa.exchange_metadata->'delta_denominations'->>'denom_2000')::bigint, 0) * 2000 +
          COALESCE((sa.exchange_metadata->'delta_denominations'->>'denom_500')::bigint, 0) * 500 +
          COALESCE((sa.exchange_metadata->'delta_denominations'->>'denom_200')::bigint, 0) * 200 +
          COALESCE((sa.exchange_metadata->'delta_denominations'->>'denom_100')::bigint, 0) * 100 +
          COALESCE((sa.exchange_metadata->'delta_denominations'->>'denom_50')::bigint, 0) * 50 +
          COALESCE((sa.exchange_metadata->'delta_denominations'->>'denom_20')::bigint, 0) * 20 +
          COALESCE((sa.exchange_metadata->'delta_denominations'->>'denom_10')::bigint, 0) * 10
        ) as sum
      from
        soa_adjustments sa
      where
        sa.assignment_id = a.id
        and sa.custodian_confirmed = true
        and (sa.exchange_metadata->>'type') = 'ADMIN_CORRECTION'
    ),
    0
  )::integer as net_adjustments,
  (
    select
      count(*) as count
    from
      soa_adjustments sa
    where
      sa.assignment_id = a.id
      and sa.adjustment_type = 'EXCHANGE'::text
  ) as exchange_count,
  (
    select
      count(*) as count
    from
      soa_adjustments sa
    where
      sa.assignment_id = a.id
      and sa.adjustment_type = 'INTER_SITE_TRANSFER'::text
  ) as transfer_count,
  COALESCE(
    (
      select
        sum(
          ec.denom_2000 * 2000 + ec.denom_500 * 500 + ec.denom_200 * 200 + ec.denom_100 * 100
        ) as sum
      from
        atm_excess_cash ec
      where
        ec.assignment_id = a.id
    ),
    0::bigint
  ) as excess_reported,
  COALESCE(
    (
      select
        sum(tl.km_covered) as sum
      from
        travel_logs tl
      where
        tl.assignment_id = a.id
    ),
    0::numeric
  ) as travel_km,
  COALESCE(
    (
      select
        sum(tl.allowance_amount) as sum
      from
        travel_logs tl
      where
        tl.assignment_id = a.id
    ),
    0::numeric
  ) as travel_allowance,
  status,
  created_at,
  (
    select
      count(*) as count
    from
      soa_adjustments sa
    where
      sa.assignment_id = a.id
      and (sa.exchange_metadata->>'type') = 'ADMIN_CORRECTION'
      and sa.custodian_confirmed = true
  ) as admin_correction_count
from
  assignments a;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after the migration to verify the fix:
-- 
-- 1. Check that final_net_cash_position now includes both bank AND internal:
--    SELECT assignment_id, bank_picked, internal_picked, 
--           bank_loaded, internal_loaded, final_net_cash_position
--    FROM v_soa_effective
--    WHERE bank_picked > 0 OR internal_picked > 0
--    LIMIT 10;
--
-- 2. Verify the formula is correct (should be 0 or balanced):
--    SELECT assignment_id,
--           (bank_picked + internal_picked) - (bank_loaded + internal_loaded) as expected_net,
--           final_net_cash_position
--    FROM v_soa_effective
--    WHERE final_net_cash_position != 0;
--
-- 3. Check for any remaining negative balances (should be rare now):
--    SELECT assignment_id, final_net_cash_position
--    FROM v_soa_effective
--    WHERE final_net_cash_position < 0
--    ORDER BY final_net_cash_position;
