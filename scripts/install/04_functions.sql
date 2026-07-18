-- ---------------------------------------------------------------------------
-- FUNCTION: approve_eod_assignment(bigint, "uuid")
-- Stored procedure or trigger function
-- ---------------------------------------------------------------------------
--

CREATE FUNCTION "public"."approve_eod_assignment"("p_assignment_id" bigint, "p_approved_by" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result json;
BEGIN
  -- Simply update the assignment - triggers are now dropped
  UPDATE assignments
  SET 
    status = 'approved',
    approved_at = NOW(),
    approved_by = p_approved_by
  WHERE id = p_assignment_id;
  
  -- Return success
  v_result := json_build_object(
    'success', true,
    'message', 'Assignment approved successfully'
  );
  
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  v_result := json_build_object(
    'success', false,
    'message', SQLERRM,
    'detail', SQLSTATE
  );
  RETURN v_result;
END;
$$;


--

-- ---------------------------------------------------------------------------
-- FUNCTION: auto_assign_route_by_district(bigint, "text")
-- Stored procedure or trigger function
-- ---------------------------------------------------------------------------
--

CREATE FUNCTION "public"."auto_assign_route_by_district"("p_assignment_id" bigint, "p_district" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- Ensure assignment is OPEN
  if not exists (
    select 1
    from public.assignments
    where id = p_assignment_id
      and status = 'open'
  ) then
    raise exception 'Route can be auto-assigned only for OPEN assignments';
  end if;

  -- Remove existing route
  delete from public.route_sites
  where assignment_id = p_assignment_id;

  -- Insert new route ordered by site_code
  insert into public.route_sites (assignment_id, site_id, sequence_no)
  select
    p_assignment_id,
    s.id,
    row_number() over (order by s.site_code)
  from public.sites s
  where s.city = p_district;
end;
$$;


--

-- ---------------------------------------------------------------------------
-- FUNCTION: calculate_closing_balance("uuid")
-- Stored procedure or trigger function
-- ---------------------------------------------------------------------------
--

CREATE FUNCTION "public"."calculate_closing_balance"("p_assignment_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_opening DECIMAL(12, 2);
  v_withdrawals DECIMAL(12, 2);
  v_loads DECIMAL(12, 2);
  v_allowance DECIMAL(12, 2);
  v_closing DECIMAL(12, 2);
BEGIN
  SELECT 
    opening_balance,
    total_withdrawals,
    total_loads,
    travel_allowance
  INTO v_opening, v_withdrawals, v_loads, v_allowance
  FROM v_soa_detailed
  WHERE assignment_id = p_assignment_id;
  
  v_closing := v_opening - v_loads;
  
  RETURN v_closing;
END;
$$;


--

-- ---------------------------------------------------------------------------
-- COMMENT: FUNCTION "calculate_closing_balance"("p_assignment_id" "uuid")
-- Function comment
-- ---------------------------------------------------------------------------
--

COMMENT ON FUNCTION "public"."calculate_closing_balance"("p_assignment_id" "uuid") IS 'Calculate closing balance for a given assignment.
Formula: Opening + Withdrawals - Loads = Closing';


--

-- ---------------------------------------------------------------------------
-- FUNCTION: calculate_daily_allowance("date")
-- Stored procedure or trigger function
-- ---------------------------------------------------------------------------
--

CREATE FUNCTION "public"."calculate_daily_allowance"("p_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into daily_travel_summary (
    employee_id,
    travel_date,
    total_km,
    vehicle_type,
    rate_per_km,
    allowance_amount
  )
  select
    t.custodian_id,
    p_date,
    sum(t.distance_km),
    t.vehicle_type,
    r.rate_per_km,
    sum(t.distance_km) * r.rate_per_km
  from travel_logs t
  join vehicle_rates r
    on r.vehicle_type = t.vehicle_type
  where date(t.start_time) = p_date
  group by t.custodian_id, t.vehicle_type, r.rate_per_km
  on conflict (employee_id, travel_date) do update
  set
    total_km = excluded.total_km,
    allowance_amount = excluded.allowance_amount;
end;
$$;


--

-- ---------------------------------------------------------------------------
-- FUNCTION: create_daily_assignments()
-- Stored procedure or trigger function
-- ---------------------------------------------------------------------------
--

CREATE FUNCTION "public"."create_daily_assignments"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.assignments (
    assignment_date,
    custodian_id,
    status,
    title,
    created_at
  )
  select
    current_date,
    p.id,
    'open',
    'Daily Route',
    now()
  from public.profiles p
  where p.role = 'custodian'
    and not exists (
      select 1
      from public.assignments a
      where a.custodian_id = p.id
        and a.assignment_date = current_date
    );
end;
$$;


--

-- ---------------------------------------------------------------------------
-- FUNCTION: get_profile_names("uuid"[])
-- Stored procedure or trigger function
-- ---------------------------------------------------------------------------
--

CREATE FUNCTION "public"."get_profile_names"("p_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "full_name" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select id, full_name
  from profiles
  where id = any(p_ids);
$$;


--

-- ---------------------------------------------------------------------------
-- FUNCTION: log_cheque_status_change()
-- Stored procedure or trigger function
-- ---------------------------------------------------------------------------
--

CREATE FUNCTION "public"."log_cheque_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF (OLD.cheque_status IS DISTINCT FROM NEW.cheque_status) OR 
     (OLD.cheque_verified IS DISTINCT FROM NEW.cheque_verified) THEN
    INSERT INTO public.cheque_audit_log (
      pickup_id,
      old_status,
      new_status,
      old_verified_by,
      new_verified_by,
      metadata,
      updated_by
    ) VALUES (
      NEW.id,
      COALESCE(OLD.cheque_status, 'PENDING'),
      NEW.cheque_status,
      OLD.cheque_verified_by,
      NEW.cheque_verified_by,
      NEW.cheque_metadata,
      COALESCE(NEW.cheque_verified_by, auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$$;


--

-- ---------------------------------------------------------------------------
-- FUNCTION: post_soa_entry(bigint, "text", bigint, "text", bigint, numeric, "text", "text")
-- Stored procedure or trigger function
-- ---------------------------------------------------------------------------
--

CREATE FUNCTION "public"."post_soa_entry"("p_assignment_id" bigint, "p_source_table" "text", "p_source_id" bigint, "p_event_type" "text", "p_site_id" bigint, "p_amount" numeric, "p_direction" "text", "p_remarks" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_custodian uuid;
  v_entry_date date;
BEGIN
  -- Fetch assignment context
  SELECT custodian_id, assignment_date
  INTO v_custodian, v_entry_date
  FROM assignments
  WHERE id = p_assignment_id;

  IF v_custodian IS NULL THEN
    RAISE EXCEPTION 'Invalid assignment_id %', p_assignment_id;
  END IF;

  -- Insert ledger entry (idempotent)
  INSERT INTO soa_ledger (
    assignment_id,
    custodian_id,
    entry_date,
    source_table,
    source_id,
    event_type,
    site_id,
    amount,
    direction,
    remarks
  )
  VALUES (
    p_assignment_id,
    v_custodian,
    v_entry_date,
    p_source_table,
    p_source_id,
    p_event_type,
    p_site_id,
    p_amount,
    p_direction,
    p_remarks
  )
  ON CONFLICT (source_table, source_id)
  DO NOTHING;
END;
$$;


--

-- ---------------------------------------------------------------------------
-- FUNCTION: post_soa_on_approval()
-- Stored procedure or trigger function
-- ---------------------------------------------------------------------------
--

CREATE FUNCTION "public"."post_soa_on_approval"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- Only post once, only on approval
  if new.status = 'approved'
     and old.status <> 'approved'
     and not exists (
       select 1 from soa_postings where assignment_id = new.id
     )
  then
    insert into soa_postings (
      assignment_id,
      custodian_id,
      assignment_date,

      cash_picked,
      cash_loaded,
      cash_adjusted,
      excess_reported,

      travel_km,
      travel_allowance,

      net_cash_position,

      eod_signed,
      eod_signed_at,
      eod_signature_url,

      posted_by
    )
    select
      a.id,
      a.custodian_id,
      a.assignment_date,

      -- Cash picked
      coalesce(cp.total_amount, 0),

      -- Cash loaded
      coalesce((
        select sum(
          denom_2000 * 2000 +
          denom_500  * 500  +
          denom_200  * 200  +
          denom_100  * 100
        )
        from atm_replenishments r
        where r.assignment_id = a.id
      ), 0),

      -- Adjustments
      coalesce((
        select sum(
          denom_2000 * 2000 +
          denom_500  * 500  +
          denom_200  * 200  +
          denom_100  * 100
        )
        from atm_cash_adjustments adj
        where adj.assignment_id = a.id
      ), 0),

      -- Excess
      coalesce((
        select sum(total_excess_amount)
        from atm_excess_cash ex
        where ex.assignment_id = a.id
      ), 0),

      -- Travel
      coalesce((
        select sum(km_covered)
        from travel_logs t
        where t.assignment_id = a.id
          and t.status = 'completed'
      ), 0),

      coalesce((
        select sum(allowance_amount)
        from travel_logs t
        where t.assignment_id = a.id
          and t.status = 'completed'
      ), 0),

      -- Net cash position
      (
        coalesce(cp.total_amount, 0)
        -
        coalesce((
          select sum(
            denom_2000 * 2000 +
            denom_500  * 500  +
            denom_200  * 200  +
            denom_100  * 100
          )
          from atm_replenishments r
          where r.assignment_id = a.id
        ), 0)
        -
        coalesce((
          select sum(
            denom_2000 * 2000 +
            denom_500  * 500  +
            denom_200  * 200  +
            denom_100  * 100
          )
          from atm_cash_adjustments adj
          where adj.assignment_id = a.id
        ), 0)
      ),

      a.eod_signed,
      a.eod_signed_at,
      a.eod_signature_url,

      new.approved_by
    from assignments a
    left join cash_pickups cp on cp.assignment_id = a.id
    where a.id = new.id;

  end if;

  return new;
end;
$$;


--

-- ---------------------------------------------------------------------------
-- FUNCTION: trg_atm_cash_adjustments_soa()
-- Stored procedure or trigger function
-- ---------------------------------------------------------------------------
--

CREATE FUNCTION "public"."trg_atm_cash_adjustments_soa"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_amount numeric;
  v_direction text;
BEGIN
  v_amount :=
    NEW.denom_100 * 100 +
    NEW.denom_200 * 200 +
    NEW.denom_500 * 500 +
    NEW.denom_2000 * 2000;

  v_direction :=
    CASE
      WHEN NEW.adjustment_type = 'withdrawal' THEN 'CREDIT'
      ELSE 'DEBIT'
    END;

  PERFORM post_soa_entry(
    NEW.assignment_id,
    'atm_cash_adjustments',
    NEW.id,
    'ATM_ADJUSTMENT',
    NEW.site_id,
    v_amount,
    v_direction,
    NEW.reason
  );

  RETURN NEW;
END;
$$;


--

-- ---------------------------------------------------------------------------
-- FUNCTION: trg_atm_excess_cash_soa()
-- Stored procedure or trigger function
-- ---------------------------------------------------------------------------
--

CREATE FUNCTION "public"."trg_atm_excess_cash_soa"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM post_soa_entry(
    NEW.assignment_id,
    'atm_excess_cash',
    NEW.id,
    'ATM_EXCESS',
    NEW.site_id,
    NEW.total_excess_amount,
    'CREDIT',
    'ATM excess cash'
  );

  RETURN NEW;
END;
$$;


--

-- ---------------------------------------------------------------------------
-- FUNCTION: trg_atm_replenishments_soa()
-- Stored procedure or trigger function
-- ---------------------------------------------------------------------------
--

CREATE FUNCTION "public"."trg_atm_replenishments_soa"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_amount numeric;
BEGIN
  v_amount :=
    NEW.denom_100 * 100 +
    NEW.denom_200 * 200 +
    NEW.denom_500 * 500 +
    NEW.denom_2000 * 2000;

  PERFORM post_soa_entry(
    NEW.assignment_id,
    'atm_replenishments',
    NEW.id,
    'ATM_LOAD',
    NEW.site_id,
    v_amount,
    'DEBIT',
    'ATM replenishment'
  );

  RETURN NEW;
END;
$$;


--

-- ---------------------------------------------------------------------------
-- FUNCTION: trg_soa_adjustment_ledger()
-- Stored procedure or trigger function
-- ---------------------------------------------------------------------------
--

CREATE FUNCTION "public"."trg_soa_adjustment_ledger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into soa_ledger (
    assignment_id,
    custodian_id,
    entry_date,
    source_table,
    source_id,
    event_type,
    amount,
    direction,
    remarks
  )
  values (
    new.assignment_id,
    new.custodian_id,
    current_date,
    'soa_adjustments',
    new.id,
    'SOA_ADJUSTMENT',
    abs(new.adjustment_amount),
    case when new.adjustment_amount >= 0 then 'CREDIT' else 'DEBIT' end,
    new.reason
  );

  return new;
end;
$$;


--

-- ---------------------------------------------------------------------------
-- FUNCTION: trg_travel_logs_soa()
-- Stored procedure or trigger function
-- ---------------------------------------------------------------------------
--

CREATE FUNCTION "public"."trg_travel_logs_soa"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.end_time IS NOT NULL AND NEW.allowance_amount IS NOT NULL THEN
    PERFORM post_soa_entry(
      NEW.assignment_id,
      'travel_logs',
      NEW.id,
      'TRAVEL_ALLOWANCE',
      NULL,
      NEW.allowance_amount,
      'DEBIT',
      'Travel allowance'
    );
  END IF;

  RETURN NEW;
END;
$$;


--

-- ---------------------------------------------------------------------------
-- FUNCTION: update_timestamp()
-- Stored procedure or trigger function
-- ---------------------------------------------------------------------------
--

CREATE FUNCTION "public"."update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--

