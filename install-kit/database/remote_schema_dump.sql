--
-- PostgreSQL database dump
--

\restrict RrnH2oWmrQKxX7hZojJjTn0A3Pt2K0QC5q9X9HjAhlbHKAJ5VZNXOiQscB49KNl

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: approve_eod_assignment(bigint, "uuid"); Type: FUNCTION; Schema: public; Owner: -
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
-- Name: auto_assign_route_by_district(bigint, "text"); Type: FUNCTION; Schema: public; Owner: -
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
-- Name: calculate_closing_balance("uuid"); Type: FUNCTION; Schema: public; Owner: -
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
-- Name: FUNCTION "calculate_closing_balance"("p_assignment_id" "uuid"); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION "public"."calculate_closing_balance"("p_assignment_id" "uuid") IS 'Calculate closing balance for a given assignment.
Formula: Opening + Withdrawals - Loads = Closing';


--
-- Name: calculate_daily_allowance("date"); Type: FUNCTION; Schema: public; Owner: -
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
-- Name: create_daily_assignments(); Type: FUNCTION; Schema: public; Owner: -
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
-- Name: get_profile_names("uuid"[]); Type: FUNCTION; Schema: public; Owner: -
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
-- Name: log_cheque_status_change(); Type: FUNCTION; Schema: public; Owner: -
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
-- Name: post_soa_entry(bigint, "text", bigint, "text", bigint, numeric, "text", "text"); Type: FUNCTION; Schema: public; Owner: -
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
-- Name: post_soa_on_approval(); Type: FUNCTION; Schema: public; Owner: -
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
-- Name: trg_atm_cash_adjustments_soa(); Type: FUNCTION; Schema: public; Owner: -
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
-- Name: trg_atm_excess_cash_soa(); Type: FUNCTION; Schema: public; Owner: -
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
-- Name: trg_atm_replenishments_soa(); Type: FUNCTION; Schema: public; Owner: -
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
-- Name: trg_soa_adjustment_ledger(); Type: FUNCTION; Schema: public; Owner: -
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
-- Name: trg_travel_logs_soa(); Type: FUNCTION; Schema: public; Owner: -
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
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: -
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
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."assignments" (
    "id" bigint NOT NULL,
    "assignment_date" "date" NOT NULL,
    "custodian_id" "uuid" NOT NULL,
    "title" "text",
    "status" "text" DEFAULT 'open'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "rejected_at" timestamp with time zone,
    "rejected_by" "uuid",
    "rejection_reason" "text",
    "eod_signed" boolean DEFAULT false,
    "eod_signed_at" timestamp with time zone,
    "eod_signature_url" "text",
    CONSTRAINT "assignments_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'submitted'::"text", 'approved'::"text", 'rejected'::"text"])))
);


--
-- Name: assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."assignments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."assignments_id_seq" OWNED BY "public"."assignments"."id";


--
-- Name: atm_cash_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."atm_cash_adjustments" (
    "id" bigint NOT NULL,
    "assignment_id" bigint NOT NULL,
    "site_id" bigint NOT NULL,
    "adjustment_type" "text" DEFAULT 'withdrawal'::"text" NOT NULL,
    "denom_100" integer DEFAULT 0,
    "denom_200" integer DEFAULT 0,
    "denom_500" integer DEFAULT 0,
    "denom_2000" integer DEFAULT 0,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "geo_lat" numeric(9,6),
    "geo_lng" numeric(9,6),
    "distance_meters" numeric,
    "photo_url" "text"
);


--
-- Name: atm_cash_adjustments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."atm_cash_adjustments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: atm_cash_adjustments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."atm_cash_adjustments_id_seq" OWNED BY "public"."atm_cash_adjustments"."id";


--
-- Name: atm_excess_cash; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."atm_excess_cash" (
    "id" bigint NOT NULL,
    "assignment_id" bigint NOT NULL,
    "site_id" bigint NOT NULL,
    "detected_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "denom_100" integer DEFAULT 0,
    "denom_200" integer DEFAULT 0,
    "denom_500" integer DEFAULT 0,
    "denom_2000" integer DEFAULT 0,
    "total_excess_amount" numeric GENERATED ALWAYS AS ((((("denom_100" * 100) + ("denom_200" * 200)) + ("denom_500" * 500)) + ("denom_2000" * 2000))) STORED,
    "atm_receipt_url" "text" NOT NULL,
    "reported_to_vendor" boolean DEFAULT false,
    "vendor_ticket_no" "text",
    "bank_notified" boolean DEFAULT false,
    "bank_reference_no" "text",
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "gps_status" "text",
    "gps_lat" numeric,
    "gps_lng" numeric,
    "gps_distance_meters" numeric,
    "gps_photo_url" "text",
    "gps_verified_at" timestamp with time zone,
    "excess_date" "date",
    "recon_communication_date" "date"
);


--
-- Name: atm_excess_cash_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."atm_excess_cash_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: atm_excess_cash_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."atm_excess_cash_id_seq" OWNED BY "public"."atm_excess_cash"."id";


--
-- Name: atm_removal_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."atm_removal_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" integer NOT NULL,
    "denom_2000" integer DEFAULT 0 NOT NULL,
    "denom_500" integer DEFAULT 0 NOT NULL,
    "denom_200" integer DEFAULT 0 NOT NULL,
    "denom_100" integer DEFAULT 0 NOT NULL,
    "denom_50" integer DEFAULT 0 NOT NULL,
    "denom_20" integer DEFAULT 0 NOT NULL,
    "denom_10" integer DEFAULT 0 NOT NULL,
    "remarks" "text" DEFAULT ''::"text" NOT NULL,
    "has_source_report" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: atm_replenishments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."atm_replenishments" (
    "id" bigint NOT NULL,
    "assignment_id" bigint,
    "site_id" bigint,
    "time_in" timestamp with time zone,
    "time_out" timestamp with time zone,
    "denom_2000" integer DEFAULT 0,
    "denom_500" integer DEFAULT 0,
    "denom_200" integer DEFAULT 0,
    "denom_100" integer DEFAULT 0,
    "denom_50" integer DEFAULT 0,
    "denom_20" integer DEFAULT 0,
    "denom_10" integer DEFAULT 0,
    "closing_balance" numeric,
    "remarks" "text",
    "receipt_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "load_lat" numeric(9,6),
    "load_lng" numeric(9,6),
    "distance_meters" numeric,
    "geo_status" "text" DEFAULT 'unknown'::"text",
    "photo_required" boolean DEFAULT false,
    "photo_url" "text",
    "source_breakdown" "jsonb"
);


--
-- Name: COLUMN "atm_replenishments"."source_breakdown"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."atm_replenishments"."source_breakdown" IS 'JSONB breakdown of load sources (bank vs internal ATM).
Structure:
{
  "bank_source": {
    "denom_100": 50,
    "denom_200": 30,
    "denom_500": 100,
    "denom_2000": 20,
    "total_amount": 75000
  },
  "internal_source": {
    "denom_100": 10,
    "denom_200": 5,
    "denom_500": 20,
    "denom_2000": 5,
    "total_amount": 15000,
    "from_sites": [123, 456]
  },
  "combined_total": 90000
}

Business Rules:
- NULL = Legacy load (assume all bank-sourced for backward compatibility)
- bank_source.total_amount = counts toward SOA "Loaded Today"
- internal_source.total_amount = excluded from SOA, shown separately
';


--
-- Name: atm_replenishments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."atm_replenishments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: atm_replenishments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."atm_replenishments_id_seq" OWNED BY "public"."atm_replenishments"."id";


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."audit_logs" (
    "id" bigint NOT NULL,
    "entity" "text",
    "entity_id" bigint,
    "action" "text",
    "actor" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."audit_logs_id_seq" OWNED BY "public"."audit_logs"."id";


--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."bank_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bank_name" "text" NOT NULL,
    "account_number" "text" NOT NULL,
    "ifsc_code" "text" NOT NULL,
    "branch_code" "text",
    "branch_name" "text",
    "branch_phone" "text",
    "branch_email" "text",
    "branch_address" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "latitude" numeric,
    "longitude" numeric,
    CONSTRAINT "bank_accounts_account_not_empty" CHECK (("length"(TRIM(BOTH FROM "account_number")) > 0)),
    CONSTRAINT "bank_accounts_bank_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "bank_name")) > 0)),
    CONSTRAINT "bank_accounts_ifsc_format" CHECK (("ifsc_code" ~ '^[A-Z0-9]{11}$'::"text")),
    CONSTRAINT "bank_accounts_ifsc_not_empty" CHECK (("length"(TRIM(BOTH FROM "ifsc_code")) > 0))
);


