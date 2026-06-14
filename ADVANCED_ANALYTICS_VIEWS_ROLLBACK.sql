-- ============================================================================
-- Advanced Analytics Enhancement - ROLLBACK SCRIPT
-- Use this to remove all analytics views if needed
-- SAFE: Does not affect any transactional data or business logic
-- ============================================================================

-- Drop all analytics views in reverse dependency order
DROP VIEW IF EXISTS public.v_cash_risk_indicators CASCADE;
DROP VIEW IF EXISTS public.v_rolling_pickup_trends CASCADE;
DROP VIEW IF EXISTS public.v_atm_performance_score CASCADE;
DROP VIEW IF EXISTS public.v_cash_flow_intelligence CASCADE;
DROP VIEW IF EXISTS public.v_atm_load_frequency CASCADE;
DROP VIEW IF EXISTS public.v_cash_variance_analytics CASCADE;
DROP VIEW IF EXISTS public.v_cash_recycling_rate CASCADE;
DROP VIEW IF EXISTS public.v_internal_transfer_efficiency CASCADE;
DROP VIEW IF EXISTS public.v_atm_load_utilization CASCADE;
DROP VIEW IF EXISTS public.v_bank_pickup_trends CASCADE;

-- Verification: Check that all views are removed
SELECT 
    schemaname,
    viewname
FROM pg_views 
WHERE schemaname = 'public' 
AND viewname IN (
    'v_bank_pickup_trends',
    'v_atm_load_utilization',
    'v_internal_transfer_efficiency',
    'v_cash_recycling_rate',
    'v_cash_variance_analytics',
    'v_atm_load_frequency',
    'v_cash_flow_intelligence',
    'v_atm_performance_score',
    'v_rolling_pickup_trends',
    'v_cash_risk_indicators'
)
ORDER BY viewname;
-- Expected: 0 rows if rollback successful
-- To restore: Run ADVANCED_ANALYTICS_VIEWS_MIGRATION.sql

-- ============================================================================
-- NOTES:
-- - This script is SAFE - it only removes views, not data
-- - All transactional tables remain unchanged
-- - Existing business logic is unaffected
-- - Frontend will gracefully handle missing data (shows empty states)
-- - To re-enable: Simply run the migration script again
-- ============================================================================
