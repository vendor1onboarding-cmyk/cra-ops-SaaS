-- ============================================================================
-- Advanced Analytics Views Migration
-- Read-only analytical views for Bank Pickup Trends & ATM Intelligence
-- ZERO impact on transactional flows - analytics only
-- ============================================================================

-- ============================================================================
-- View 1: Bank Pickup Trends
-- Purpose: Track pickup frequency, amounts, and patterns by bank/branch
-- ============================================================================

CREATE OR REPLACE VIEW public.v_bank_pickup_trends AS
SELECT
    bank_name,
    branch,
    COUNT(*) AS pickup_count,
    SUM(total_amount) AS total_pickup_amount,
    AVG(total_amount) AS avg_pickup_amount,
    MAX(total_amount) AS max_pickup,
    MIN(total_amount) AS min_pickup,
    STDDEV(total_amount) AS stddev_pickup,
    DATE_TRUNC('month', pickup_time) AS pickup_month,
    DATE_TRUNC('week', pickup_time) AS pickup_week,
    DATE_TRUNC('day', pickup_time) AS pickup_day
FROM cash_pickups
WHERE pickup_source = 'BANK'
GROUP BY bank_name, branch, 
         DATE_TRUNC('month', pickup_time),
         DATE_TRUNC('week', pickup_time),
         DATE_TRUNC('day', pickup_time);

COMMENT ON VIEW public.v_bank_pickup_trends IS 
'Analytics view for bank pickup trends by time period, bank, and branch';

-- ============================================================================
-- View 2: ATM Load Utilization
-- Purpose: Track load counts and total amounts loaded per ATM site
-- ============================================================================

CREATE OR REPLACE VIEW public.v_atm_load_utilization AS
SELECT
    ar.site_id,
    s.bank_name,
    s.address,
    s.city,
    COUNT(ar.id) AS load_count,
    SUM(
        (COALESCE(ar.denom_2000, 0) * 2000) +
        (COALESCE(ar.denom_500, 0) * 500) +
        (COALESCE(ar.denom_200, 0) * 200) +
        (COALESCE(ar.denom_100, 0) * 100)
    ) AS total_loaded,
    AVG(
        (COALESCE(ar.denom_2000, 0) * 2000) +
        (COALESCE(ar.denom_500, 0) * 500) +
        (COALESCE(ar.denom_200, 0) * 200) +
        (COALESCE(ar.denom_100, 0) * 100)
    ) AS avg_load_amount,
    MAX(ar.time_in) AS last_load_time,
    MIN(ar.time_in) AS first_load_time
FROM atm_replenishments ar
LEFT JOIN sites s ON s.id = ar.site_id
GROUP BY ar.site_id, s.bank_name, s.address, s.city;

COMMENT ON VIEW public.v_atm_load_utilization IS 
'Analytics view for ATM load frequency and volume by site';

-- ============================================================================
-- View 3: Internal Transfer Efficiency
-- Purpose: Measure ATM-to-ATM cash reuse efficiency
-- ============================================================================

-- Note: This view calculates internal transfer efficiency
-- It analyzes cash pickup sources (BANK vs ATM_INTERNAL) per assignment
CREATE OR REPLACE VIEW public.v_internal_transfer_efficiency AS
SELECT
    a.id AS assignment_id,
    a.custodian_id,
    a.assignment_date,
    COALESCE(SUM(cp.total_amount) FILTER (WHERE cp.pickup_source = 'ATM_INTERNAL'), 0) AS internal_used,
    COALESCE(SUM(cp.total_amount) FILTER (WHERE cp.pickup_source = 'BANK'), 0) AS bank_used,
    COALESCE(SUM(cp.total_amount), 0) AS total_loaded,
    ROUND(
        COALESCE(SUM(cp.total_amount) FILTER (WHERE cp.pickup_source = 'ATM_INTERNAL'), 0)::numeric /
        NULLIF(COALESCE(SUM(cp.total_amount), 0), 0) * 100,
        2
    ) AS internal_reuse_percent,
    COUNT(DISTINCT ar.site_id) AS atm_count