--
-- Name: bank_denomination_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."bank_denomination_plans" (
    "id" bigint NOT NULL,
    "assignment_id" bigint NOT NULL,
    "bank_account_id" "uuid" NOT NULL,
    "denom_2000" integer DEFAULT 0 NOT NULL,
    "denom_500" integer DEFAULT 0 NOT NULL,
    "denom_200" integer DEFAULT 0 NOT NULL,
    "denom_100" integer DEFAULT 0 NOT NULL,
    "denom_50" integer DEFAULT 0 NOT NULL,
    "denom_20" integer DEFAULT 0 NOT NULL,
    "denom_10" integer DEFAULT 0 NOT NULL,
    "remarks" "text",
    "has_source_report" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: bank_denomination_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."bank_denomination_plans_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bank_denomination_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."bank_denomination_plans_id_seq" OWNED BY "public"."bank_denomination_plans"."id";


--
-- Name: banks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."banks" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "branch" "text" NOT NULL,
    "short_code" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: banks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."banks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: banks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."banks_id_seq" OWNED BY "public"."banks"."id";


--
-- Name: cash_pickups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."cash_pickups" (
    "id" bigint NOT NULL,
    "assignment_id" bigint,
    "bank_name" "text",
    "branch" "text",
    "pickup_time" timestamp with time zone DEFAULT "now"(),
    "denom_2000" integer DEFAULT 0,
    "denom_500" integer DEFAULT 0,
    "denom_200" integer DEFAULT 0,
    "denom_100" integer DEFAULT 0,
    "denom_50" integer DEFAULT 0,
    "denom_20" integer DEFAULT 0,
    "denom_10" integer DEFAULT 0,
    "expected_amount" numeric,
    "total_amount" numeric,
    "variance" numeric,
    "slip_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "internal_source_metadata" "jsonb",
    "pickup_source" "text" DEFAULT 'BANK'::"text",
    "source_site_id" bigint,
    "gps_metadata" "jsonb",
    "gps_photo_url" "text",
    "cheque_number" "text",
    "cheque_image_url" "text",
    "cheque_verified" boolean DEFAULT false,
    "cheque_verified_by" "uuid",
    "cheque_verified_at" timestamp with time zone,
    "cheque_status" "text" DEFAULT 'PENDING'::"text",
    "cheque_metadata" "jsonb",
    "bank_account_id" "uuid",
    CONSTRAINT "cash_pickups_pickup_source_check" CHECK (("pickup_source" = ANY (ARRAY['BANK'::"text", 'ATM_INTERNAL'::"text"]))),
    CONSTRAINT "cheque_status_check" CHECK (("cheque_status" = ANY (ARRAY['PENDING'::"text", 'VERIFIED'::"text", 'REJECTED'::"text", 'CLEARED'::"text"])))
);


--
-- Name: COLUMN "cash_pickups"."internal_source_metadata"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."cash_pickups"."internal_source_metadata" IS 'JSONB metadata for tracking internal ATM site sources during cash pickup.
When custodian picks up cash from both bank AND internal ATM sites, this field stores:
{
  "sources": [
    {
      "site_id": 123,
      "site_name": "ATM Site ABC",
      "denominations": {
        "denom_100": 10,
        "denom_200": 5,
        "denom_500": 20,
        "denom_2000": 5
      },
      "total_amount": 15000,
      "gps_lat": 12.9716,
      "gps_lng": 77.5946,
      "timestamp": "2026-02-08T10:30:00Z",
      "photo_url": "optional-photo-url"
    }
  ],
  "total_internal_amount": 15000,
  "total_internal_notes": 40
}

Business Rules:
- NULL = Bank-only pickup (backward compatible)
- Non-NULL = Combined bank + ATM source pickup
- Internal sources DO NOT affect cash-in-hand (already accounted via previous ATM loads)
- Internal amounts MUST NOT appear in vendor SOA "Loaded Today"
- Internal transfers tracked separately for audit/visibility
';


--
-- Name: cash_pickups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."cash_pickups_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cash_pickups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."cash_pickups_id_seq" OWNED BY "public"."cash_pickups"."id";


--
-- Name: cheque_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."cheque_audit_log" (
    "id" bigint NOT NULL,
    "pickup_id" bigint NOT NULL,
    "old_status" "text" DEFAULT 'PENDING'::"text",
    "new_status" "text" NOT NULL,
    "old_verified_by" "uuid",
    "new_verified_by" "uuid",
    "change_reason" "text",
    "metadata" "jsonb",
    "updated_by" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "audit_status_check" CHECK (("new_status" = ANY (ARRAY['PENDING'::"text", 'VERIFIED'::"text", 'REJECTED'::"text", 'CLEARED'::"text"])))
);


--
-- Name: cheque_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."cheque_audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cheque_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."cheque_audit_log_id_seq" OWNED BY "public"."cheque_audit_log"."id";


--
-- Name: denomination_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."denomination_plans" (
    "id" bigint NOT NULL,
    "assignment_id" bigint,
    "site_id" bigint,
    "has_source_report" boolean DEFAULT true,
    "remarks" "text",
    "denom_2000" integer DEFAULT 0,
    "denom_500" integer DEFAULT 0,
    "denom_200" integer DEFAULT 0,
    "denom_100" integer DEFAULT 0,
    "denom_50" integer DEFAULT 0,
    "denom_20" integer DEFAULT 0,
    "denom_10" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: denomination_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."denomination_plans_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: denomination_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."denomination_plans_id_seq" OWNED BY "public"."denomination_plans"."id";


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'custodian'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "first_login" boolean DEFAULT true,
    "email" "text" NOT NULL,
    "mobile_number" "text",
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "deletion_reason" "text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'custodian'::"text"])))
);


--
-- Name: COLUMN "profiles"."deleted_at"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."profiles"."deleted_at" IS 'Timestamp when user was deleted (soft delete)';


--
-- Name: COLUMN "profiles"."deleted_by"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."profiles"."deleted_by" IS 'User ID of admin who deleted this user';


--
-- Name: COLUMN "profiles"."deletion_reason"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."profiles"."deletion_reason" IS 'Reason for user deletion (provided by admin)';


--
-- Name: route_sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."route_sites" (
    "id" bigint NOT NULL,
    "assignment_id" bigint NOT NULL,
    "site_id" bigint NOT NULL,
    "sequence_no" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: route_sites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."route_sites_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: route_sites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."route_sites_id_seq" OWNED BY "public"."route_sites"."id";


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."sites" (
    "id" bigint NOT NULL,
    "site_code" "text" NOT NULL,
    "atm_id" "text",
    "bank_name" "text",
    "address" "text",
    "city" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "latitude" numeric(9,6),
    "longitude" numeric(9,6)
);


--
-- Name: sites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."sites_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."sites_id_seq" OWNED BY "public"."sites"."id";


--
-- Name: soa_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."soa_adjustments" (
    "id" bigint NOT NULL,
    "soa_id" bigint NOT NULL,
    "assignment_id" bigint NOT NULL,
    "custodian_id" "uuid" NOT NULL,
    "adjustment_type" "text" NOT NULL,
    "adjustment_amount" numeric(14,2) NOT NULL,
    "reason" "text" NOT NULL,
    "reference" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "exchange_metadata" "jsonb",
    "transfer_metadata" "jsonb",
    "requires_custodian_confirmation" boolean DEFAULT true,
    "custodian_confirmed" boolean DEFAULT false,
    "custodian_confirmed_at" timestamp with time zone,
    "custodian_signature_url" "text",
    "original_reference_snapshot" "jsonb",
    CONSTRAINT "soa_adjustments_adjustment_type_check" CHECK (("adjustment_type" = ANY (ARRAY['CREDIT'::"text", 'DEBIT'::"text", 'EXCHANGE'::"text", 'INTER_SITE_TRANSFER'::"text"])))
);


--
-- Name: COLUMN "soa_adjustments"."exchange_metadata"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."soa_adjustments"."exchange_metadata" IS 'JSONB metadata for EXCHANGE type adjustments. Structure:
{
  "from_location": "Bank A",
  "to_location": "Bank B", 
  "from_denominations": {"denom_2000": 5, "denom_500": 0, ...},
  "to_denominations": {"denom_2000": 0, "denom_500": 20, ...},
  "total_amount": 10000,
  "exchange_time": "2026-02-05T10:30:00Z"
}';


--
-- Name: COLUMN "soa_adjustments"."transfer_metadata"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN "public"."soa_adjustments"."transfer_metadata" IS 'JSONB metadata for INTER_SITE_TRANSFER type adjustments. Structure:
{
  "from_site_id": "uuid",
  "to_site_id": "uuid",
  "from_site_name": "ATM Site 1",
  "to_site_name": "ATM Site 2",
  "amount": 5000,
  "denominations": {"denom_500": 10},
  "transfer_reason": "Rebalancing",
  "transfer_time": "2026-02-05T14:00:00Z"
}';


--
-- Name: soa_adjustments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."soa_adjustments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: soa_adjustments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."soa_adjustments_id_seq" OWNED BY "public"."soa_adjustments"."id";


--
-- Name: soa_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."soa_ledger" (
    "id" bigint NOT NULL,
    "assignment_id" bigint NOT NULL,
    "custodian_id" "uuid" NOT NULL,
    "entry_date" "date" NOT NULL,
    "entry_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_table" "text" NOT NULL,
    "source_id" bigint NOT NULL,
    "event_type" "text" NOT NULL,
    "site_id" bigint,
    "amount" numeric(14,2) NOT NULL,
    "direction" "text" NOT NULL,
    "running_balance" numeric(14,2),
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "soa_ledger_direction_check" CHECK (("direction" = ANY (ARRAY['DEBIT'::"text", 'CREDIT'::"text"])))
);


--
-- Name: soa_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."soa_ledger_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: soa_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."soa_ledger_id_seq" OWNED BY "public"."soa_ledger"."id";


--
-- Name: soa_postings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."soa_postings" (
    "id" bigint NOT NULL,
    "assignment_id" bigint NOT NULL,
    "custodian_id" "uuid" NOT NULL,
    "assignment_date" "date" NOT NULL,
    "cash_picked" numeric(14,2) DEFAULT 0 NOT NULL,
    "cash_loaded" numeric(14,2) DEFAULT 0 NOT NULL,
    "cash_adjusted" numeric(14,2) DEFAULT 0 NOT NULL,
    "excess_reported" numeric(14,2) DEFAULT 0 NOT NULL,
    "travel_km" numeric(10,2) DEFAULT 0 NOT NULL,
    "travel_allowance" numeric(14,2) DEFAULT 0 NOT NULL,
    "net_cash_position" numeric(14,2) NOT NULL,
    "eod_signed" boolean DEFAULT false NOT NULL,
    "eod_signed_at" timestamp with time zone,
    "eod_signature_url" "text",
    "posted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "posted_by" "uuid" NOT NULL,
    "source" "text" DEFAULT 'eod_approval'::"text" NOT NULL
);


--
-- Name: soa_postings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."soa_postings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: soa_postings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."soa_postings_id_seq" OWNED BY "public"."soa_postings"."id";


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."system_settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: technical_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."technical_issues" (
    "id" bigint NOT NULL,
    "assignment_id" bigint,
    "site_id" bigint,
    "issue_type" "text",
    "error_code" "text",
    "description" "text",
    "status" "text" DEFAULT 'new'::"text",
    "photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    CONSTRAINT "technical_issues_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'in_progress'::"text", 'resolved'::"text"])))
);


--
-- Name: technical_issues_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."technical_issues_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: technical_issues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."technical_issues_id_seq" OWNED BY "public"."technical_issues"."id";


--
-- Name: travel_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."travel_logs" (
    "id" bigint NOT NULL,
    "assignment_id" bigint NOT NULL,
    "site_id" bigint,
    "custodian_id" "uuid",
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "odometer_start" numeric(10,2),
    "odometer_end" numeric(10,2),
    "km_covered" numeric(10,2),
    "gps_start_lat" numeric(9,6),
    "gps_start_lng" numeric(9,6),
    "gps_end_lat" numeric(9,6),
    "gps_end_lng" numeric(9,6),
    "status" "text" DEFAULT 'in_progress'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "vehicle_type" "text",
    "source" "text",
    "allowance_amount" numeric,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "rate_per_km" numeric(10,2),
    CONSTRAINT "travel_logs_source_check" CHECK (("source" = ANY (ARRAY['gps'::"text", 'odometer'::"text"])))
);


--
-- Name: travel_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE "public"."travel_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: travel_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE "public"."travel_logs_id_seq" OWNED BY "public"."travel_logs"."id";


