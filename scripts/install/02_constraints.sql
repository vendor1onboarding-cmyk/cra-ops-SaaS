-- ---------------------------------------------------------------------------
-- CONSTRAINT: assignments assignments_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: atm_cash_adjustments atm_cash_adjustments_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_cash_adjustments"
    ADD CONSTRAINT "atm_cash_adjustments_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: atm_excess_cash atm_excess_cash_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_excess_cash"
    ADD CONSTRAINT "atm_excess_cash_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: atm_removal_plans atm_removal_plans_assignment_id_key
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_removal_plans"
    ADD CONSTRAINT "atm_removal_plans_assignment_id_key" UNIQUE ("assignment_id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: atm_removal_plans atm_removal_plans_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_removal_plans"
    ADD CONSTRAINT "atm_removal_plans_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: atm_replenishments atm_replenishments_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."atm_replenishments"
    ADD CONSTRAINT "atm_replenishments_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: audit_logs audit_logs_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: bank_accounts bank_accounts_account_unique
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_account_unique" UNIQUE ("account_number", "ifsc_code");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: bank_accounts bank_accounts_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: bank_denomination_plans bank_denomination_plans_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."bank_denomination_plans"
    ADD CONSTRAINT "bank_denomination_plans_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: banks banks_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."banks"
    ADD CONSTRAINT "banks_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: cash_pickups cash_pickups_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."cash_pickups"
    ADD CONSTRAINT "cash_pickups_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: cheque_audit_log cheque_audit_log_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."cheque_audit_log"
    ADD CONSTRAINT "cheque_audit_log_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: denomination_plans denomination_plans_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."denomination_plans"
    ADD CONSTRAINT "denomination_plans_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: profiles profiles_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: route_sites route_sites_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."route_sites"
    ADD CONSTRAINT "route_sites_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: sites sites_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: sites sites_site_code_key
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_site_code_key" UNIQUE ("site_code");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: soa_adjustments soa_adjustments_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."soa_adjustments"
    ADD CONSTRAINT "soa_adjustments_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: soa_ledger soa_ledger_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."soa_ledger"
    ADD CONSTRAINT "soa_ledger_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: soa_ledger soa_ledger_source_table_source_id_key
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."soa_ledger"
    ADD CONSTRAINT "soa_ledger_source_table_source_id_key" UNIQUE ("source_table", "source_id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: soa_postings soa_postings_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."soa_postings"
    ADD CONSTRAINT "soa_postings_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: system_settings system_settings_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: technical_issues technical_issues_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."technical_issues"
    ADD CONSTRAINT "technical_issues_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: travel_logs travel_logs_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."travel_logs"
    ADD CONSTRAINT "travel_logs_pkey" PRIMARY KEY ("id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: denomination_plans uniq_denom_plan_assignment_site
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."denomination_plans"
    ADD CONSTRAINT "uniq_denom_plan_assignment_site" UNIQUE ("assignment_id", "site_id");


--

-- ---------------------------------------------------------------------------
-- CONSTRAINT: vehicle_rates vehicle_rates_pkey
-- Primary, unique, and foreign key constraint
-- ---------------------------------------------------------------------------
--

ALTER TABLE ONLY "public"."vehicle_rates"
    ADD CONSTRAINT "vehicle_rates_pkey" PRIMARY KEY ("vehicle_type");


--