FROM assignments a
LEFT JOIN cash_pickups cp ON cp.assignment_id = a.id
LEFT JOIN atm_replenishments ar ON ar.assignment_id = a.id
GROUP BY a.id, a.custodian_id, a.assignment_date;

COMMENT ON VIEW public.v_internal_transfer_efficiency IS 
'Analytics view for measuring internal cash transfer vs bank pickup efficiency';

-- ============================================================================
-- View 4: ATM Cash Recycling Rate
-- Purpose: Shows how effectively ATM removed cash is reused
-- ============================================================================

-- Note: Cash recycling tracks how much ATM-removed cash gets reused in ATM loads
CREATE OR REPLACE VIEW public.v_cash_recycling_rate AS
SELECT
    a.id AS assignment_id,
    a.custodian_id,
    a.assignment_date,
    COALESCE(SUM(cp.total_amount) FILTER (WHERE cp.pickup_source = 'ATM_INTERNAL'), 0) AS atm_removed,
    COALESCE(SUM(
        (COALESCE(ar.denom_2000, 0) * 2000) +
        (COALESCE(ar.denom_500, 0) * 500) +
        (COALESCE(ar.denom_200, 0) * 200) +
        (COALESCE(ar.denom_100, 0) * 100)
    ), 0) AS atm_reused,
    COALESCE(SUM(cp.total_amount) FILTER (WHERE cp.pickup_source = 'BANK'), 0) AS bank_pickup,
    ROUND(
        COALESCE(SUM(
            (COALESCE(ar.denom_2000, 0) * 2000) +
            (COALESCE(ar.denom_500, 0) * 500) +
            (COALESCE(ar.denom_200, 0) * 200) +
            (COALESCE(ar.denom_100, 0) * 100)
        ), 0)::numeric /
        NULLIF(COALESCE(SUM(cp.total_amount) FILTER (WHERE cp.pickup_source = 'ATM_INTERNAL'), 0), 0) * 100,
        2
    ) AS recycling_percent
FROM assignments a
LEFT JOIN cash_pickups cp ON cp.assignment_id = a.id
LEFT JOIN atm_replenishments ar ON ar.assignment_id = a.id
GROUP BY a.id, a.custodian_id, a.assignment_date;

COMMENT ON VIEW public.v_cash_recycling_rate IS 
'Analytics view for ATM cash recycling efficiency';

-- ============================================================================
-- View 5: Cash Variance Analytics
-- Purpose: Detect inconsistencies between expected and actual pickup
-- ============================================================================

CREATE OR REPLACE VIEW public.v_cash_variance_analytics AS
SELECT
    bank_name,
    branch,
    COUNT(*) AS total_pickups,
    COUNT(*) FILTER (WHERE variance <> 0) AS variance_cases,
    COUNT(*) FILTER (WHERE variance > 0) AS positive_variance_cases,
    COUNT(*) FILTER (WHERE variance < 0) AS negative_variance_cases,
    SUM(variance) AS total_variance,
    AVG(variance) AS avg_variance,
    MAX(variance) AS max_variance,
    MIN(variance) AS min_variance,
    ROUND(
        COUNT(*) FILTER (WHERE variance <> 0)::numeric / 
        NULLIF(COUNT(*), 0) * 100, 
        2
    ) AS variance_rate_percent
FROM cash_pickups
WHERE pickup_source = 'BANK'
GROUP BY bank_name, branch;

COMMENT ON VIEW public.v_cash_variance_analytics IS 
'Analytics view for identifying cash variance patterns by bank and branch';

-- ============================================================================
-- View 6: ATM Load Frequency
-- Purpose: Track load frequency patterns over time
-- ============================================================================

CREATE OR REPLACE VIEW public.v_atm_load_frequency AS
SELECT
    site_id,
    COUNT(*) AS loads_performed,
    DATE_TRUNC('month', time_in) AS load_month,
    DATE_TRUNC('week', time_in) AS load_week,
    MIN(time_in) AS first_load,
    MAX(time_in) AS last_load