--
-- Name: v_atm_load_frequency; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_atm_load_frequency" AS
 SELECT "site_id",
    "count"(*) AS "loads_performed",
    "date_trunc"('month'::"text", "time_in") AS "load_month",
    "date_trunc"('week'::"text", "time_in") AS "load_week",
    "min"("time_in") AS "first_load",
    "max"("time_in") AS "last_load"
   FROM "public"."atm_replenishments"
  GROUP BY "site_id", ("date_trunc"('month'::"text", "time_in")), ("date_trunc"('week'::"text", "time_in"));


--
-- Name: VIEW "v_atm_load_frequency"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."v_atm_load_frequency" IS 'Analytics view for ATM load frequency patterns';


--
-- Name: v_atm_load_sources; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_atm_load_sources" AS
 SELECT "ar"."id",
    "ar"."assignment_id",
    "ar"."site_id",
    "a"."custodian_id",
    "ar"."time_in",
    COALESCE("ar"."denom_100", 0) AS "total_denom_100",
    COALESCE("ar"."denom_200", 0) AS "total_denom_200",
    COALESCE("ar"."denom_500", 0) AS "total_denom_500",
    COALESCE("ar"."denom_2000", 0) AS "total_denom_2000",
        CASE
            WHEN ("ar"."source_breakdown" ? 'bank_source'::"text") THEN COALESCE(((("ar"."source_breakdown" -> 'bank_source'::"text") ->> 'denom_100'::"text"))::integer, 0)
            ELSE 0
        END AS "bank_denom_100",
        CASE
            WHEN ("ar"."source_breakdown" ? 'bank_source'::"text") THEN COALESCE(((("ar"."source_breakdown" -> 'bank_source'::"text") ->> 'denom_200'::"text"))::integer, 0)
            ELSE 0
        END AS "bank_denom_200",
        CASE
            WHEN ("ar"."source_breakdown" ? 'bank_source'::"text") THEN COALESCE(((("ar"."source_breakdown" -> 'bank_source'::"text") ->> 'denom_500'::"text"))::integer, 0)
            ELSE 0
        END AS "bank_denom_500",
        CASE
            WHEN ("ar"."source_breakdown" ? 'bank_source'::"text") THEN COALESCE(((("ar"."source_breakdown" -> 'bank_source'::"text") ->> 'denom_2000'::"text"))::integer, 0)
            ELSE 0
        END AS "bank_denom_2000",
        CASE
            WHEN ("ar"."source_breakdown" ? 'internal_source'::"text") THEN COALESCE(((("ar"."source_breakdown" -> 'internal_source'::"text") ->> 'denom_100'::"text"))::integer, 0)
            ELSE 0
        END AS "internal_denom_100",
        CASE
            WHEN ("ar"."source_breakdown" ? 'internal_source'::"text") THEN COALESCE(((("ar"."source_breakdown" -> 'internal_source'::"text") ->> 'denom_200'::"text"))::integer, 0)
            ELSE 0
        END AS "internal_denom_200",
        CASE
            WHEN ("ar"."source_breakdown" ? 'internal_source'::"text") THEN COALESCE(((("ar"."source_breakdown" -> 'internal_source'::"text") ->> 'denom_500'::"text"))::integer, 0)
            ELSE 0
        END AS "internal_denom_500",
        CASE
            WHEN ("ar"."source_breakdown" ? 'internal_source'::"text") THEN COALESCE(((("ar"."source_breakdown" -> 'internal_source'::"text") ->> 'denom_2000'::"text"))::integer, 0)
            ELSE 0
        END AS "internal_denom_2000",
        CASE
            WHEN ("ar"."source_breakdown" ? 'bank_source'::"text") THEN COALESCE(((("ar"."source_breakdown" -> 'bank_source'::"text") ->> 'total_amount'::"text"))::numeric, (0)::numeric)
            ELSE (0)::numeric
        END AS "bank_total_amount",
        CASE
            WHEN ("ar"."source_breakdown" ? 'internal_source'::"text") THEN COALESCE(((("ar"."source_breakdown" -> 'internal_source'::"text") ->> 'total_amount'::"text"))::numeric, (0)::numeric)
            ELSE (0)::numeric
        END AS "internal_total_amount"
   FROM ("public"."atm_replenishments" "ar"
     LEFT JOIN "public"."assignments" "a" ON (("a"."id" = "ar"."assignment_id")));


--
-- Name: v_atm_load_utilization; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_atm_load_utilization" AS
 SELECT "ar"."site_id",
    "s"."bank_name",
    "s"."address",
    "s"."city",
    "count"("ar"."id") AS "load_count",
    "sum"(((((COALESCE("ar"."denom_2000", 0) * 2000) + (COALESCE("ar"."denom_500", 0) * 500)) + (COALESCE("ar"."denom_200", 0) * 200)) + (COALESCE("ar"."denom_100", 0) * 100))) AS "total_loaded",
    "avg"(((((COALESCE("ar"."denom_2000", 0) * 2000) + (COALESCE("ar"."denom_500", 0) * 500)) + (COALESCE("ar"."denom_200", 0) * 200)) + (COALESCE("ar"."denom_100", 0) * 100))) AS "avg_load_amount",
    "max"("ar"."time_in") AS "last_load_time",
    "min"("ar"."time_in") AS "first_load_time"
   FROM ("public"."atm_replenishments" "ar"
     LEFT JOIN "public"."sites" "s" ON (("s"."id" = "ar"."site_id")))
  GROUP BY "ar"."site_id", "s"."bank_name", "s"."address", "s"."city";


--
-- Name: VIEW "v_atm_load_utilization"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."v_atm_load_utilization" IS 'Analytics view for ATM load frequency and volume by site';


--
-- Name: v_atm_performance_score; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_atm_performance_score" AS
 SELECT "s"."id" AS "site_id",
    "s"."bank_name",
    "s"."address",
    "s"."city",
    COALESCE("count"(DISTINCT "ar"."id"), (0)::bigint) AS "total_loads",
    COALESCE("sum"(((((COALESCE("ar"."denom_2000", 0) * 2000) + (COALESCE("ar"."denom_500", 0) * 500)) + (COALESCE("ar"."denom_200", 0) * 200)) + (COALESCE("ar"."denom_100", 0) * 100))), (0)::bigint) AS "total_loaded_amount",
    COALESCE("sum"(( SELECT "sum"("cp2"."total_amount") AS "sum"
           FROM "public"."cash_pickups" "cp2"
          WHERE (("cp2"."assignment_id" = "ar"."assignment_id") AND ("cp2"."pickup_source" = 'ATM_INTERNAL'::"text")))), (0)::numeric) AS "internal_cash_used",
    COALESCE("sum"(( SELECT "sum"("cp3"."total_amount") AS "sum"
           FROM "public"."cash_pickups" "cp3"
          WHERE (("cp3"."assignment_id" = "ar"."assignment_id") AND ("cp3"."pickup_source" = 'BANK'::"text")))), (0)::numeric) AS "bank_cash_used",
    "round"(((COALESCE("sum"(( SELECT "sum"("cp2"."total_amount") AS "sum"
           FROM "public"."cash_pickups" "cp2"
          WHERE (("cp2"."assignment_id" = "ar"."assignment_id") AND ("cp2"."pickup_source" = 'ATM_INTERNAL'::"text")))), (0)::numeric) / (NULLIF(COALESCE("sum"(((((COALESCE("ar"."denom_2000", 0) * 2000) + (COALESCE("ar"."denom_500", 0) * 500)) + (COALESCE("ar"."denom_200", 0) * 200)) + (COALESCE("ar"."denom_100", 0) * 100))), (0)::bigint), 0))::numeric) * (100)::numeric), 2) AS "efficiency_score"
   FROM ("public"."sites" "s"
     LEFT JOIN "public"."atm_replenishments" "ar" ON (("ar"."site_id" = "s"."id")))
  GROUP BY "s"."id", "s"."bank_name", "s"."address", "s"."city";


--
-- Name: VIEW "v_atm_performance_score"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."v_atm_performance_score" IS 'Aggregate performance metrics for each ATM site';


--
-- Name: v_bank_pickup_trends; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_bank_pickup_trends" AS
 SELECT "bank_name",
    "branch",
    "count"(*) AS "pickup_count",
    "sum"("total_amount") AS "total_pickup_amount",
    "avg"("total_amount") AS "avg_pickup_amount",
    "max"("total_amount") AS "max_pickup",
    "min"("total_amount") AS "min_pickup",
    "stddev"("total_amount") AS "stddev_pickup",
    "date_trunc"('month'::"text", "pickup_time") AS "pickup_month",
    "date_trunc"('week'::"text", "pickup_time") AS "pickup_week",
    "date_trunc"('day'::"text", "pickup_time") AS "pickup_day"
   FROM "public"."cash_pickups"
  WHERE ("pickup_source" = 'BANK'::"text")
  GROUP BY "bank_name", "branch", ("date_trunc"('month'::"text", "pickup_time")), ("date_trunc"('week'::"text", "pickup_time")), ("date_trunc"('day'::"text", "pickup_time"));


--
-- Name: VIEW "v_bank_pickup_trends"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."v_bank_pickup_trends" IS 'Analytics view for bank pickup trends by time period, bank, and branch';


--
-- Name: v_cash_flow_intelligence; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_cash_flow_intelligence" AS
 SELECT "a"."id" AS "assignment_id",
    "a"."custodian_id",
    "a"."assignment_date",
    COALESCE("sum"("cp"."total_amount") FILTER (WHERE ("cp"."pickup_source" = 'BANK'::"text")), (0)::numeric) AS "total_bank_pickup",
    "count"(*) FILTER (WHERE ("cp"."pickup_source" = 'BANK'::"text")) AS "bank_pickup_count",
    COALESCE("sum"("cp"."total_amount") FILTER (WHERE ("cp"."pickup_source" = 'ATM_INTERNAL'::"text")), (0)::numeric) AS "total_atm_removed",
    "count"(*) FILTER (WHERE ("cp"."pickup_source" = 'ATM_INTERNAL'::"text")) AS "atm_removal_count",
    COALESCE("sum"(((((COALESCE("ar"."denom_2000", 0) * 2000) + (COALESCE("ar"."denom_500", 0) * 500)) + (COALESCE("ar"."denom_200", 0) * 200)) + (COALESCE("ar"."denom_100", 0) * 100))), (0)::bigint) AS "total_atm_loaded",
    "count"("ar"."id") AS "atm_load_count",
    COALESCE("sum"("cp"."total_amount"), (0)::numeric) AS "total_cash_collected",
    COALESCE("sum"(((((COALESCE("ar"."denom_2000", 0) * 2000) + (COALESCE("ar"."denom_500", 0) * 500)) + (COALESCE("ar"."denom_200", 0) * 200)) + (COALESCE("ar"."denom_100", 0) * 100))), (0)::bigint) AS "total_cash_deployed"
   FROM (("public"."assignments" "a"
     LEFT JOIN "public"."cash_pickups" "cp" ON (("cp"."assignment_id" = "a"."id")))
     LEFT JOIN "public"."atm_replenishments" "ar" ON (("ar"."assignment_id" = "a"."id")))
  GROUP BY "a"."id", "a"."custodian_id", "a"."assignment_date";


