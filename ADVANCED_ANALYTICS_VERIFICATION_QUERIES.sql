-- ============================================================================
-- VERIFICATION QUERIES - Run After Migration
-- Use these to verify your analytics views are working correctly
-- ============================================================================

-- ✅ QUERY 1: Check All 10 Views Exist
-- Copy and paste this into Supabase SQL Editor:

SELECT 
    schemaname,
    viewname,
    viewowner
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

-- ✅ Expected Result: 10 rows
-- If you see less than 10, some views didn't create. Check errors.

-- ============================================================================
-- ✅ QUERY 2: Quick Row Counts (Run All Together)
-- ============================================================================

SELECT 'v_bank_pickup_trends' AS view_name, COUNT(*) AS row_count 
FROM public.v_bank_pickup_trends
UNION ALL
SELECT 'v_atm_load_utilization', COUNT(*) 
FROM public.v_atm_load_utilization
UNION ALL
SELECT 'v_internal_transfer_efficiency', COUNT(*) 
FROM public.v_internal_transfer_efficiency
UNION ALL
SELECT 'v_cash_recycling_rate', COUNT(*) 
FROM public.v_cash_recycling_rate
UNION ALL
SELECT 'v_cash_variance_analytics', COUNT(*) 
FROM public.v_cash_variance_analytics
UNION ALL
SELECT 'v_atm_load_frequency', COUNT(*) 
FROM public.v_atm_load_frequency
UNION ALL
SELECT 'v_cash_flow_intelligence', COUNT(*) 
FROM public.v_cash_flow_intelligence
UNION ALL
SELECT 'v_atm_performance_score', COUNT(*) 
FROM public.v_atm_performance_score
UNION ALL
SELECT 'v_rolling_pickup_trends', COUNT(*) 
FROM public.v_rolling_pickup_trends
UNION ALL
SELECT 'v_cash_risk_indicators', COUNT(*) 
FROM public.v_cash_risk_indicators
ORDER BY view_name;

-- ✅ Expected: Each view should have rows (some may be 0 if no data matches filters)

-- ============================================================================
-- ✅ QUERY 3: Sample Data Tests (Run ONE AT A TIME)
-- ============================================================================

-- Test 1: Bank Pickup Trends
SELECT 
    bank_name,
    branch,
    pickup_count,
    total_pickup_amount,
    avg_pickup_amount,
    pickup_month
FROM public.v_bank_pickup_trends 
WHERE pickup_month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
ORDER BY total_pickup_amount DESC
LIMIT 10;

-- Test 2: Top ATMs by Load Volume
SELECT 
    bank_name,
    address,
    load_count,
    total_loaded,
    avg_load_amount
FROM public.v_atm_load_utilization
ORDER BY total_loaded DESC
LIMIT 10;

-- Test 3: Internal Transfer Efficiency
SELECT 
    assignment_date,
    internal_used,
    bank_used,
    total_loaded,
    internal_reuse_percent
FROM public.v_internal_transfer_efficiency
WHERE total_loaded > 0
ORDER BY assignment_date DESC
LIMIT 10;

-- Test 4: Cash Recycling Rate
SELECT 
    assignment_date,
    atm_removed,
    atm_reused,
    bank_pickup,
    recycling_percent
FROM public.v_cash_recycling_rate
WHERE atm_removed > 0
ORDER BY assignment_date DESC
LIMIT 10;

-- Test 5: Variance Analytics
SELECT 
    bank_name,
    branch,
    total_pickups,
    variance_cases,
    total_variance,
    avg_variance,
    variance_rate_percent
FROM public.v_cash_variance_analytics
WHERE variance_cases > 0
ORDER BY variance_rate_percent DESC
LIMIT 10;

-- Test 6: ATM Load Frequency
SELECT 
    site_id,
    loads_performed,
    load_month,
    first_load,
    last_load
FROM public.v_atm_load_frequency
WHERE load_month = DATE_TRUNC('month', CURRENT_DATE)
ORDER BY loads_performed DESC
LIMIT 10;

-- Test 7: Cash Flow Intelligence
SELECT 
    assignment_date,
    total_bank_pickup,
    bank_pickup_count,
    total_atm_removed,
    total_atm_loaded,
    atm_load_count
FROM public.v_cash_flow_intelligence
ORDER BY assignment_date DESC
LIMIT 10;

-- Test 8: ATM Performance Score
SELECT 
    bank_name,
    district,
    total_loads,
    total_loaded_amount,
    internal_cash_used,
    bank_cash_used,
    efficiency_score
FROM public.v_atm_performance_score
WHERE total_loads > 0
ORDER BY efficiency_score DESC
LIMIT 10;

-- Test 9: Rolling Pickup Trends
SELECT 
    bank_name,
    branch,
    pickup_date,
    total_amount,
    rolling_avg_7_day,
    rolling_avg_30_day
FROM public.v_rolling_pickup_trends
WHERE pickup_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY pickup_date DESC
LIMIT 20;

-- Test 10: Risk Indicators
SELECT 
    risk_type,
    bank_name,
    identifier,
    risk_value,
    risk_percent,
    risk_description
FROM public.v_cash_risk_indicators
ORDER BY risk_type, risk_value DESC
LIMIT 20;

-- ============================================================================
-- ✅ QUERY 4: Check Permissions
-- ============================================================================

SELECT 
    schemaname,
    tablename AS viewname,
    array_agg(DISTINCT privilege_type) AS privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND table_name IN (
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
AND grantee = 'authenticated'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- ✅ Expected: Each view should have SELECT privilege for 'authenticated' role

-- ============================================================================
-- 🎉 Success Criteria
-- ============================================================================
-- ✅ Query 1: Returns 10 rows (all views exist)
-- ✅ Query 2: All views return counts (may be 0 for some if no data)
-- ✅ Query 3: Sample queries return data without errors
-- ✅ Query 4: All views have SELECT permission for authenticated role
-- ============================================================================