FROM atm_replenishments
GROUP BY site_id, 
         DATE_TRUNC('month', time_in),
         DATE_TRUNC('week', time_in);

COMMENT ON VIEW public.v_atm_load_frequency IS 
'Analytics view for ATM load frequency patterns';

-- ============================================================================
-- View 7: Cash Flow Intelligence Summary
-- Purpose: Comprehensive cash flow metrics per assignment
-- ============================================================================

CREATE OR REPLACE VIEW public.v_cash_flow_intelligence AS
SELECT
    a.id AS assignment_id,
    a.custodian_id,
    a.assignment_date,
    -- Bank pickup metrics
    COALESCE(SUM(cp.total_amount) FILTER (WHERE cp.pickup_source = 'BANK'), 0) AS total_bank_pickup,
    COUNT(*) FILTER (WHERE cp.pickup_source = 'BANK') AS bank_pickup_count,
    -- ATM removal metrics
    COALESCE(SUM(cp.total_amount) FILTER (WHERE cp.pickup_source = 'ATM_INTERNAL'), 0) AS total_atm_removed,
    COUNT(*) FILTER (WHERE cp.pickup_source = 'ATM_INTERNAL') AS atm_removal_count,
    -- ATM load metrics
    COALESCE(SUM(
        (COALESCE(ar.denom_2000, 0) * 2000) +
        (COALESCE(ar.denom_500, 0) * 500) +
        (COALESCE(ar.denom_200, 0) * 200) +
        (COALESCE(ar.denom_100, 0) * 100)
    ), 0) AS total_atm_loaded,
    COUNT(ar.id) AS atm_load_count,
    -- Cash flow balance
    COALESCE(SUM(cp.total_amount), 0) AS total_cash_collected,
    COALESCE(SUM(
        (COALESCE(ar.denom_2000, 0) * 2000) +
        (COALESCE(ar.denom_500, 0) * 500) +
        (COALESCE(ar.denom_200, 0) * 200) +
        (COALESCE(ar.denom_100, 0) * 100)
    ), 0) AS total_cash_deployed
FROM assignments a
LEFT JOIN cash_pickups cp ON cp.assignment_id = a.id
LEFT JOIN atm_replenishments ar ON ar.assignment_id = a.id
GROUP BY a.id, a.custodian_id, a.assignment_date;

COMMENT ON VIEW public.v_cash_flow_intelligence IS 
'Comprehensive cash flow analytics per assignment';

-- ============================================================================
-- View 8: ATM Performance Score
-- Purpose: Combined performance metrics for each ATM
-- ============================================================================

CREATE OR REPLACE VIEW public.v_atm_performance_score AS
SELECT
    s.id AS site_id,
    s.bank_name,
    s.address,
    s.city,
    -- Load metrics
    COALESCE(COUNT(DISTINCT ar.id), 0) AS total_loads,
    COALESCE(SUM(
        (COALESCE(ar.denom_2000, 0) * 2000) +
        (COALESCE(ar.denom_500, 0) * 500) +
        (COALESCE(ar.denom_200, 0) * 200) +
        (COALESCE(ar.denom_100, 0) * 100)
    ), 0) AS total_loaded_amount,
    -- Cash source analysis (per assignment)
    COALESCE(SUM(
        (SELECT SUM(cp2.total_amount) 
         FROM cash_pickups cp2 
         WHERE cp2.assignment_id = ar.assignment_id 
         AND cp2.pickup_source = 'ATM_INTERNAL')
    ), 0) AS internal_cash_used,
    COALESCE(SUM(
        (SELECT SUM(cp3.total_amount) 
         FROM cash_pickups cp3 
         WHERE cp3.assignment_id = ar.assignment_id 
         AND cp3.pickup_source = 'BANK')
    ), 0) AS bank_cash_used,
    -- Efficiency score
    ROUND(
        COALESCE(SUM(
            (SELECT SUM(cp2.total_amount) 
             FROM cash_pickups cp2 
             WHERE cp2.assignment_id = ar.assignment_id 
             AND cp2.pickup_source = 'ATM_INTERNAL')
        ), 0)::numeric /
        NULLIF(COALESCE(SUM(
            (COALESCE(ar.denom_2000, 0) * 2000) +
            (COALESCE(ar.denom_500, 0) * 500) +
            (COALESCE(ar.denom_200, 0) * 200) +
            (COALESCE(ar.denom_100, 0) * 100)
        ), 0), 0) * 100,
        2
    ) AS efficiency_score