--
-- Name: VIEW "v_cash_flow_intelligence"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."v_cash_flow_intelligence" IS 'Comprehensive cash flow analytics per assignment';


--
-- Name: v_cash_recycling_rate; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_cash_recycling_rate" AS
 SELECT "a"."id" AS "assignment_id",
    "a"."custodian_id",
    "a"."assignment_date",
    COALESCE("sum"("cp"."total_amount") FILTER (WHERE ("cp"."pickup_source" = 'ATM_INTERNAL'::"text")), (0)::numeric) AS "atm_removed",
    COALESCE("sum"(((((COALESCE("ar"."denom_2000", 0) * 2000) + (COALESCE("ar"."denom_500", 0) * 500)) + (COALESCE("ar"."denom_200", 0) * 200)) + (COALESCE("ar"."denom_100", 0) * 100))), (0)::bigint) AS "atm_reused",
    COALESCE("sum"("cp"."total_amount") FILTER (WHERE ("cp"."pickup_source" = 'BANK'::"text")), (0)::numeric) AS "bank_pickup",
    "round"((((COALESCE("sum"(((((COALESCE("ar"."denom_2000", 0) * 2000) + (COALESCE("ar"."denom_500", 0) * 500)) + (COALESCE("ar"."denom_200", 0) * 200)) + (COALESCE("ar"."denom_100", 0) * 100))), (0)::bigint))::numeric / NULLIF(COALESCE("sum"("cp"."total_amount") FILTER (WHERE ("cp"."pickup_source" = 'ATM_INTERNAL'::"text")), (0)::numeric), (0)::numeric)) * (100)::numeric), 2) AS "recycling_percent"
   FROM (("public"."assignments" "a"
     LEFT JOIN "public"."cash_pickups" "cp" ON (("cp"."assignment_id" = "a"."id")))
     LEFT JOIN "public"."atm_replenishments" "ar" ON (("ar"."assignment_id" = "a"."id")))
  GROUP BY "a"."id", "a"."custodian_id", "a"."assignment_date";


--
-- Name: VIEW "v_cash_recycling_rate"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."v_cash_recycling_rate" IS 'Analytics view for ATM cash recycling efficiency';


--
-- Name: v_cash_variance_analytics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_cash_variance_analytics" AS
 SELECT "bank_name",
    "branch",
    "count"(*) AS "total_pickups",
    "count"(*) FILTER (WHERE ("variance" <> (0)::numeric)) AS "variance_cases",
    "count"(*) FILTER (WHERE ("variance" > (0)::numeric)) AS "positive_variance_cases",
    "count"(*) FILTER (WHERE ("variance" < (0)::numeric)) AS "negative_variance_cases",
    "sum"("variance") AS "total_variance",
    "avg"("variance") AS "avg_variance",
    "max"("variance") AS "max_variance",
    "min"("variance") AS "min_variance",
    "round"(((("count"(*) FILTER (WHERE ("variance" <> (0)::numeric)))::numeric / (NULLIF("count"(*), 0))::numeric) * (100)::numeric), 2) AS "variance_rate_percent"
   FROM "public"."cash_pickups"
  WHERE ("pickup_source" = 'BANK'::"text")
  GROUP BY "bank_name", "branch";


--
-- Name: VIEW "v_cash_variance_analytics"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."v_cash_variance_analytics" IS 'Analytics view for identifying cash variance patterns by bank and branch';


--
-- Name: v_internal_transfer_efficiency; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_internal_transfer_efficiency" AS
 SELECT "a"."id" AS "assignment_id",
    "a"."custodian_id",
    "a"."assignment_date",
    COALESCE("sum"("cp"."total_amount") FILTER (WHERE ("cp"."pickup_source" = 'ATM_INTERNAL'::"text")), (0)::numeric) AS "internal_used",
    COALESCE("sum"("cp"."total_amount") FILTER (WHERE ("cp"."pickup_source" = 'BANK'::"text")), (0)::numeric) AS "bank_used",
    COALESCE("sum"("cp"."total_amount"), (0)::numeric) AS "total_loaded",
    "round"(((COALESCE("sum"("cp"."total_amount") FILTER (WHERE ("cp"."pickup_source" = 'ATM_INTERNAL'::"text")), (0)::numeric) / NULLIF(COALESCE("sum"("cp"."total_amount"), (0)::numeric), (0)::numeric)) * (100)::numeric), 2) AS "internal_reuse_percent",
    "count"(DISTINCT "ar"."site_id") AS "atm_count"
   FROM (("public"."assignments" "a"
     LEFT JOIN "public"."cash_pickups" "cp" ON (("cp"."assignment_id" = "a"."id")))
     LEFT JOIN "public"."atm_replenishments" "ar" ON (("ar"."assignment_id" = "a"."id")))
  GROUP BY "a"."id", "a"."custodian_id", "a"."assignment_date";


--
-- Name: VIEW "v_internal_transfer_efficiency"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."v_internal_transfer_efficiency" IS 'Analytics view for measuring internal cash transfer vs bank pickup efficiency';


--
-- Name: v_cash_risk_indicators; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_cash_risk_indicators" AS
 SELECT 'HIGH_VARIANCE_BRANCH'::"text" AS "risk_type",
    "v_cash_variance_analytics"."bank_name",
    "v_cash_variance_analytics"."branch" AS "identifier",
    NULL::bigint AS "site_id",
    "v_cash_variance_analytics"."total_variance" AS "risk_value",
    "v_cash_variance_analytics"."variance_rate_percent" AS "risk_percent",
    'Variance rate exceeds threshold'::"text" AS "risk_description"
   FROM "public"."v_cash_variance_analytics"
  WHERE ("v_cash_variance_analytics"."variance_rate_percent" > (10)::numeric)
UNION ALL
 SELECT 'ATM_OVERLOAD'::"text" AS "risk_type",
    "v_atm_load_utilization"."bank_name",
    "v_atm_load_utilization"."address" AS "identifier",
    "v_atm_load_utilization"."site_id",
    "v_atm_load_utilization"."load_count" AS "risk_value",
    NULL::numeric AS "risk_percent",
    'Load frequency exceeds 15 per month'::"text" AS "risk_description"
   FROM "public"."v_atm_load_utilization"
  WHERE ("v_atm_load_utilization"."load_count" > 15)
UNION ALL
 SELECT 'LOW_CASH_RECYCLING'::"text" AS "risk_type",
    NULL::"text" AS "bank_name",
    ("v_internal_transfer_efficiency"."assignment_id")::"text" AS "identifier",
    NULL::bigint AS "site_id",
    "v_internal_transfer_efficiency"."internal_used" AS "risk_value",
    "v_internal_transfer_efficiency"."internal_reuse_percent" AS "risk_percent",
    'Internal cash reuse below 20%'::"text" AS "risk_description"
   FROM "public"."v_internal_transfer_efficiency"
  WHERE (("v_internal_transfer_efficiency"."internal_reuse_percent" < (20)::numeric) AND ("v_internal_transfer_efficiency"."total_loaded" > (10000)::numeric));


--
-- Name: VIEW "v_cash_risk_indicators"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."v_cash_risk_indicators" IS 'Automated risk detection for high variance, overload, and low efficiency';


--
-- Name: v_cheque_verifications; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_cheque_verifications" AS
 SELECT "cp"."id" AS "pickup_id",
    "cp"."assignment_id",
    "cp"."bank_name",
    "cp"."branch" AS "branch_name",
    "date"("cp"."pickup_time") AS "pickup_date",
    "cp"."cheque_number",
    "cp"."cheque_image_url",
    "cp"."cheque_status",
    "cp"."cheque_verified",
    "cp"."cheque_verified_by",
    "cp"."cheque_verified_at",
    "cp"."cheque_metadata",
    "cp"."expected_amount",
    "cp"."total_amount" AS "pickup_amount",
    ("cp"."total_amount" - "cp"."expected_amount") AS "variance",
    "cal"."old_status" AS "last_previous_status",
    "cal"."updated_at" AS "last_status_change",
    "cp"."created_at"
   FROM ("public"."cash_pickups" "cp"
     LEFT JOIN LATERAL ( SELECT "cal_inner"."old_status",
            "cal_inner"."updated_at"
           FROM "public"."cheque_audit_log" "cal_inner"
          WHERE ("cal_inner"."pickup_id" = "cp"."id")
          ORDER BY "cal_inner"."updated_at" DESC
         LIMIT 1) "cal" ON (true))
  WHERE (("cp"."pickup_source" = 'BANK'::"text") AND ("cp"."cheque_number" IS NOT NULL))
  ORDER BY "cp"."created_at" DESC;


