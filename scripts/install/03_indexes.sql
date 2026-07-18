-- ---------------------------------------------------------------------------
-- INDEX: assignments_unique_custodian_date
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE UNIQUE INDEX IF NOT EXISTS "assignments_unique_custodian_date" ON "public"."assignments" USING "btree" ("custodian_id", "assignment_date");


--

-- ---------------------------------------------------------------------------
-- INDEX: bank_accounts_account_number_idx
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "bank_accounts_account_number_idx" ON "public"."bank_accounts" USING "btree" ("account_number");


--

-- ---------------------------------------------------------------------------
-- INDEX: bank_accounts_bank_name_idx
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "bank_accounts_bank_name_idx" ON "public"."bank_accounts" USING "btree" ("bank_name");


--

-- ---------------------------------------------------------------------------
-- INDEX: bank_accounts_created_at_idx
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "bank_accounts_created_at_idx" ON "public"."bank_accounts" USING "btree" ("created_at");


--

-- ---------------------------------------------------------------------------
-- INDEX: bank_accounts_created_by_idx
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "bank_accounts_created_by_idx" ON "public"."bank_accounts" USING "btree" ("created_by");


--

-- ---------------------------------------------------------------------------
-- INDEX: bank_accounts_is_active_idx
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "bank_accounts_is_active_idx" ON "public"."bank_accounts" USING "btree" ("is_active");


--

-- ---------------------------------------------------------------------------
-- INDEX: bank_denomination_plans_unique
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE UNIQUE INDEX IF NOT EXISTS "bank_denomination_plans_unique" ON "public"."bank_denomination_plans" USING "btree" ("assignment_id", "bank_account_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: cash_pickups_bank_account_id_idx
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "cash_pickups_bank_account_id_idx" ON "public"."cash_pickups" USING "btree" ("bank_account_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_assignments_custodian
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_assignments_custodian" ON "public"."assignments" USING "btree" ("custodian_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_assignments_date
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_assignments_date" ON "public"."assignments" USING "btree" ("assignment_date");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_atm_repl_assignment
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_atm_repl_assignment" ON "public"."atm_replenishments" USING "btree" ("assignment_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_atm_repl_site
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_atm_repl_site" ON "public"."atm_replenishments" USING "btree" ("site_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_atm_replenishments_source_breakdown
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_atm_replenishments_source_breakdown" ON "public"."atm_replenishments" USING "gin" ("source_breakdown") WHERE ("source_breakdown" IS NOT NULL);


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_cash_pickups_assignment
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_cash_pickups_assignment" ON "public"."cash_pickups" USING "btree" ("assignment_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_cash_pickups_assignment_time
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_cash_pickups_assignment_time" ON "public"."cash_pickups" USING "btree" ("assignment_id", "pickup_time");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_cash_pickups_internal_source
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_cash_pickups_internal_source" ON "public"."cash_pickups" USING "gin" ("internal_source_metadata") WHERE ("internal_source_metadata" IS NOT NULL);


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_cash_pickups_pickup_source
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_cash_pickups_pickup_source" ON "public"."cash_pickups" USING "btree" ("pickup_source");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_cash_pickups_source_site_id
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_cash_pickups_source_site_id" ON "public"."cash_pickups" USING "btree" ("source_site_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_cheque_audit_pickup
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_cheque_audit_pickup" ON "public"."cheque_audit_log" USING "btree" ("pickup_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_cheque_audit_status
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_cheque_audit_status" ON "public"."cheque_audit_log" USING "btree" ("new_status");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_cheque_audit_updated
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_cheque_audit_updated" ON "public"."cheque_audit_log" USING "btree" ("updated_at" DESC);


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_denomination_plans_assignment
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_denomination_plans_assignment" ON "public"."denomination_plans" USING "btree" ("assignment_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_denomination_plans_site
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_denomination_plans_site" ON "public"."denomination_plans" USING "btree" ("site_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_profiles_email
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_profiles_first_login
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_profiles_first_login" ON "public"."profiles" USING "btree" ("first_login") WHERE ("first_login" = true);


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_profiles_mobile_number
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_profiles_mobile_number" ON "public"."profiles" USING "btree" ("mobile_number") WHERE ("mobile_number" IS NOT NULL);


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_profiles_mobile_number_unique
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE UNIQUE INDEX IF NOT EXISTS "idx_profiles_mobile_number_unique" ON "public"."profiles" USING "btree" ("mobile_number") WHERE ("mobile_number" IS NOT NULL);


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_route_sites_assignment
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_route_sites_assignment" ON "public"."route_sites" USING "btree" ("assignment_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_route_sites_site
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_route_sites_site" ON "public"."route_sites" USING "btree" ("site_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_soa_adjustments_assignment_type
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_soa_adjustments_assignment_type" ON "public"."soa_adjustments" USING "btree" ("assignment_id", "adjustment_type");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_soa_adjustments_exchange_metadata
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_soa_adjustments_exchange_metadata" ON "public"."soa_adjustments" USING "gin" ("exchange_metadata");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_soa_adjustments_soa
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_soa_adjustments_soa" ON "public"."soa_adjustments" USING "btree" ("soa_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_soa_adjustments_transfer_metadata
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_soa_adjustments_transfer_metadata" ON "public"."soa_adjustments" USING "gin" ("transfer_metadata");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_soa_adjustments_type
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_soa_adjustments_type" ON "public"."soa_adjustments" USING "btree" ("adjustment_type");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_soa_assignment
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_soa_assignment" ON "public"."soa_ledger" USING "btree" ("assignment_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_soa_custodian
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_soa_custodian" ON "public"."soa_ledger" USING "btree" ("custodian_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_soa_custodian_date
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_soa_custodian_date" ON "public"."soa_postings" USING "btree" ("custodian_id", "assignment_date");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_soa_entry_date
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_soa_entry_date" ON "public"."soa_ledger" USING "btree" ("entry_date");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_soa_posted_at
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_soa_posted_at" ON "public"."soa_postings" USING "btree" ("posted_at");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_tech_issues_assignment
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_tech_issues_assignment" ON "public"."technical_issues" USING "btree" ("assignment_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_tech_issues_site
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_tech_issues_site" ON "public"."technical_issues" USING "btree" ("site_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_travel_logs_assignment
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_travel_logs_assignment" ON "public"."travel_logs" USING "btree" ("assignment_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_travel_logs_custodian
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_travel_logs_custodian" ON "public"."travel_logs" USING "btree" ("custodian_id");


--

-- ---------------------------------------------------------------------------
-- INDEX: idx_travel_logs_start_time
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE INDEX IF NOT EXISTS "idx_travel_logs_start_time" ON "public"."travel_logs" USING "btree" ("start_time");


--

-- ---------------------------------------------------------------------------
-- INDEX: uniq_active_travel_log
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_active_travel_log" ON "public"."travel_logs" USING "btree" ("custodian_id", "assignment_id") WHERE ("status" = 'in_progress'::"text");


--

-- ---------------------------------------------------------------------------
-- INDEX: uniq_soa_assignment
-- Performance index
-- ---------------------------------------------------------------------------
--

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_soa_assignment" ON "public"."soa_postings" USING "btree" ("assignment_id");


--