FROM sites s
LEFT JOIN atm_replenishments ar ON ar.site_id = s.id
GROUP BY s.id, s.bank_name, s.address, s.city;

COMMENT ON VIEW public.v_atm_performance_score IS 
'Aggregate performance metrics for each ATM site';

-- ============================================================================
-- View 9: Rolling Average Pickup Trends (Predictive Analytics Support)
-- Purpose: 7-day and 30-day rolling averages for forecasting
-- ============================================================================

CREATE OR REPLACE VIEW public.v_rolling_pickup_trends AS
SELECT
    bank_name,
    branch,
    pickup_time::date AS pickup_date,
    total_amount,
    AVG(total_amount) OVER (
        PARTITION BY bank_name, branch
        ORDER BY pickup_time
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS rolling_avg_7_day,
    AVG(total_amount) OVER (
        PARTITION BY bank_name, branch
        ORDER BY pickup_time
        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
    ) AS rolling_avg_30_day,
    COUNT(*) OVER (
        PARTITION BY bank_name, branch
        ORDER BY pickup_time
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS pickup_count_7_day,
    COUNT(*) OVER (
        PARTITION BY bank_name, branch
        ORDER BY pickup_time
        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
    ) AS pickup_count_30_day
FROM cash_pickups
WHERE pickup_source = 'BANK'
ORDER BY bank_name, branch, pickup_time DESC;

COMMENT ON VIEW public.v_rolling_pickup_trends IS 
'Rolling averages for predictive analytics and forecasting';

-- ============================================================================
-- View 10: Risk Indicators & Alerts
-- Purpose: Identify high-variance branches and overloaded ATMs
-- ============================================================================

CREATE OR REPLACE VIEW public.v_cash_risk_indicators AS
SELECT
    'HIGH_VARIANCE_BRANCH' AS risk_type,
    bank_name,
    branch AS identifier,
    NULL::bigint AS site_id,
    total_variance AS risk_value,
    variance_rate_percent AS risk_percent,
    'Variance rate exceeds threshold' AS risk_description
FROM v_cash_variance_analytics
WHERE variance_rate_percent > 10 -- Threshold: 10% variance rate

UNION ALL

SELECT
    'ATM_OVERLOAD' AS risk_type,
    bank_name,
    address AS identifier,
    site_id,
    load_count AS risk_value,
    NULL::numeric AS risk_percent,
    'Load frequency exceeds 15 per month' AS risk_description
FROM v_atm_load_utilization
WHERE load_count > 15 -- Threshold: >15 loads suggests overload

UNION ALL

SELECT
    'LOW_CASH_RECYCLING' AS risk_type,
    NULL AS bank_name,
    assignment_id::text AS identifier,
    NULL::bigint AS site_id,
    internal_used AS risk_value,
    internal_reuse_percent AS risk_percent,
    'Internal cash reuse below 20%' AS risk_description
FROM v_internal_transfer_efficiency
WHERE internal_reuse_percent < 20 AND total_loaded > 10000; -- Threshold: <20% reuse

COMMENT ON VIEW public.v_cash_risk_indicators IS 
'Automated risk detection for high variance, overload, and low efficiency';

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT SELECT ON TABLE public.v_bank_pickup_trends TO authenticated;
GRANT SELECT ON TABLE public.v_atm_load_utilization TO authenticated;
GRANT SELECT ON TABLE public.v_internal_transfer_efficiency TO authenticated;
GRANT SELECT ON TABLE public.v_cash_recycling_rate TO authenticated;
GRANT SELECT ON TABLE public.v_cash_variance_analytics TO authenticated;
GRANT SELECT ON TABLE public.v_atm_load_frequency TO authenticated;
GRANT SELECT ON TABLE public.v_cash_flow_intelligence TO authenticated;
GRANT SELECT ON TABLE public.v_atm_performance_score TO authenticated;
GRANT SELECT ON TABLE public.v_rolling_pickup_trends TO authenticated;
GRANT SELECT ON TABLE public.v_cash_risk_indicators TO authenticated;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- ✅ STEP 1: Verify all 10 views were created successfully
-- Run this query to check that all analytics views exist:
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
-- Expected: 10 rows returned

-- ✅ STEP 2: Quick count check for each view
-- Uncomment and run these ONE AT A TIME to test each view:

/*
-- Test view 1: Bank Pickup Trends
SELECT COUNT(*) as total_rows FROM public.v_bank_pickup_trends;

-- Test view 2: ATM Load Utilization
SELECT COUNT(*) as total_rows FROM public.v_atm_load_utilization;

-- Test view 3: Internal Transfer Efficiency
SELECT COUNT(*) as total_rows FROM public.v_internal_transfer_efficiency;

-- Test view 4: Cash Recycling Rate
SELECT COUNT(*) as total_rows FROM public.v_cash_recycling_rate;

-- Test view 5: Variance Analytics
SELECT COUNT(*) as total_rows FROM public.v_cash_variance_analytics;

-- Test view 6: ATM Load Frequency
SELECT COUNT(*) as total_rows FROM public.v_atm_load_frequency;

-- Test view 7: Cash Flow Intelligence
SELECT COUNT(*) as total_rows FROM public.v_cash_flow_intelligence;

-- Test view 8: ATM Performance Score
SELECT COUNT(*) as total_rows FROM public.v_atm_performance_score;

-- Test view 9: Rolling Pickup Trends
SELECT COUNT(*) as total_rows FROM public.v_rolling_pickup_trends;

-- Test view 10: Risk Indicators
SELECT COUNT(*) as total_rows FROM public.v_cash_risk_indicators;
*/

-- ✅ STEP 3: Sample data from each view (optional)
-- Uncomment to see actual data:

/*
-- Sample: Bank Pickup Trends (recent 3 months)
SELECT * FROM public.v_bank_pickup_trends 
WHERE pickup_month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
ORDER BY pickup_month DESC, total_pickup_amount DESC
LIMIT 20;

-- Sample: Top 10 ATMs by load volume
SELECT * FROM public.v_atm_load_utilization
ORDER BY total_loaded DESC
LIMIT 10;

-- Sample: Internal transfer efficiency
SELECT * FROM public.v_internal_transfer_efficiency
WHERE total_loaded > 0
ORDER BY internal_reuse_percent DESC
LIMIT 20;

-- Sample: Cash recycling rate
SELECT * FROM public.v_cash_recycling_rate
WHERE atm_removed > 0
ORDER BY recycling_percent DESC
LIMIT 20;

-- Sample: Variance analytics
SELECT * FROM public.v_cash_variance_analytics
WHERE variance_cases > 0
ORDER BY variance_rate_percent DESC
LIMIT 20;

-- Sample: ATM load frequency (current month)
SELECT * FROM public.v_atm_load_frequency
WHERE load_month = DATE_TRUNC('month', CURRENT_DATE)
ORDER BY loads_performed DESC
LIMIT 20;

-- Sample: Cash flow intelligence
SELECT * FROM public.v_cash_flow_intelligence
ORDER BY assignment_date DESC
LIMIT 20;

-- Sample: ATM performance score
SELECT * FROM public.v_atm_performance_score
WHERE total_loads > 0
ORDER BY efficiency_score DESC
LIMIT 20;

-- Sample: Rolling pickup trends (last 30 days)
SELECT * FROM public.v_rolling_pickup_trends
WHERE pickup_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY pickup_date DESC
LIMIT 50;

-- Sample: Risk indicators
SELECT * FROM public.v_cash_risk_indicators
ORDER BY risk_type, risk_value DESC
LIMIT 50;
*/
