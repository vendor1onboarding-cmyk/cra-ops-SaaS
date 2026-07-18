-- ---------------------------------------------------------------------------
-- TRIGGER: atm_cash_adjustments after_atm_cash_adjustments_insert
-- Data-change trigger
-- ---------------------------------------------------------------------------
--

CREATE TRIGGER "after_atm_cash_adjustments_insert" AFTER INSERT ON "public"."atm_cash_adjustments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_atm_cash_adjustments_soa"();


--

-- ---------------------------------------------------------------------------
-- TRIGGER: atm_excess_cash after_atm_excess_cash_insert
-- Data-change trigger
-- ---------------------------------------------------------------------------
--

CREATE TRIGGER "after_atm_excess_cash_insert" AFTER INSERT ON "public"."atm_excess_cash" FOR EACH ROW EXECUTE FUNCTION "public"."trg_atm_excess_cash_soa"();


--

-- ---------------------------------------------------------------------------
-- TRIGGER: atm_replenishments after_atm_replenishments_insert
-- Data-change trigger
-- ---------------------------------------------------------------------------
--

CREATE TRIGGER "after_atm_replenishments_insert" AFTER INSERT ON "public"."atm_replenishments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_atm_replenishments_soa"();


--

-- ---------------------------------------------------------------------------
-- TRIGGER: soa_adjustments after_soa_adjustment_insert
-- Data-change trigger
-- ---------------------------------------------------------------------------
--

CREATE TRIGGER "after_soa_adjustment_insert" AFTER INSERT ON "public"."soa_adjustments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_soa_adjustment_ledger"();


--

-- ---------------------------------------------------------------------------
-- TRIGGER: travel_logs after_travel_logs_update
-- Data-change trigger
-- ---------------------------------------------------------------------------
--

CREATE TRIGGER "after_travel_logs_update" AFTER UPDATE ON "public"."travel_logs" FOR EACH ROW WHEN ((("old"."end_time" IS NULL) AND ("new"."end_time" IS NOT NULL))) EXECUTE FUNCTION "public"."trg_travel_logs_soa"();


--

-- ---------------------------------------------------------------------------
-- TRIGGER: cash_pickups trigger_log_cheque_status_change
-- Data-change trigger
-- ---------------------------------------------------------------------------
--

CREATE TRIGGER "trigger_log_cheque_status_change" AFTER UPDATE ON "public"."cash_pickups" FOR EACH ROW EXECUTE FUNCTION "public"."log_cheque_status_change"();


--

-- ---------------------------------------------------------------------------
-- TRIGGER: bank_accounts update_bank_accounts_timestamp
-- Data-change trigger
-- ---------------------------------------------------------------------------
--

CREATE TRIGGER "update_bank_accounts_timestamp" BEFORE UPDATE ON "public"."bank_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();


--

