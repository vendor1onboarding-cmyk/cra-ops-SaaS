-- SOA Internal Transfer Inflation Fix
-- This fixes the critical bug where internal ATM transfers were inflating
-- both cash_picked and cash_loaded totals, causing incorrect net positions.
--
-- PROBLEM: Internal transfers counted TWICE (ATM_INTERNAL + internal_source_metadata)
--          AND v_atm_load_sources had fallback logic assigning all denoms to bank
-- SOLUTION: Separate bank flow (affects cash-in-hand) from internal flow (neutral)
--           Remove COALESCE fallback in v_atm_load_sources - use explicit CASE WHEN
--
-- Expected result:
--   Bank Picked: 42L (only BANK source, excluding metadata)
--   Bank Loaded: 42L (only bank_total_amount, NO fallback to total denoms)
--   Internal Picked: 60K (separate, visible but neutral)
--   Internal Loaded: 60K (separate, visible but neutral)
--   Final Net: 0 (42L - 42L = 0, correct at all stages)

-- Step 1: Fix v_atm_load_sources (must be done first as other views depend on it)
DROP VIEW IF EXISTS public.v_atm_load_sources CASCADE;

CREATE VIEW public.v_atm_load_sources AS
SELECT
  ar.id,
  ar.assignment_id,
  ar.site_id,
  a.custodian_id,
  ar.time_in,
  COALESCE(ar.denom_100, 0) as total_denom_100,
  COALESCE(ar.denom_200, 0) as total_denom_200,
  COALESCE(ar.denom_500, 0) as total_denom_500,
  COALESCE(ar.denom_2000, 0) as total_denom_2000,
  
  -- Bank denominations: ONLY if source_breakdown has bank_source
  CASE 
    WHEN ar.source_breakdown IS NOT NULL 
      AND ar.source_breakdown ? 'bank_source'
    THEN COALESCE(((ar.source_breakdown -> 'bank_source') ->> 'denom_100')::integer, 0)
    ELSE 0
  END as bank_denom_100,
  CASE 
    WHEN ar.source_breakdown IS NOT NULL 
      AND ar.source_breakdown ? 'bank_source'
    THEN COALESCE(((ar.source_breakdown -> 'bank_source') ->> 'denom_200')::integer, 0)
    ELSE 0
  END as bank_denom_200,
  CASE 
    WHEN ar.source_breakdown IS NOT NULL 
      AND ar.source_breakdown ? 'bank_source'
    THEN COALESCE(((ar.source_breakdown -> 'bank_source') ->> 'denom_500')::integer, 0)
    ELSE 0
  END as bank_denom_500,
  CASE 
    WHEN ar.source_breakdown IS NOT NULL 
      AND ar.source_breakdown ? 'bank_source'
    THEN COALESCE(((ar.source_breakdown -> 'bank_source') ->> 'denom_2000')::integer, 0)
    ELSE 0
  END as bank_denom_2000,
  
  -- Internal denominations: ONLY if source_breakdown has internal_source
  COALESCE(
    ((ar.source_breakdown -> 'internal_source') ->> 'denom_100')::integer,
    0
  ) as internal_denom_100,
  COALESCE(
    ((ar.source_breakdown -> 'internal_source') ->> 'denom_200')::integer,
    0
  ) as internal_denom_200,
  COALESCE(
    ((ar.source_breakdown -> 'internal_source') ->> 'denom_500')::integer,
    0
  ) as internal_denom_500,
  COALESCE(
    ((ar.source_breakdown -> 'internal_source') ->> 'denom_2000')::integer,
    0
  ) as internal_denom_2000,
  
  -- CRITICAL FIX: No fallback to total denominations
  -- Bank total: ONLY if source_breakdown explicitly has bank_source
  CASE 
    WHEN ar.source_breakdown IS NOT NULL 
      AND ar.source_breakdown ? 'bank_source'
    THEN ((ar.source_breakdown -> 'bank_source') ->> 'total_amount')::numeric
    ELSE 0::numeric
  END as bank_total_amount,
  
  -- Internal total: ONLY if source_breakdown explicitly has internal_source
  CASE 
    WHEN ar.source_breakdown IS NOT NULL 
      AND ar.source_breakdown ? 'internal_source'
    THEN ((ar.source_breakdown -> 'internal_source') ->> 'total_amount')::numeric
    ELSE 0::numeric
  END as internal_total_amount
