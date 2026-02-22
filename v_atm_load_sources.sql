create view public.v_atm_load_sources as
select
  ar.id,
  ar.assignment_id,
  ar.site_id,
  a.custodian_id,
  ar.time_in,
  COALESCE(ar.denom_100, 0) as total_denom_100,
  COALESCE(ar.denom_200, 0) as total_denom_200,
  COALESCE(ar.denom_500, 0) as total_denom_500,
  COALESCE(ar.denom_2000, 0) as total_denom_2000,
  case
    when ar.source_breakdown ? 'bank_source'::text then COALESCE(
      (
        (ar.source_breakdown -> 'bank_source'::text) ->> 'denom_100'::text
      )::integer,
      0
    )
    else 0
  end as bank_denom_100,
  case
    when ar.source_breakdown ? 'bank_source'::text then COALESCE(
      (
        (ar.source_breakdown -> 'bank_source'::text) ->> 'denom_200'::text
      )::integer,
      0
    )
    else 0
  end as bank_denom_200,
  case
    when ar.source_breakdown ? 'bank_source'::text then COALESCE(
      (
        (ar.source_breakdown -> 'bank_source'::text) ->> 'denom_500'::text
      )::integer,
      0
    )
    else 0
  end as bank_denom_500,
  case
    when ar.source_breakdown ? 'bank_source'::text then COALESCE(
      (
        (ar.source_breakdown -> 'bank_source'::text) ->> 'denom_2000'::text
      )::integer,
      0
    )
    else 0
  end as bank_denom_2000,
  case
    when ar.source_breakdown ? 'internal_source'::text then COALESCE(
      (
        (ar.source_breakdown -> 'internal_source'::text) ->> 'denom_100'::text
      )::integer,
      0
    )
    else 0
  end as internal_denom_100,
  case
    when ar.source_breakdown ? 'internal_source'::text then COALESCE(
      (
        (ar.source_breakdown -> 'internal_source'::text) ->> 'denom_200'::text
      )::integer,
      0
    )
    else 0
  end as internal_denom_200,
  case
    when ar.source_breakdown ? 'internal_source'::text then COALESCE(
      (
        (ar.source_breakdown -> 'internal_source'::text) ->> 'denom_500'::text
      )::integer,
      0
    )
    else 0
  end as internal_denom_500,
  case
    when ar.source_breakdown ? 'internal_source'::text then COALESCE(
      (
        (ar.source_breakdown -> 'internal_source'::text) ->> 'denom_2000'::text
      )::integer,
      0
    )
    else 0
  end as internal_denom_2000,
  case
    when ar.source_breakdown ? 'bank_source'::text then COALESCE(
      (
        (ar.source_breakdown -> 'bank_source'::text) ->> 'total_amount'::text
      )::numeric,
      0::numeric
    )
    else 0::numeric
  end as bank_total_amount,
  case
    when ar.source_breakdown ? 'internal_source'::text then COALESCE(
      (
        (ar.source_breakdown -> 'internal_source'::text) ->> 'total_amount'::text
      )::numeric,
      0::numeric
    )
    else 0::numeric
  end as internal_total_amount
from
  atm_replenishments ar
  left join assignments a on a.id = ar.assignment_id;