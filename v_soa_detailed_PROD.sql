create view public.v_soa_detailed as
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
  ) as internal_withdrawals,
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
  )::numeric as opening_balance,
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
          COALESCE(
            (
              (
                sa.exchange_metadata -> 'delta_denominations'::text
              ) ->> 'denom_2000'::text
            )::bigint,
            0::bigint
          ) * 2000 + COALESCE(
            (
              (
                sa.exchange_metadata -> 'delta_denominations'::text
              ) ->> 'denom_500'::text
            )::bigint,
            0::bigint
          ) * 500 + COALESCE(
            (
              (
                sa.exchange_metadata -> 'delta_denominations'::text
              ) ->> 'denom_200'::text
            )::bigint,
            0::bigint
          ) * 200 + COALESCE(
            (
              (
                sa.exchange_metadata -> 'delta_denominations'::text
              ) ->> 'denom_100'::text
            )::bigint,
            0::bigint
          ) * 100 + COALESCE(
            (
              (
                sa.exchange_metadata -> 'delta_denominations'::text
              ) ->> 'denom_50'::text
            )::bigint,
            0::bigint
          ) * 50 + COALESCE(
            (
              (
                sa.exchange_metadata -> 'delta_denominations'::text
              ) ->> 'denom_20'::text
            )::bigint,
            0::bigint
          ) * 20 + COALESCE(
            (
              (
                sa.exchange_metadata -> 'delta_denominations'::text
              ) ->> 'denom_10'::text
            )::bigint,
            0::bigint
          ) * 10
        ) as sum
      from
        soa_adjustments sa
      where
        sa.assignment_id = a.id
        and sa.custodian_confirmed = true
        and (sa.exchange_metadata ->> 'type'::text) = 'ADMIN_CORRECTION'::text
    ),
    0::numeric
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
      and (sa.exchange_metadata ->> 'type'::text) = 'ADMIN_CORRECTION'::text
      and sa.custodian_confirmed = true
  ) as admin_correction_count
from
  assignments a;