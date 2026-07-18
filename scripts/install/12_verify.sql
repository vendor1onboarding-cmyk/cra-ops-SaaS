-- ============================================================================
-- CRA OPS install kit
-- Installation verification
-- ============================================================================

-- Verify the expected public-schema object counts.
SELECT 'tables' AS object_type, COUNT(*) AS installed FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SELECT 'views' AS object_type, COUNT(*) AS installed FROM information_schema.views WHERE table_schema = 'public';
SELECT 'functions' AS object_type, COUNT(*) AS installed FROM information_schema.routines WHERE routine_schema = 'public';
SELECT 'indexes' AS object_type, COUNT(*) AS installed FROM pg_indexes WHERE schemaname = 'public';
SELECT 'triggers' AS object_type, COUNT(*) AS installed FROM information_schema.triggers WHERE trigger_schema = 'public';
SELECT 'policies' AS object_type, COUNT(*) AS installed FROM pg_policies WHERE schemaname = 'public';

-- Verify the application buckets exist.
SELECT id, name, public FROM storage.buckets WHERE id IN ('issue-photos', 'eod-signatures') ORDER BY id;

-- Fail fast if required core tables are missing.
DO $$
DECLARE
  required_tables text[] := ARRAY['assignments','atm_cash_adjustments','atm_excess_cash','atm_removal_plans','atm_replenishments','audit_logs','bank_accounts','bank_denomination_plans','banks','cash_pickups','cheque_audit_log','denomination_plans','profiles','route_sites','sites','soa_adjustments','soa_ledger','soa_postings','system_settings','technical_issues','travel_logs','vehicle_rates'];
  t text;
BEGIN
  FOREACH t IN ARRAY required_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      RAISE EXCEPTION 'Missing required table: %', t;
    END IF;
  END LOOP;
END
$$;

