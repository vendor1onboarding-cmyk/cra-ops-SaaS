-- ---------------------------------------------------------------------------
-- TABLE: assignments
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: assignments_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."assignments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: assignments_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."assignments_id_seq" OWNED BY "public"."assignments"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: atm_cash_adjustments
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: atm_cash_adjustments_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."atm_cash_adjustments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: atm_cash_adjustments_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."atm_cash_adjustments_id_seq" OWNED BY "public"."atm_cash_adjustments"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: atm_excess_cash
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: atm_excess_cash_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."atm_excess_cash_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: atm_excess_cash_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."atm_excess_cash_id_seq" OWNED BY "public"."atm_excess_cash"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: atm_removal_plans
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- TABLE: atm_replenishments
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMMENT: COLUMN "atm_replenishments"."source_breakdown"
-- Table or column comment
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: atm_replenishments_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."atm_replenishments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: atm_replenishments_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."atm_replenishments_id_seq" OWNED BY "public"."atm_replenishments"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: audit_logs
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: audit_logs_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: audit_logs_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."audit_logs_id_seq" OWNED BY "public"."audit_logs"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: bank_accounts
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- TABLE: bank_denomination_plans
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: bank_denomination_plans_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."bank_denomination_plans_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: bank_denomination_plans_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."bank_denomination_plans_id_seq" OWNED BY "public"."bank_denomination_plans"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: banks
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: banks_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."banks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: banks_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."banks_id_seq" OWNED BY "public"."banks"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: cash_pickups
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMMENT: COLUMN "cash_pickups"."internal_source_metadata"
-- Table or column comment
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: cash_pickups_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."cash_pickups_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: cash_pickups_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."cash_pickups_id_seq" OWNED BY "public"."cash_pickups"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: cheque_audit_log
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: cheque_audit_log_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."cheque_audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: cheque_audit_log_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."cheque_audit_log_id_seq" OWNED BY "public"."cheque_audit_log"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: denomination_plans
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: denomination_plans_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."denomination_plans_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: denomination_plans_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."denomination_plans_id_seq" OWNED BY "public"."denomination_plans"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: profiles
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMMENT: COLUMN "profiles"."deleted_at"
-- Table or column comment
-- ---------------------------------------------------------------------------
--

COMMENT ON COLUMN "public"."profiles"."deleted_at" IS 'Timestamp when user was deleted (soft delete)';


--

-- ---------------------------------------------------------------------------
-- COMMENT: COLUMN "profiles"."deleted_by"
-- Table or column comment
-- ---------------------------------------------------------------------------
--

COMMENT ON COLUMN "public"."profiles"."deleted_by" IS 'User ID of admin who deleted this user';


--

-- ---------------------------------------------------------------------------
-- COMMENT: COLUMN "profiles"."deletion_reason"
-- Table or column comment
-- ---------------------------------------------------------------------------
--

COMMENT ON COLUMN "public"."profiles"."deletion_reason" IS 'Reason for user deletion (provided by admin)';


--

-- ---------------------------------------------------------------------------
-- TABLE: route_sites
-- Base relation
-- ---------------------------------------------------------------------------
--