FROM
  atm_replenishments ar
  LEFT JOIN assignments a ON a.id = ar.assignment_id;

-- Step 2: Recreate v_soa_effective (depends on v_atm_load_sources)
DROP VIEW IF EXISTS public.v_soa_effective CASCADE;

CREATE VIEW public.v_soa_effective AS
SELECT
  id as soa_id,
  id as assignment_id,
  custodian_id,
  assignment_date,
  
  -- Bank picked: ONLY bank source (no internal metadata mixed in)
  COALESCE(
    (
      SELECT SUM(
        cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
        cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
      )
      FROM cash_pickups cp
      WHERE cp.assignment_id = a.id
        AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
    ),
    0
  ) AS bank_picked,
  
  -- Internal picked: ATM_INTERNAL source + internal_source_metadata from BANK pickups
  COALESCE(
    (
      SELECT SUM(
        cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
        cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
      )
      FROM cash_pickups cp
      WHERE cp.assignment_id = a.id
        AND cp.pickup_source = 'ATM_INTERNAL'
    ),
    0
  )::numeric + COALESCE(
    (
      SELECT SUM((cp.internal_source_metadata ->> 'total_internal_amount')::numeric)
      FROM cash_pickups cp
      WHERE cp.assignment_id = a.id
        AND cp.internal_source_metadata IS NOT NULL
        AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
    ),
    0
  ) AS internal_picked,
  
  -- Bank loaded: ONLY bank amounts (no internal mixed in)
  COALESCE(
    (
      SELECT SUM(v.bank_total_amount)
      FROM v_atm_load_sources v
      WHERE v.assignment_id = a.id
    ),
    0
  ) AS bank_loaded,
  
  -- Internal loaded: ONLY internal amounts
  COALESCE(
    (
      SELECT SUM(v.internal_total_amount)
      FROM v_atm_load_sources v
      WHERE v.assignment_id = a.id
    ),
    0
  ) AS internal_loaded,
  
  -- Cash picked: ONLY bank (used for KPIs and cash-in-hand)
  COALESCE(
    (
      SELECT SUM(
        cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
        cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
      )
      FROM cash_pickups cp
      WHERE cp.assignment_id = a.id
        AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
    ),
    0
  )::numeric AS cash_picked,
  
  -- Cash loaded: ONLY bank (used for KPIs and cash-in-hand)
  COALESCE(
    (
      SELECT SUM(v.bank_total_amount)
      FROM v_atm_load_sources v
      WHERE v.assignment_id = a.id
    ),
    0
  ) AS cash_loaded,
  
  0 AS cash_adjusted,
  
  COALESCE(
    (
      SELECT SUM(
        ec.denom_2000 * 2000 + ec.denom_500 * 500 + 
        ec.denom_200 * 200 + ec.denom_100 * 100
      )
      FROM atm_excess_cash ec
      WHERE ec.assignment_id = a.id
    ),
    0
  ) AS excess_reported,
  
  COALESCE(
    (
      SELECT SUM(tl.km_covered)
      FROM travel_logs tl
      WHERE tl.assignment_id = a.id
    ),
    0
  ) AS travel_km,
  
  COALESCE(
    (
      SELECT SUM(tl.allowance_amount)
      FROM travel_logs tl
      WHERE tl.assignment_id = a.id
    ),
    0
  ) AS travel_allowance,
  
  -- Final net: bank_picked - bank_loaded (internal flow is neutral)
  COALESCE(
    (
      SELECT SUM(
        cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
        cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
      )
      FROM cash_pickups cp
      WHERE cp.assignment_id = a.id
        AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
    ),
    0
  )::numeric - COALESCE(
    (
      SELECT SUM(v.bank_total_amount)
      FROM v_atm_load_sources v
      WHERE v.assignment_id = a.id
    ),
    0
  ) AS final_net_cash_position,
  
  created_at AS posted_at
FROM assignments a;

-- Step 3: Recreate v_soa_detailed (depends on v_atm_load_sources)
DROP VIEW IF EXISTS public.v_soa_detailed CASCADE;