--
-- Name: v_rolling_pickup_trends; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_rolling_pickup_trends" AS
 SELECT "bank_name",
    "branch",
    ("pickup_time")::"date" AS "pickup_date",
    "total_amount",
    "avg"("total_amount") OVER (PARTITION BY "bank_name", "branch" ORDER BY "pickup_time" ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS "rolling_avg_7_day",
    "avg"("total_amount") OVER (PARTITION BY "bank_name", "branch" ORDER BY "pickup_time" ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS "rolling_avg_30_day",
    "count"(*) OVER (PARTITION BY "bank_name", "branch" ORDER BY "pickup_time" ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS "pickup_count_7_day",
    "count"(*) OVER (PARTITION BY "bank_name", "branch" ORDER BY "pickup_time" ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS "pickup_count_30_day"
   FROM "public"."cash_pickups"
  WHERE ("pickup_source" = 'BANK'::"text")
  ORDER BY "bank_name", "branch", "pickup_time" DESC;


--
-- Name: VIEW "v_rolling_pickup_trends"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW "public"."v_rolling_pickup_trends" IS 'Rolling averages for predictive analytics and forecasting';


--
-- Name: v_soa_detailed; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_soa_detailed" AS
 SELECT "id" AS "soa_id",
    "id" AS "assignment_id",
    "custodian_id",
    "assignment_date",
    COALESCE(( SELECT "sum"(((((((((("cp"."denom_2000" * 2000) + ("cp"."denom_500" * 500)) + ("cp"."denom_200" * 200)) + ("cp"."denom_100" * 100)) + ("cp"."denom_50" * 50)) + ("cp"."denom_20" * 20)) + ("cp"."denom_10" * 10)))::numeric - COALESCE((NULLIF(("cp"."internal_source_metadata" ->> 'total_internal_amount'::"text"), ''::"text"))::numeric, (0)::numeric))) AS "sum"
           FROM "public"."cash_pickups" "cp"
          WHERE (("cp"."assignment_id" = "a"."id") AND (COALESCE("cp"."pickup_source", 'BANK'::"text") = 'BANK'::"text"))), (0)::numeric) AS "bank_withdrawals",
    (COALESCE(( SELECT "sum"(((((((("cp"."denom_2000" * 2000) + ("cp"."denom_500" * 500)) + ("cp"."denom_200" * 200)) + ("cp"."denom_100" * 100)) + ("cp"."denom_50" * 50)) + ("cp"."denom_20" * 20)) + ("cp"."denom_10" * 10))) AS "sum"
           FROM "public"."cash_pickups" "cp"
          WHERE (("cp"."assignment_id" = "a"."id") AND ("cp"."pickup_source" = 'ATM_INTERNAL'::"text"))), (0)::bigint))::numeric AS "internal_withdrawals",
    COALESCE(( SELECT "sum"(((((((((("cp"."denom_2000" * 2000) + ("cp"."denom_500" * 500)) + ("cp"."denom_200" * 200)) + ("cp"."denom_100" * 100)) + ("cp"."denom_50" * 50)) + ("cp"."denom_20" * 20)) + ("cp"."denom_10" * 10)))::numeric - COALESCE((NULLIF(("cp"."internal_source_metadata" ->> 'total_internal_amount'::"text"), ''::"text"))::numeric, (0)::numeric))) AS "sum"
           FROM "public"."cash_pickups" "cp"
          WHERE (("cp"."assignment_id" = "a"."id") AND (COALESCE("cp"."pickup_source", 'BANK'::"text") = 'BANK'::"text"))), (0)::numeric) AS "opening_balance",
    COALESCE(( SELECT "sum"(((((((((("cp"."denom_2000" * 2000) + ("cp"."denom_500" * 500)) + ("cp"."denom_200" * 200)) + ("cp"."denom_100" * 100)) + ("cp"."denom_50" * 50)) + ("cp"."denom_20" * 20)) + ("cp"."denom_10" * 10)))::numeric - COALESCE((NULLIF(("cp"."internal_source_metadata" ->> 'total_internal_amount'::"text"), ''::"text"))::numeric, (0)::numeric))) AS "sum"
           FROM "public"."cash_pickups" "cp"
          WHERE (("cp"."assignment_id" = "a"."id") AND (COALESCE("cp"."pickup_source", 'BANK'::"text") = 'BANK'::"text"))), (0)::numeric) AS "total_withdrawals",
    COALESCE(( SELECT "sum"("v"."bank_total_amount") AS "sum"
           FROM "public"."v_atm_load_sources" "v"
          WHERE ("v"."assignment_id" = "a"."id")), (0)::numeric) AS "bank_loads",
    COALESCE(( SELECT "sum"("v"."internal_total_amount") AS "sum"
           FROM "public"."v_atm_load_sources" "v"
          WHERE ("v"."assignment_id" = "a"."id")), (0)::numeric) AS "internal_loads",
    COALESCE(( SELECT "sum"("v"."bank_total_amount") AS "sum"
           FROM "public"."v_atm_load_sources" "v"
          WHERE ("v"."assignment_id" = "a"."id")), (0)::numeric) AS "total_loads",
    (COALESCE(( SELECT "sum"((((((((COALESCE(((("sa"."exchange_metadata" -> 'delta_denominations'::"text") ->> 'denom_2000'::"text"))::bigint, (0)::bigint) * 2000) + (COALESCE(((("sa"."exchange_metadata" -> 'delta_denominations'::"text") ->> 'denom_500'::"text"))::bigint, (0)::bigint) * 500)) + (COALESCE(((("sa"."exchange_metadata" -> 'delta_denominations'::"text") ->> 'denom_200'::"text"))::bigint, (0)::bigint) * 200)) + (COALESCE(((("sa"."exchange_metadata" -> 'delta_denominations'::"text") ->> 'denom_100'::"text"))::bigint, (0)::bigint) * 100)) + (COALESCE(((("sa"."exchange_metadata" -> 'delta_denominations'::"text") ->> 'denom_50'::"text"))::bigint, (0)::bigint) * 50)) + (COALESCE(((("sa"."exchange_metadata" -> 'delta_denominations'::"text") ->> 'denom_20'::"text"))::bigint, (0)::bigint) * 20)) + (COALESCE(((("sa"."exchange_metadata" -> 'delta_denominations'::"text") ->> 'denom_10'::"text"))::bigint, (0)::bigint) * 10))) AS "sum"
           FROM "public"."soa_adjustments" "sa"
          WHERE (("sa"."assignment_id" = "a"."id") AND ("sa"."custodian_confirmed" = true) AND (("sa"."exchange_metadata" ->> 'type'::"text") = 'ADMIN_CORRECTION'::"text"))), (0)::numeric))::integer AS "net_adjustments",
    ( SELECT "count"(*) AS "count"
           FROM "public"."soa_adjustments" "sa"
          WHERE (("sa"."assignment_id" = "a"."id") AND ("sa"."adjustment_type" = 'EXCHANGE'::"text"))) AS "exchange_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."soa_adjustments" "sa"
          WHERE (("sa"."assignment_id" = "a"."id") AND ("sa"."adjustment_type" = 'INTER_SITE_TRANSFER'::"text"))) AS "transfer_count",
    COALESCE(( SELECT "sum"((((("ec"."denom_2000" * 2000) + ("ec"."denom_500" * 500)) + ("ec"."denom_200" * 200)) + ("ec"."denom_100" * 100))) AS "sum"
           FROM "public"."atm_excess_cash" "ec"
          WHERE ("ec"."assignment_id" = "a"."id")), (0)::bigint) AS "excess_reported",
    COALESCE(( SELECT "sum"("tl"."km_covered") AS "sum"
           FROM "public"."travel_logs" "tl"
          WHERE ("tl"."assignment_id" = "a"."id")), (0)::numeric) AS "travel_km",
    COALESCE(( SELECT "sum"("tl"."allowance_amount") AS "sum"
           FROM "public"."travel_logs" "tl"
          WHERE ("tl"."assignment_id" = "a"."id")), (0)::numeric) AS "travel_allowance",
    "status",
    "created_at",
    ( SELECT "count"(*) AS "count"
           FROM "public"."soa_adjustments" "sa"
          WHERE (("sa"."assignment_id" = "a"."id") AND (("sa"."exchange_metadata" ->> 'type'::"text") = 'ADMIN_CORRECTION'::"text") AND ("sa"."custodian_confirmed" = true))) AS "admin_correction_count"
   FROM "public"."assignments" "a";


--
-- Name: v_soa_effective; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_soa_effective" AS
 SELECT "id" AS "soa_id",
    "id" AS "assignment_id",
    "custodian_id",
    "assignment_date",
    COALESCE(( SELECT "sum"(((((((((("cp"."denom_2000" * 2000) + ("cp"."denom_500" * 500)) + ("cp"."denom_200" * 200)) + ("cp"."denom_100" * 100)) + ("cp"."denom_50" * 50)) + ("cp"."denom_20" * 20)) + ("cp"."denom_10" * 10)))::numeric - COALESCE((NULLIF(("cp"."internal_source_metadata" ->> 'total_internal_amount'::"text"), ''::"text"))::numeric, (0)::numeric))) AS "sum"
           FROM "public"."cash_pickups" "cp"
          WHERE (("cp"."assignment_id" = "a"."id") AND (COALESCE("cp"."pickup_source", 'BANK'::"text") = 'BANK'::"text"))), (0)::numeric) AS "bank_picked",
    (COALESCE(( SELECT "sum"(((((((("cp"."denom_2000" * 2000) + ("cp"."denom_500" * 500)) + ("cp"."denom_200" * 200)) + ("cp"."denom_100" * 100)) + ("cp"."denom_50" * 50)) + ("cp"."denom_20" * 20)) + ("cp"."denom_10" * 10))) AS "sum"
           FROM "public"."cash_pickups" "cp"
          WHERE (("cp"."assignment_id" = "a"."id") AND ("cp"."pickup_source" = 'ATM_INTERNAL'::"text"))), (0)::bigint))::numeric AS "internal_picked",
    COALESCE(( SELECT "sum"("v"."bank_total_amount") AS "sum"
           FROM "public"."v_atm_load_sources" "v"
          WHERE ("v"."assignment_id" = "a"."id")), (0)::numeric) AS "bank_loaded",
    COALESCE(( SELECT "sum"("v"."internal_total_amount") AS "sum"
           FROM "public"."v_atm_load_sources" "v"
          WHERE ("v"."assignment_id" = "a"."id")), (0)::numeric) AS "internal_loaded",
    COALESCE(( SELECT "sum"(((((((((("cp"."denom_2000" * 2000) + ("cp"."denom_500" * 500)) + ("cp"."denom_200" * 200)) + ("cp"."denom_100" * 100)) + ("cp"."denom_50" * 50)) + ("cp"."denom_20" * 20)) + ("cp"."denom_10" * 10)))::numeric - COALESCE((NULLIF(("cp"."internal_source_metadata" ->> 'total_internal_amount'::"text"), ''::"text"))::numeric, (0)::numeric))) AS "sum"
           FROM "public"."cash_pickups" "cp"
          WHERE (("cp"."assignment_id" = "a"."id") AND (COALESCE("cp"."pickup_source", 'BANK'::"text") = 'BANK'::"text"))), (0)::numeric) AS "cash_picked",
    COALESCE(( SELECT "sum"(("v"."bank_total_amount" + COALESCE("v"."internal_total_amount", (0)::numeric))) AS "sum"
           FROM "public"."v_atm_load_sources" "v"
          WHERE ("v"."assignment_id" = "a"."id")), (0)::numeric) AS "cash_loaded",
    0 AS "cash_adjusted",
    COALESCE(( SELECT "sum"((((("ec"."denom_2000" * 2000) + ("ec"."denom_500" * 500)) + ("ec"."denom_200" * 200)) + ("ec"."denom_100" * 100))) AS "sum"
           FROM "public"."atm_excess_cash" "ec"
          WHERE ("ec"."assignment_id" = "a"."id")), (0)::bigint) AS "excess_reported",
    COALESCE(( SELECT "sum"("tl"."km_covered") AS "sum"
           FROM "public"."travel_logs" "tl"
          WHERE ("tl"."assignment_id" = "a"."id")), (0)::numeric) AS "travel_km",
    COALESCE(( SELECT "sum"("tl"."allowance_amount") AS "sum"
           FROM "public"."travel_logs" "tl"
          WHERE ("tl"."assignment_id" = "a"."id")), (0)::numeric) AS "travel_allowance",
    (((COALESCE(( SELECT "sum"(((((((((("cp"."denom_2000" * 2000) + ("cp"."denom_500" * 500)) + ("cp"."denom_200" * 200)) + ("cp"."denom_100" * 100)) + ("cp"."denom_50" * 50)) + ("cp"."denom_20" * 20)) + ("cp"."denom_10" * 10)))::numeric - COALESCE((NULLIF(("cp"."internal_source_metadata" ->> 'total_internal_amount'::"text"), ''::"text"))::numeric, (0)::numeric))) AS "sum"
           FROM "public"."cash_pickups" "cp"
          WHERE (("cp"."assignment_id" = "a"."id") AND (COALESCE("cp"."pickup_source", 'BANK'::"text") = 'BANK'::"text"))), (0)::numeric) + COALESCE((( SELECT "sum"(((((((("cp"."denom_2000" * 2000) + ("cp"."denom_500" * 500)) + ("cp"."denom_200" * 200)) + ("cp"."denom_100" * 100)) + ("cp"."denom_50" * 50)) + ("cp"."denom_20" * 20)) + ("cp"."denom_10" * 10))) AS "sum"
           FROM "public"."cash_pickups" "cp"
          WHERE (("cp"."assignment_id" = "a"."id") AND ("cp"."pickup_source" = 'ATM_INTERNAL'::"text"))))::numeric, (0)::numeric)) - COALESCE(( SELECT "sum"(("v"."bank_total_amount" + COALESCE("v"."internal_total_amount", (0)::numeric))) AS "sum"
           FROM "public"."v_atm_load_sources" "v"
          WHERE ("v"."assignment_id" = "a"."id")), (0)::numeric)) + COALESCE(( SELECT "sum"((((((((COALESCE(((("sa"."exchange_metadata" -> 'delta_denominations'::"text") ->> 'denom_2000'::"text"))::bigint, (0)::bigint) * 2000) + (COALESCE(((("sa"."exchange_metadata" -> 'delta_denominations'::"text") ->> 'denom_500'::"text"))::bigint, (0)::bigint) * 500)) + (COALESCE(((("sa"."exchange_metadata" -> 'delta_denominations'::"text") ->> 'denom_200'::"text"))::bigint, (0)::bigint) * 200)) + (COALESCE(((("sa"."exchange_metadata" -> 'delta_denominations'::"text") ->> 'denom_100'::"text"))::bigint, (0)::bigint) * 100)) + (COALESCE(((("sa"."exchange_metadata" -> 'delta_denominations'::"text") ->> 'denom_50'::"text"))::bigint, (0)::bigint) * 50)) + (COALESCE(((("sa"."exchange_metadata" -> 'delta_denominations'::"text") ->> 'denom_20'::"text"))::bigint, (0)::bigint) * 20)) + (COALESCE(((("sa"."exchange_metadata" -> 'delta_denominations'::"text") ->> 'denom_10'::"text"))::bigint, (0)::bigint) * 10))) AS "sum"
           FROM "public"."soa_adjustments" "sa"
          WHERE (("sa"."assignment_id" = "a"."id") AND ("sa"."custodian_confirmed" = true) AND (("sa"."exchange_metadata" ->> 'type'::"text") = 'ADMIN_CORRECTION'::"text"))), (0)::numeric)) AS "final_net_cash_position",
    "created_at" AS "posted_at"
   FROM "public"."assignments" "a";


--
-- Name: v_soa_kpi_safe; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_soa_kpi_safe" AS
 SELECT "a"."id" AS "assignment_id",
    "a"."assignment_date",
    "a"."custodian_id",
    COALESCE("bp"."bank_picked", (0)::bigint) AS "bank_picked",
    COALESCE("ip"."internal_picked", (0)::bigint) AS "internal_picked",
    COALESCE("l"."bank_loaded", (0)::numeric) AS "bank_loaded",
    COALESCE("l"."internal_loaded", (0)::numeric) AS "internal_loaded",
    ((COALESCE("bp"."bank_picked", (0)::bigint))::numeric - COALESCE("l"."bank_loaded", (0)::numeric)) AS "final_net_cash_position"
   FROM ((("public"."assignments" "a"
     LEFT JOIN ( SELECT "cash_pickups"."assignment_id",
            "sum"(((((((("cash_pickups"."denom_2000" * 2000) + ("cash_pickups"."denom_500" * 500)) + ("cash_pickups"."denom_200" * 200)) + ("cash_pickups"."denom_100" * 100)) + ("cash_pickups"."denom_50" * 50)) + ("cash_pickups"."denom_20" * 20)) + ("cash_pickups"."denom_10" * 10))) AS "bank_picked"
           FROM "public"."cash_pickups"
          WHERE (COALESCE("cash_pickups"."pickup_source", 'BANK'::"text") = 'BANK'::"text")
          GROUP BY "cash_pickups"."assignment_id") "bp" ON (("bp"."assignment_id" = "a"."id")))
     LEFT JOIN ( SELECT "cash_pickups"."assignment_id",
            "sum"(((((((("cash_pickups"."denom_2000" * 2000) + ("cash_pickups"."denom_500" * 500)) + ("cash_pickups"."denom_200" * 200)) + ("cash_pickups"."denom_100" * 100)) + ("cash_pickups"."denom_50" * 50)) + ("cash_pickups"."denom_20" * 20)) + ("cash_pickups"."denom_10" * 10))) AS "internal_picked"
           FROM "public"."cash_pickups"
          WHERE ("cash_pickups"."pickup_source" = 'ATM_INTERNAL'::"text")
          GROUP BY "cash_pickups"."assignment_id") "ip" ON (("ip"."assignment_id" = "a"."id")))
     LEFT JOIN ( SELECT "v_atm_load_sources"."assignment_id",
            "sum"("v_atm_load_sources"."bank_total_amount") AS "bank_loaded",
            "sum"("v_atm_load_sources"."internal_total_amount") AS "internal_loaded"
           FROM "public"."v_atm_load_sources"
          GROUP BY "v_atm_load_sources"."assignment_id") "l" ON (("l"."assignment_id" = "a"."id")));


--
-- Name: v_statement_of_accounts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW "public"."v_statement_of_accounts" AS
 SELECT "l"."assignment_id",
    "a"."assignment_date",
    "l"."entry_date",
    "l"."entry_time",
    "p"."full_name" AS "custodian_name",
    "l"."event_type",
    "l"."source_table",
    "l"."source_id",
    "s"."site_code",
    "s"."bank_name",
    "s"."address",
    "l"."amount",
    "l"."direction",
    "l"."running_balance",
    "l"."remarks"
   FROM ((("public"."soa_ledger" "l"
     JOIN "public"."assignments" "a" ON (("a"."id" = "l"."assignment_id")))
     JOIN "public"."profiles" "p" ON (("p"."id" = "l"."custodian_id")))
     LEFT JOIN "public"."sites" "s" ON (("s"."id" = "l"."site_id")))
  ORDER BY "l"."entry_date", "l"."entry_time";


--
-- Name: vehicle_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."vehicle_rates" (
    "vehicle_type" "text" NOT NULL,
    "rate_per_km" numeric NOT NULL,
    "active" boolean DEFAULT true
);


--
-- Name: assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."assignments_id_seq"'::"regclass");


--
-- Name: atm_cash_adjustments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_cash_adjustments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."atm_cash_adjustments_id_seq"'::"regclass");


--
-- Name: atm_excess_cash id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_excess_cash" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."atm_excess_cash_id_seq"'::"regclass");


--
-- Name: atm_replenishments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_replenishments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."atm_replenishments_id_seq"'::"regclass");


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."audit_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_logs_id_seq"'::"regclass");


--
-- Name: bank_denomination_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_denomination_plans" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bank_denomination_plans_id_seq"'::"regclass");


--
-- Name: banks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."banks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."banks_id_seq"'::"regclass");


--
-- Name: cash_pickups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cash_pickups" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cash_pickups_id_seq"'::"regclass");


--
-- Name: cheque_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cheque_audit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cheque_audit_log_id_seq"'::"regclass");


--
-- Name: denomination_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."denomination_plans" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."denomination_plans_id_seq"'::"regclass");


--
-- Name: route_sites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."route_sites" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."route_sites_id_seq"'::"regclass");


--
-- Name: sites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."sites" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sites_id_seq"'::"regclass");


--
-- Name: soa_adjustments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."soa_adjustments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."soa_adjustments_id_seq"'::"regclass");


--
-- Name: soa_ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."soa_ledger" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."soa_ledger_id_seq"'::"regclass");


--
-- Name: soa_postings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."soa_postings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."soa_postings_id_seq"'::"regclass");


--
-- Name: technical_issues id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."technical_issues" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."technical_issues_id_seq"'::"regclass");


--
-- Name: travel_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."travel_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."travel_logs_id_seq"'::"regclass");


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");


--
-- Name: atm_cash_adjustments atm_cash_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_cash_adjustments"
    ADD CONSTRAINT "atm_cash_adjustments_pkey" PRIMARY KEY ("id");


--
-- Name: atm_excess_cash atm_excess_cash_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_excess_cash"
    ADD CONSTRAINT "atm_excess_cash_pkey" PRIMARY KEY ("id");


--
-- Name: atm_removal_plans atm_removal_plans_assignment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_removal_plans"
    ADD CONSTRAINT "atm_removal_plans_assignment_id_key" UNIQUE ("assignment_id");


--
-- Name: atm_removal_plans atm_removal_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_removal_plans"
    ADD CONSTRAINT "atm_removal_plans_pkey" PRIMARY KEY ("id");


--
-- Name: atm_replenishments atm_replenishments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_replenishments"
    ADD CONSTRAINT "atm_replenishments_pkey" PRIMARY KEY ("id");


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");


--
-- Name: bank_accounts bank_accounts_account_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_account_unique" UNIQUE ("account_number", "ifsc_code");


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id");


--
-- Name: bank_denomination_plans bank_denomination_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_denomination_plans"
    ADD CONSTRAINT "bank_denomination_plans_pkey" PRIMARY KEY ("id");


--
-- Name: banks banks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."banks"
    ADD CONSTRAINT "banks_pkey" PRIMARY KEY ("id");


--
-- Name: cash_pickups cash_pickups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cash_pickups"
    ADD CONSTRAINT "cash_pickups_pkey" PRIMARY KEY ("id");


--
-- Name: cheque_audit_log cheque_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cheque_audit_log"
    ADD CONSTRAINT "cheque_audit_log_pkey" PRIMARY KEY ("id");


--
-- Name: denomination_plans denomination_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."denomination_plans"
    ADD CONSTRAINT "denomination_plans_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


--
-- Name: route_sites route_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."route_sites"
    ADD CONSTRAINT "route_sites_pkey" PRIMARY KEY ("id");


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_pkey" PRIMARY KEY ("id");


--
-- Name: sites sites_site_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_site_code_key" UNIQUE ("site_code");


--
-- Name: soa_adjustments soa_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."soa_adjustments"
    ADD CONSTRAINT "soa_adjustments_pkey" PRIMARY KEY ("id");


--
-- Name: soa_ledger soa_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."soa_ledger"
    ADD CONSTRAINT "soa_ledger_pkey" PRIMARY KEY ("id");


--
-- Name: soa_ledger soa_ledger_source_table_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."soa_ledger"
    ADD CONSTRAINT "soa_ledger_source_table_source_id_key" UNIQUE ("source_table", "source_id");


--
-- Name: soa_postings soa_postings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."soa_postings"
    ADD CONSTRAINT "soa_postings_pkey" PRIMARY KEY ("id");


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key");


--
-- Name: technical_issues technical_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."technical_issues"
    ADD CONSTRAINT "technical_issues_pkey" PRIMARY KEY ("id");


--
-- Name: travel_logs travel_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."travel_logs"
    ADD CONSTRAINT "travel_logs_pkey" PRIMARY KEY ("id");


--
-- Name: denomination_plans uniq_denom_plan_assignment_site; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."denomination_plans"
    ADD CONSTRAINT "uniq_denom_plan_assignment_site" UNIQUE ("assignment_id", "site_id");


--
-- Name: vehicle_rates vehicle_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."vehicle_rates"
    ADD CONSTRAINT "vehicle_rates_pkey" PRIMARY KEY ("vehicle_type");


--
-- Name: assignments_unique_custodian_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "assignments_unique_custodian_date" ON "public"."assignments" USING "btree" ("custodian_id", "assignment_date");


--
-- Name: bank_accounts_account_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "bank_accounts_account_number_idx" ON "public"."bank_accounts" USING "btree" ("account_number");


--
-- Name: bank_accounts_bank_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "bank_accounts_bank_name_idx" ON "public"."bank_accounts" USING "btree" ("bank_name");


--
-- Name: bank_accounts_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "bank_accounts_created_at_idx" ON "public"."bank_accounts" USING "btree" ("created_at");


--
-- Name: bank_accounts_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "bank_accounts_created_by_idx" ON "public"."bank_accounts" USING "btree" ("created_by");


--
-- Name: bank_accounts_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "bank_accounts_is_active_idx" ON "public"."bank_accounts" USING "btree" ("is_active");


--
-- Name: bank_denomination_plans_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "bank_denomination_plans_unique" ON "public"."bank_denomination_plans" USING "btree" ("assignment_id", "bank_account_id");


--
-- Name: cash_pickups_bank_account_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cash_pickups_bank_account_id_idx" ON "public"."cash_pickups" USING "btree" ("bank_account_id");


--
-- Name: idx_assignments_custodian; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_assignments_custodian" ON "public"."assignments" USING "btree" ("custodian_id");


--
-- Name: idx_assignments_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_assignments_date" ON "public"."assignments" USING "btree" ("assignment_date");


--
-- Name: idx_atm_repl_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_atm_repl_assignment" ON "public"."atm_replenishments" USING "btree" ("assignment_id");


--
-- Name: idx_atm_repl_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_atm_repl_site" ON "public"."atm_replenishments" USING "btree" ("site_id");


--
-- Name: idx_atm_replenishments_source_breakdown; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_atm_replenishments_source_breakdown" ON "public"."atm_replenishments" USING "gin" ("source_breakdown") WHERE ("source_breakdown" IS NOT NULL);


--
-- Name: idx_cash_pickups_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cash_pickups_assignment" ON "public"."cash_pickups" USING "btree" ("assignment_id");


--
-- Name: idx_cash_pickups_assignment_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cash_pickups_assignment_time" ON "public"."cash_pickups" USING "btree" ("assignment_id", "pickup_time");


--
-- Name: idx_cash_pickups_internal_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cash_pickups_internal_source" ON "public"."cash_pickups" USING "gin" ("internal_source_metadata") WHERE ("internal_source_metadata" IS NOT NULL);


--
-- Name: idx_cash_pickups_pickup_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cash_pickups_pickup_source" ON "public"."cash_pickups" USING "btree" ("pickup_source");


--
-- Name: idx_cash_pickups_source_site_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cash_pickups_source_site_id" ON "public"."cash_pickups" USING "btree" ("source_site_id");


--
-- Name: idx_cheque_audit_pickup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cheque_audit_pickup" ON "public"."cheque_audit_log" USING "btree" ("pickup_id");


--
-- Name: idx_cheque_audit_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cheque_audit_status" ON "public"."cheque_audit_log" USING "btree" ("new_status");


--
-- Name: idx_cheque_audit_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_cheque_audit_updated" ON "public"."cheque_audit_log" USING "btree" ("updated_at" DESC);


--
-- Name: idx_denomination_plans_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_denomination_plans_assignment" ON "public"."denomination_plans" USING "btree" ("assignment_id");


--
-- Name: idx_denomination_plans_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_denomination_plans_site" ON "public"."denomination_plans" USING "btree" ("site_id");


--
-- Name: idx_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");


--
-- Name: idx_profiles_first_login; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_profiles_first_login" ON "public"."profiles" USING "btree" ("first_login") WHERE ("first_login" = true);


--
-- Name: idx_profiles_mobile_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_profiles_mobile_number" ON "public"."profiles" USING "btree" ("mobile_number") WHERE ("mobile_number" IS NOT NULL);


--
-- Name: idx_profiles_mobile_number_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "idx_profiles_mobile_number_unique" ON "public"."profiles" USING "btree" ("mobile_number") WHERE ("mobile_number" IS NOT NULL);


--
-- Name: idx_route_sites_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_route_sites_assignment" ON "public"."route_sites" USING "btree" ("assignment_id");


--
-- Name: idx_route_sites_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_route_sites_site" ON "public"."route_sites" USING "btree" ("site_id");


--
-- Name: idx_soa_adjustments_assignment_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_soa_adjustments_assignment_type" ON "public"."soa_adjustments" USING "btree" ("assignment_id", "adjustment_type");


--
-- Name: idx_soa_adjustments_exchange_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_soa_adjustments_exchange_metadata" ON "public"."soa_adjustments" USING "gin" ("exchange_metadata");


--
-- Name: idx_soa_adjustments_soa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_soa_adjustments_soa" ON "public"."soa_adjustments" USING "btree" ("soa_id");


--
-- Name: idx_soa_adjustments_transfer_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_soa_adjustments_transfer_metadata" ON "public"."soa_adjustments" USING "gin" ("transfer_metadata");


--
-- Name: idx_soa_adjustments_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_soa_adjustments_type" ON "public"."soa_adjustments" USING "btree" ("adjustment_type");


--
-- Name: idx_soa_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_soa_assignment" ON "public"."soa_ledger" USING "btree" ("assignment_id");


--
-- Name: idx_soa_custodian; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_soa_custodian" ON "public"."soa_ledger" USING "btree" ("custodian_id");


--
-- Name: idx_soa_custodian_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_soa_custodian_date" ON "public"."soa_postings" USING "btree" ("custodian_id", "assignment_date");


--
-- Name: idx_soa_entry_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_soa_entry_date" ON "public"."soa_ledger" USING "btree" ("entry_date");


--
-- Name: idx_soa_posted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_soa_posted_at" ON "public"."soa_postings" USING "btree" ("posted_at");


--
-- Name: idx_tech_issues_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_tech_issues_assignment" ON "public"."technical_issues" USING "btree" ("assignment_id");


--
-- Name: idx_tech_issues_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_tech_issues_site" ON "public"."technical_issues" USING "btree" ("site_id");


--
-- Name: idx_travel_logs_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_travel_logs_assignment" ON "public"."travel_logs" USING "btree" ("assignment_id");


--
-- Name: idx_travel_logs_custodian; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_travel_logs_custodian" ON "public"."travel_logs" USING "btree" ("custodian_id");


--
-- Name: idx_travel_logs_start_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "idx_travel_logs_start_time" ON "public"."travel_logs" USING "btree" ("start_time");


--
-- Name: uniq_active_travel_log; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "uniq_active_travel_log" ON "public"."travel_logs" USING "btree" ("custodian_id", "assignment_id") WHERE ("status" = 'in_progress'::"text");


--
-- Name: uniq_soa_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "uniq_soa_assignment" ON "public"."soa_postings" USING "btree" ("assignment_id");


--
-- Name: atm_cash_adjustments after_atm_cash_adjustments_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "after_atm_cash_adjustments_insert" AFTER INSERT ON "public"."atm_cash_adjustments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_atm_cash_adjustments_soa"();


--
-- Name: atm_excess_cash after_atm_excess_cash_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "after_atm_excess_cash_insert" AFTER INSERT ON "public"."atm_excess_cash" FOR EACH ROW EXECUTE FUNCTION "public"."trg_atm_excess_cash_soa"();


--
-- Name: atm_replenishments after_atm_replenishments_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "after_atm_replenishments_insert" AFTER INSERT ON "public"."atm_replenishments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_atm_replenishments_soa"();


--
-- Name: soa_adjustments after_soa_adjustment_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "after_soa_adjustment_insert" AFTER INSERT ON "public"."soa_adjustments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_soa_adjustment_ledger"();


--
-- Name: travel_logs after_travel_logs_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "after_travel_logs_update" AFTER UPDATE ON "public"."travel_logs" FOR EACH ROW WHEN ((("old"."end_time" IS NULL) AND ("new"."end_time" IS NOT NULL))) EXECUTE FUNCTION "public"."trg_travel_logs_soa"();


--
-- Name: cash_pickups trigger_log_cheque_status_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "trigger_log_cheque_status_change" AFTER UPDATE ON "public"."cash_pickups" FOR EACH ROW EXECUTE FUNCTION "public"."log_cheque_status_change"();


--
-- Name: bank_accounts update_bank_accounts_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "update_bank_accounts_timestamp" BEFORE UPDATE ON "public"."bank_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();


--
-- Name: assignments assignments_custodian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_custodian_id_fkey" FOREIGN KEY ("custodian_id") REFERENCES "auth"."users"("id");


--
-- Name: atm_cash_adjustments atm_cash_adjustments_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_cash_adjustments"
    ADD CONSTRAINT "atm_cash_adjustments_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--
-- Name: atm_cash_adjustments atm_cash_adjustments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_cash_adjustments"
    ADD CONSTRAINT "atm_cash_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: atm_cash_adjustments atm_cash_adjustments_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_cash_adjustments"
    ADD CONSTRAINT "atm_cash_adjustments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");


--
-- Name: atm_excess_cash atm_excess_assignment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_excess_cash"
    ADD CONSTRAINT "atm_excess_assignment_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id");


--
-- Name: atm_excess_cash atm_excess_site_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_excess_cash"
    ADD CONSTRAINT "atm_excess_site_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");


