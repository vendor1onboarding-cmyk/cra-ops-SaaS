create view public.v_soa_effective as
select
  id as soa_id,
  id as assignment_id,
  custodian_id,
  assignment_date,
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
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::bigint
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
  )::numeric + COALESCE(
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
  ) as internal_picked,
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
          cp.denom_2000 * 2000 + cp.denom_500 * 500 + cp.denom_200 * 200 + cp.denom_100 * 100 + cp.denom_50 * 50 + cp.denom_20 * 20 + cp.denom_10 * 10
        ) as sum
      from
        cash_pickups cp
      where
        cp.assignment_id = a.id
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::bigint
  )::numeric as cash_picked,
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
        and COALESCE(cp.pickup_source, 'BANK'::text) = 'BANK'::text
    ),
    0::bigint
  )::numeric - COALESCE(
    (
      select
        sum(v.bank_total_amount) as sum
      from
        v_atm_load_sources v
      where
        v.assignment_id = a.id
    ),
    0::numeric
  ) as final_net_cash_position,
  created_at as posted_at
from
  assignments a;