-- ---------------------------------------------------------------------------
-- VIEW: v_atm_load_frequency
-- Logical query view
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMMENT: VIEW "v_atm_load_frequency"
-- View comment
-- ---------------------------------------------------------------------------
--

COMMENT ON VIEW "public"."v_atm_load_frequency" IS 'Analytics view for ATM load frequency patterns';


--

-- ---------------------------------------------------------------------------
-- VIEW: v_atm_load_sources
-- Logical query view
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- VIEW: v_atm_load_utilization
-- Logical query view
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMMENT: VIEW "v_atm_load_utilization"
-- View comment
-- ---------------------------------------------------------------------------
--

COMMENT ON VIEW "public"."v_atm_load_utilization" IS 'Analytics view for ATM load frequency and volume by site';


--

-- ---------------------------------------------------------------------------
-- VIEW: v_atm_performance_score
-- Logical query view
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMMENT: VIEW "v_atm_performance_score"
-- View comment
-- ---------------------------------------------------------------------------
--

COMMENT ON VIEW "public"."v_atm_performance_score" IS 'Aggregate performance metrics for each ATM site';


--

-- ---------------------------------------------------------------------------
-- VIEW: v_bank_pickup_trends
-- Logical query view
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMMENT: VIEW "v_bank_pickup_trends"
-- View comment
-- ---------------------------------------------------------------------------
--

COMMENT ON VIEW "public"."v_bank_pickup_trends" IS 'Analytics view for bank pickup trends by time period, bank, and branch';


--

-- ---------------------------------------------------------------------------
-- VIEW: v_cash_flow_intelligence
-- Logical query view
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMMENT: VIEW "v_cash_flow_intelligence"
-- View comment
-- ---------------------------------------------------------------------------
--

COMMENT ON VIEW "public"."v_cash_flow_intelligence" IS 'Comprehensive cash flow analytics per assignment';


--

-- ---------------------------------------------------------------------------
-- VIEW: v_cash_recycling_rate
-- Logical query view
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMMENT: VIEW "v_cash_recycling_rate"
-- View comment
-- ---------------------------------------------------------------------------
--

COMMENT ON VIEW "public"."v_cash_recycling_rate" IS 'Analytics view for ATM cash recycling efficiency';


--

-- ---------------------------------------------------------------------------
-- VIEW: v_cash_variance_analytics
-- Logical query view
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMMENT: VIEW "v_cash_variance_analytics"
-- View comment
-- ---------------------------------------------------------------------------
--

COMMENT ON VIEW "public"."v_cash_variance_analytics" IS 'Analytics view for identifying cash variance patterns by bank and branch';


--

-- ---------------------------------------------------------------------------
-- VIEW: v_internal_transfer_efficiency
-- Logical query view
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMMENT: VIEW "v_internal_transfer_efficiency"
-- View comment
-- ---------------------------------------------------------------------------
--

COMMENT ON VIEW "public"."v_internal_transfer_efficiency" IS 'Analytics view for measuring internal cash transfer vs bank pickup efficiency';


--

-- ---------------------------------------------------------------------------
-- VIEW: v_cash_risk_indicators
-- Logical query view
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMMENT: VIEW "v_cash_risk_indicators"
-- View comment
-- ---------------------------------------------------------------------------
--

COMMENT ON VIEW "public"."v_cash_risk_indicators" IS 'Automated risk detection for high variance, overload, and low efficiency';


--

-- ---------------------------------------------------------------------------
-- VIEW: v_cheque_verifications
-- Logical query view
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- VIEW: v_rolling_pickup_trends
-- Logical query view
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMMENT: VIEW "v_rolling_pickup_trends"
-- View comment
-- ---------------------------------------------------------------------------
--

COMMENT ON VIEW "public"."v_rolling_pickup_trends" IS 'Rolling averages for predictive analytics and forecasting';


--

-- ---------------------------------------------------------------------------
-- VIEW: v_soa_detailed
-- Logical query view
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- VIEW: v_soa_effective
-- Logical query view
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- VIEW: v_soa_kpi_safe
-- Logical query view
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- VIEW: v_statement_of_accounts
-- Logical query view
-- ---------------------------------------------------------------------------
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