CREATE VIEW public.v_soa_detailed AS
SELECT
  id as soa_id,
  id as assignment_id,
  custodian_id,
  assignment_date,
  
  -- Bank withdrawals: ONLY bank source
  COALESCE(
    (
      SELECT SUM(
        cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
        cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
      )
      FROM cash_pickups cp
      WHERE cp.assignment_id = a.id
        AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
    ),
    0
  ) AS bank_withdrawals,
  
  -- Internal withdrawals: ATM_INTERNAL + internal_source_metadata
  COALESCE(
    (
      SELECT SUM(
        cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
        cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
      )
      FROM cash_pickups cp
      WHERE cp.assignment_id = a.id
        AND cp.pickup_source = 'ATM_INTERNAL'
    ),
    0
  )::numeric + COALESCE(
    (
      SELECT SUM((cp.internal_source_metadata ->> 'total_internal_amount')::numeric)
      FROM cash_pickups cp
      WHERE cp.assignment_id = a.id
        AND cp.internal_source_metadata IS NOT NULL
        AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
    ),
    0
  ) AS internal_withdrawals,
  
  -- Opening balance: ONLY bank (used for cash-in-hand tracking)
  COALESCE(
    (
      SELECT SUM(
        cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
        cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
      )
      FROM cash_pickups cp
      WHERE cp.assignment_id = a.id
        AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
    ),
    0
  )::numeric AS opening_balance,
  
  -- Total withdrawals: ONLY bank
  COALESCE(
    (
      SELECT SUM(
        cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + 
        cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
      )
      FROM cash_pickups cp
      WHERE cp.assignment_id = a.id
        AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
    ),
    0
  )::numeric AS total_withdrawals,
  
  -- Bank loads: ONLY bank amounts
  COALESCE(
    (
      SELECT SUM(v.bank_total_amount)
      FROM v_atm_load_sources v
      WHERE v.assignment_id = a.id
    ),
    0
  ) AS bank_loads,
  
  -- Internal loads: ONLY internal amounts
  COALESCE(
    (
      SELECT SUM(v.internal_total_amount)
      FROM v_atm_load_sources v
      WHERE v.assignment_id = a.id
    ),
    0
  ) AS internal_loads,
  
  -- Total loads: ONLY bank (used for cash-in-hand tracking)
  COALESCE(
    (
      SELECT SUM(v.bank_total_amount)
      FROM v_atm_load_sources v
      WHERE v.assignment_id = a.id
    ),
    0
  ) AS total_loads,
  
  0 AS net_adjustments,
  
  (
    SELECT COUNT(*)
    FROM soa_adjustments sa
    WHERE sa.assignment_id = a.id
      AND sa.adjustment_type = 'EXCHANGE'
  ) AS exchange_count,
  
  (
    SELECT COUNT(*)
    FROM soa_adjustments sa
    WHERE sa.assignment_id = a.id
      AND sa.adjustment_type = 'INTER_SITE_TRANSFER'
  ) AS transfer_count,
  
  COALESCE(
    (
      SELECT SUM(
        ec.denom_2000 * 2000 + ec.denom_500 * 500 + 
        ec.denom_200 * 200 + ec.denom_100 * 100
      )
      FROM atm_excess_cash ec
      WHERE ec.assignment_id = a.id
    ),
    0
  ) AS excess_reported,
  
  COALESCE(
    (
      SELECT SUM(tl.km_covered)
      FROM travel_logs tl
      WHERE tl.assignment_id = a.id
    ),
    0
  ) AS travel_km,
  
  COALESCE(
    (
      SELECT SUM(tl.allowance_amount)
      FROM travel_logs tl
      WHERE tl.assignment_id = a.id
    ),
    0
  ) AS travel_allowance,
  
  status,
  created_at
FROM assignments a;

-- Verification query (run this after deployment to test)
-- SELECT 
--   assignment_date,
--   bank_picked,
--   internal_picked,
--   bank_loaded,
--   internal_loaded,
--   cash_picked,
--   cash_loaded,
--   final_net_cash_position
-- FROM v_soa_effective
-- WHERE custodian_id = <test_custodian_id>
--   AND assignment_date = '<test_date>'
-- ORDER BY assignment_date DESC;