--
-- Name: atm_removal_plans atm_removal_plans_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_removal_plans"
    ADD CONSTRAINT "atm_removal_plans_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--
-- Name: atm_replenishments atm_replenishments_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_replenishments"
    ADD CONSTRAINT "atm_replenishments_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--
-- Name: atm_replenishments atm_replenishments_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."atm_replenishments"
    ADD CONSTRAINT "atm_replenishments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");


--
-- Name: bank_accounts bank_accounts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


--
-- Name: bank_denomination_plans bank_denomination_plans_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_denomination_plans"
    ADD CONSTRAINT "bank_denomination_plans_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--
-- Name: bank_denomination_plans bank_denomination_plans_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."bank_denomination_plans"
    ADD CONSTRAINT "bank_denomination_plans_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE CASCADE;


--
-- Name: cash_pickups cash_pickups_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cash_pickups"
    ADD CONSTRAINT "cash_pickups_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--
-- Name: cash_pickups cash_pickups_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cash_pickups"
    ADD CONSTRAINT "cash_pickups_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE SET NULL;


--
-- Name: cash_pickups cash_pickups_source_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cash_pickups"
    ADD CONSTRAINT "cash_pickups_source_site_id_fkey" FOREIGN KEY ("source_site_id") REFERENCES "public"."sites"("id") ON DELETE SET NULL;