CREATE TABLE "public"."route_sites" (
    "id" bigint NOT NULL,
    "assignment_id" bigint NOT NULL,
    "site_id" bigint NOT NULL,
    "sequence_no" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--

-- ---------------------------------------------------------------------------
-- SEQUENCE: route_sites_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."route_sites_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: route_sites_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."route_sites_id_seq" OWNED BY "public"."route_sites"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: sites
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: sites_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."sites_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: sites_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."sites_id_seq" OWNED BY "public"."sites"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: soa_adjustments
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMMENT: COLUMN "soa_adjustments"."exchange_metadata"
-- Table or column comment
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMMENT: COLUMN "soa_adjustments"."transfer_metadata"
-- Table or column comment
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: soa_adjustments_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."soa_adjustments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: soa_adjustments_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."soa_adjustments_id_seq" OWNED BY "public"."soa_adjustments"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: soa_ledger
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: soa_ledger_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."soa_ledger_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: soa_ledger_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."soa_ledger_id_seq" OWNED BY "public"."soa_ledger"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: soa_postings
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: soa_postings_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."soa_postings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: soa_postings_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."soa_postings_id_seq" OWNED BY "public"."soa_postings"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: system_settings
-- Base relation
-- ---------------------------------------------------------------------------
--

CREATE TABLE "public"."system_settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--

-- ---------------------------------------------------------------------------
-- TABLE: technical_issues
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: technical_issues_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."technical_issues_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: technical_issues_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."technical_issues_id_seq" OWNED BY "public"."technical_issues"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: travel_logs
-- Base relation
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- SEQUENCE: travel_logs_id_seq
-- Identity sequence
-- ---------------------------------------------------------------------------
--

CREATE SEQUENCE "public"."travel_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--

-- ---------------------------------------------------------------------------
-- SEQUENCE OWNERSHIP: travel_logs_id_seq
-- Bind sequence to table column
-- ---------------------------------------------------------------------------
--

ALTER SEQUENCE "public"."travel_logs_id_seq" OWNED BY "public"."travel_logs"."id";


--

-- ---------------------------------------------------------------------------
-- TABLE: vehicle_rates
-- Base relation
-- ---------------------------------------------------------------------------
--

CREATE TABLE "public"."vehicle_rates" (
    "vehicle_type" "text" NOT NULL,
    "rate_per_km" numeric NOT NULL,
    "active" boolean DEFAULT true
);


--

-- ---------------------------------------------------------------------------
-- DEFAULT: assignments id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."assignments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."assignments_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: atm_cash_adjustments id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_cash_adjustments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."atm_cash_adjustments_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: atm_excess_cash id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_excess_cash" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."atm_excess_cash_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: atm_replenishments id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_replenishments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."atm_replenishments_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: audit_logs id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."audit_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_logs_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: bank_denomination_plans id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."bank_denomination_plans" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bank_denomination_plans_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: banks id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."banks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."banks_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: cash_pickups id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."cash_pickups" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cash_pickups_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: cheque_audit_log id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."cheque_audit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cheque_audit_log_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: denomination_plans id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."denomination_plans" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."denomination_plans_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: route_sites id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."route_sites" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."route_sites_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: sites id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."sites" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sites_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: soa_adjustments id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."soa_adjustments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."soa_adjustments_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: soa_ledger id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."soa_ledger" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."soa_ledger_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: soa_postings id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."soa_postings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."soa_postings_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: technical_issues id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."technical_issues" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."technical_issues_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- DEFAULT: travel_logs id
-- Column default value
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."travel_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."travel_logs_id_seq"'::"regclass");


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: assignments assignments_custodian_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_custodian_id_fkey" FOREIGN KEY ("custodian_id") REFERENCES "auth"."users"("id");


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: atm_cash_adjustments atm_cash_adjustments_assignment_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_cash_adjustments"
    ADD CONSTRAINT "atm_cash_adjustments_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: atm_cash_adjustments atm_cash_adjustments_created_by_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_cash_adjustments"
    ADD CONSTRAINT "atm_cash_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: atm_cash_adjustments atm_cash_adjustments_site_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_cash_adjustments"
    ADD CONSTRAINT "atm_cash_adjustments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: atm_excess_cash atm_excess_assignment_fk
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_excess_cash"
    ADD CONSTRAINT "atm_excess_assignment_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id");


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: atm_excess_cash atm_excess_site_fk
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_excess_cash"
    ADD CONSTRAINT "atm_excess_site_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: atm_removal_plans atm_removal_plans_assignment_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_removal_plans"
    ADD CONSTRAINT "atm_removal_plans_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: atm_replenishments atm_replenishments_assignment_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_replenishments"
    ADD CONSTRAINT "atm_replenishments_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: atm_replenishments atm_replenishments_site_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_replenishments"
    ADD CONSTRAINT "atm_replenishments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: bank_accounts bank_accounts_created_by_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: bank_denomination_plans bank_denomination_plans_assignment_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."bank_denomination_plans"
    ADD CONSTRAINT "bank_denomination_plans_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: bank_denomination_plans bank_denomination_plans_bank_account_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."bank_denomination_plans"
    ADD CONSTRAINT "bank_denomination_plans_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE CASCADE;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: cash_pickups cash_pickups_assignment_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."cash_pickups"
    ADD CONSTRAINT "cash_pickups_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: cash_pickups cash_pickups_bank_account_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."cash_pickups"
    ADD CONSTRAINT "cash_pickups_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE SET NULL;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: cash_pickups cash_pickups_source_site_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."cash_pickups"
    ADD CONSTRAINT "cash_pickups_source_site_id_fkey" FOREIGN KEY ("source_site_id") REFERENCES "public"."sites"("id") ON DELETE SET NULL;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: cheque_audit_log cheque_audit_log_pickup_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."cheque_audit_log"
    ADD CONSTRAINT "cheque_audit_log_pickup_id_fkey" FOREIGN KEY ("pickup_id") REFERENCES "public"."cash_pickups"("id") ON DELETE CASCADE;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: denomination_plans denomination_plans_assignment_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."denomination_plans"
    ADD CONSTRAINT "denomination_plans_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: denomination_plans denomination_plans_site_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."denomination_plans"
    ADD CONSTRAINT "denomination_plans_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: profiles profiles_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: route_sites route_sites_assignment_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."route_sites"
    ADD CONSTRAINT "route_sites_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: route_sites route_sites_site_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."route_sites"
    ADD CONSTRAINT "route_sites_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: soa_adjustments soa_adjustments_assignment_fk
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."soa_adjustments"
    ADD CONSTRAINT "soa_adjustments_assignment_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE RESTRICT;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: soa_adjustments soa_adjustments_custodian_fk
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."soa_adjustments"
    ADD CONSTRAINT "soa_adjustments_custodian_fk" FOREIGN KEY ("custodian_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: soa_adjustments soa_adjustments_soa_fk
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."soa_adjustments"
    ADD CONSTRAINT "soa_adjustments_soa_fk" FOREIGN KEY ("soa_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: soa_ledger soa_ledger_assignment_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."soa_ledger"
    ADD CONSTRAINT "soa_ledger_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: soa_ledger soa_ledger_custodian_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."soa_ledger"
    ADD CONSTRAINT "soa_ledger_custodian_id_fkey" FOREIGN KEY ("custodian_id") REFERENCES "auth"."users"("id");


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: soa_ledger soa_ledger_site_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."soa_ledger"
    ADD CONSTRAINT "soa_ledger_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: soa_postings soa_postings_assignment_fk
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."soa_postings"
    ADD CONSTRAINT "soa_postings_assignment_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE RESTRICT;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: soa_postings soa_postings_custodian_fk
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."soa_postings"
    ADD CONSTRAINT "soa_postings_custodian_fk" FOREIGN KEY ("custodian_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: technical_issues technical_issues_assignment_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."technical_issues"
    ADD CONSTRAINT "technical_issues_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: technical_issues technical_issues_site_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."technical_issues"
    ADD CONSTRAINT "technical_issues_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: travel_logs travel_logs_assignment_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."travel_logs"
    ADD CONSTRAINT "travel_logs_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: travel_logs travel_logs_custodian_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."travel_logs"
    ADD CONSTRAINT "travel_logs_custodian_id_fkey" FOREIGN KEY ("custodian_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--

-- ---------------------------------------------------------------------------
-- FK CONSTRAINT: travel_logs travel_logs_site_id_fkey
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."travel_logs"
    ADD CONSTRAINT "travel_logs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE SET NULL;


--

-- ---------------------------------------------------------------------------
-- ROW SECURITY: assignments
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;

--

-- ---------------------------------------------------------------------------
-- ROW SECURITY: atm_removal_plans
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE "public"."atm_removal_plans" ENABLE ROW LEVEL SECURITY;

--

-- ---------------------------------------------------------------------------
-- ROW SECURITY: atm_replenishments
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE "public"."atm_replenishments" ENABLE ROW LEVEL SECURITY;

--

-- ---------------------------------------------------------------------------
-- ROW SECURITY: bank_accounts
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE "public"."bank_accounts" ENABLE ROW LEVEL SECURITY;

--

-- ---------------------------------------------------------------------------
-- ROW SECURITY: banks
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE "public"."banks" ENABLE ROW LEVEL SECURITY;

--

-- ---------------------------------------------------------------------------
-- ROW SECURITY: cash_pickups
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE "public"."cash_pickups" ENABLE ROW LEVEL SECURITY;

--

-- ---------------------------------------------------------------------------
-- ROW SECURITY: denomination_plans
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE "public"."denomination_plans" ENABLE ROW LEVEL SECURITY;

--

-- ---------------------------------------------------------------------------
-- ROW SECURITY: profiles
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--

-- ---------------------------------------------------------------------------
-- ROW SECURITY: route_sites
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE "public"."route_sites" ENABLE ROW LEVEL SECURITY;

--

-- ---------------------------------------------------------------------------
-- ROW SECURITY: sites
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE "public"."sites" ENABLE ROW LEVEL SECURITY;

--

-- ---------------------------------------------------------------------------
-- ROW SECURITY: technical_issues
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE "public"."technical_issues" ENABLE ROW LEVEL SECURITY;

--

-- ---------------------------------------------------------------------------
-- ROW SECURITY: travel_logs
-- Unclassified object from source dump
-- ---------------------------------------------------------------------------
--

ALTER TABLE "public"."travel_logs" ENABLE ROW LEVEL SECURITY;

--