--
-- Name: cheque_audit_log cheque_audit_log_pickup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."cheque_audit_log"
    ADD CONSTRAINT "cheque_audit_log_pickup_id_fkey" FOREIGN KEY ("pickup_id") REFERENCES "public"."cash_pickups"("id") ON DELETE CASCADE;


--
-- Name: denomination_plans denomination_plans_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."denomination_plans"
    ADD CONSTRAINT "denomination_plans_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--
-- Name: denomination_plans denomination_plans_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."denomination_plans"
    ADD CONSTRAINT "denomination_plans_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");


--
-- Name: route_sites route_sites_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."route_sites"
    ADD CONSTRAINT "route_sites_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--
-- Name: route_sites route_sites_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."route_sites"
    ADD CONSTRAINT "route_sites_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;


--
-- Name: soa_adjustments soa_adjustments_assignment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."soa_adjustments"
    ADD CONSTRAINT "soa_adjustments_assignment_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE RESTRICT;


--
-- Name: soa_adjustments soa_adjustments_custodian_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."soa_adjustments"
    ADD CONSTRAINT "soa_adjustments_custodian_fk" FOREIGN KEY ("custodian_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;


--
-- Name: soa_adjustments soa_adjustments_soa_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."soa_adjustments"
    ADD CONSTRAINT "soa_adjustments_soa_fk" FOREIGN KEY ("soa_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--
-- Name: soa_ledger soa_ledger_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."soa_ledger"
    ADD CONSTRAINT "soa_ledger_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--
-- Name: soa_ledger soa_ledger_custodian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."soa_ledger"
    ADD CONSTRAINT "soa_ledger_custodian_id_fkey" FOREIGN KEY ("custodian_id") REFERENCES "auth"."users"("id");


--
-- Name: soa_ledger soa_ledger_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."soa_ledger"
    ADD CONSTRAINT "soa_ledger_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");


--
-- Name: soa_postings soa_postings_assignment_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."soa_postings"
    ADD CONSTRAINT "soa_postings_assignment_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE RESTRICT;


--
-- Name: soa_postings soa_postings_custodian_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."soa_postings"
    ADD CONSTRAINT "soa_postings_custodian_fk" FOREIGN KEY ("custodian_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;


--
-- Name: technical_issues technical_issues_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."technical_issues"
    ADD CONSTRAINT "technical_issues_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--
-- Name: technical_issues technical_issues_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."technical_issues"
    ADD CONSTRAINT "technical_issues_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");


--
-- Name: travel_logs travel_logs_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."travel_logs"
    ADD CONSTRAINT "travel_logs_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--
-- Name: travel_logs travel_logs_custodian_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."travel_logs"
    ADD CONSTRAINT "travel_logs_custodian_id_fkey" FOREIGN KEY ("custodian_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: travel_logs travel_logs_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."travel_logs"
    ADD CONSTRAINT "travel_logs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE SET NULL;


--
-- Name: atm_replenishments ATM replenishments visibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ATM replenishments visibility" ON "public"."atm_replenishments" USING ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "atm_replenishments"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "atm_replenishments"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text"))))));


--
-- Name: assignments Admin can create assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can create assignments" ON "public"."assignments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));


--
-- Name: assignments Admin can insert assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can insert assignments" ON "public"."assignments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));


--
-- Name: soa_adjustments Admin can manage SOA adjustments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage SOA adjustments" ON "public"."soa_adjustments" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))))));


--
-- Name: route_sites Admin can manage route sites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage route sites" ON "public"."route_sites" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));


--
-- Name: profiles Admin read all profiles (no recursion); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin read all profiles (no recursion)" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() IS NOT NULL));


--
-- Name: assignments Admin read assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin read assignments" ON "public"."assignments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));


--
-- Name: assignments Admin sees all assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin sees all assignments" ON "public"."assignments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));


--
-- Name: atm_removal_plans Admin/Supervisor can view atm_removal_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin/Supervisor can view atm_removal_plans" ON "public"."atm_removal_plans" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))))));


--
-- Name: assignments Admins can update all assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all assignments" ON "public"."assignments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));


--
-- Name: cash_pickups Cash pickups visibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cash pickups visibility" ON "public"."cash_pickups" USING ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "cash_pickups"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "cash_pickups"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text"))))));


--
-- Name: atm_removal_plans Custodian can manage own atm_removal_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Custodian can manage own atm_removal_plans" ON "public"."atm_removal_plans" USING (("assignment_id" IN ( SELECT "assignments"."id"
   FROM "public"."assignments"
  WHERE ("assignments"."custodian_id" = "auth"."uid"()))));


--
-- Name: assignments Custodian cannot modify approved assignment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Custodian cannot modify approved assignment" ON "public"."assignments" FOR UPDATE USING ((("custodian_id" = "auth"."uid"()) AND ("status" <> 'approved'::"text")));


--
-- Name: assignments Custodian sees own assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Custodian sees own assignments" ON "public"."assignments" FOR SELECT USING (("custodian_id" = "auth"."uid"()));


--
-- Name: denomination_plans Denomination plans by assignment visibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Denomination plans by assignment visibility" ON "public"."denomination_plans" USING ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "denomination_plans"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "denomination_plans"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text"))))));


--
-- Name: sites Sites readable by all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sites readable by all" ON "public"."sites" FOR SELECT USING (true);


--
-- Name: technical_issues Technical issues visibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Technical issues visibility" ON "public"."technical_issues" USING ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "technical_issues"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("a"."id" = "technical_issues"."assignment_id") AND (("a"."custodian_id" = "auth"."uid"()) OR ("p"."role" = 'admin'::"text"))))));


--
-- Name: assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;

--
-- Name: atm_removal_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."atm_removal_plans" ENABLE ROW LEVEL SECURITY;

--
-- Name: atm_replenishments atm_repl_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "atm_repl_authenticated_all" ON "public"."atm_replenishments" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: atm_replenishments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."atm_replenishments" ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."bank_accounts" ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_accounts bank_accounts_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bank_accounts_admin_delete" ON "public"."bank_accounts" FOR DELETE USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));


--
-- Name: bank_accounts bank_accounts_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bank_accounts_admin_insert" ON "public"."bank_accounts" FOR INSERT WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));


--
-- Name: bank_accounts bank_accounts_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bank_accounts_admin_update" ON "public"."bank_accounts" FOR UPDATE USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))) WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));


--
-- Name: bank_accounts bank_accounts_admin_view_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bank_accounts_admin_view_all" ON "public"."bank_accounts" FOR SELECT USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));


--
-- Name: bank_accounts bank_accounts_user_view_active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bank_accounts_user_view_active" ON "public"."bank_accounts" FOR SELECT USING ((("is_active" = true) OR (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))));


--
-- Name: banks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."banks" ENABLE ROW LEVEL SECURITY;

--
-- Name: banks banks_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "banks_authenticated_all" ON "public"."banks" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: cash_pickups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."cash_pickups" ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_pickups cash_pickups_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cash_pickups_authenticated_all" ON "public"."cash_pickups" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: denomination_plans denom_plans_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "denom_plans_authenticated_all" ON "public"."denomination_plans" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: denomination_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."denomination_plans" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles insert_own_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert_own_profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_self_or_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles_self_or_admin_read" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR (("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text")));


--
-- Name: profiles profiles_self_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles_self_read" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));


--
-- Name: profiles read_own_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read_own_profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));


--
-- Name: route_sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."route_sites" ENABLE ROW LEVEL SECURITY;

--
-- Name: route_sites route_sites_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "route_sites_authenticated_all" ON "public"."route_sites" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: sites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."sites" ENABLE ROW LEVEL SECURITY;

--
-- Name: sites sites_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "sites_authenticated_all" ON "public"."sites" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: technical_issues tech_issues_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tech_issues_authenticated_all" ON "public"."technical_issues" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: technical_issues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."technical_issues" ENABLE ROW LEVEL SECURITY;

--
-- Name: travel_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."travel_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: travel_logs travel_logs_authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "travel_logs_authenticated_all" ON "public"."travel_logs" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: profiles update_own_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update_own_profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));


--
-- PostgreSQL database dump complete
--

\unrestrict RrnH2oWmrQKxX7hZojJjTn0A3Pt2K0QC5q9X9HjAhlbHKAJ5VZNXOiQscB49KNl

