-- ============================================
-- UNIFIED ATM LOADING MIGRATION
-- Multi-Source Cash Pickup (Bank + Internal ATM Sites)
-- ============================================
-- Version: 1.0
-- Date: February 8, 2026
-- Author: GitHub Copilot
-- Backward Compatible: YES
-- Estimated Duration: < 2 minutes
-- ============================================

-- PRE-FLIGHT CHECKS
DO $$
BEGIN
    RAISE NOTICE '=== UNIFIED ATM LOADING MIGRATION START ===';
    RAISE NOTICE 'Timestamp: %', NOW();
    RAISE NOTICE 'Database: %', current_database();
    RAISE NOTICE 'User: %', current_user;
END $$;

-- ============================================
-- STEP 1: BACKUP VALIDATION
-- ============================================
-- Before running this migration, ensure you have:
-- 1. Full database backup
-- 2. Tested migration on staging
-- 3. Verified rollback procedure

-- Verify critical tables exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_pickups') THEN
        RAISE EXCEPTION 'Critical table cash_pickups not found. Migration aborted.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'atm_replenishments') THEN
        RAISE EXCEPTION 'Critical table atm_replenishments not found. Migration aborted.';
    END IF;
    
    RAISE NOTICE 'Pre-flight checks passed ✓';
END $$;

-- ============================================
-- STEP 2: EXTEND CASH_PICKUPS TABLE
-- ============================================

-- Add metadata column for internal ATM source tracking
-- This is nullable for backward compatibility with existing bank-only pickups

ALTER TABLE cash_pickups
ADD COLUMN IF NOT EXISTS internal_source_metadata JSONB DEFAULT NULL;

COMMENT ON COLUMN cash_pickups.internal_source_metadata IS 
'JSONB metadata for tracking internal ATM site sources during cash pickup.
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

-- ============================================
-- STEP 3: EXTEND ATM_REPLENISHMENTS TABLE
-- ============================================

-- Add source breakdown column to track bank vs internal ATM sources
ALTER TABLE atm_replenishments
ADD COLUMN IF NOT EXISTS source_breakdown JSONB DEFAULT NULL;

COMMENT ON COLUMN atm_replenishments.source_breakdown IS 
'JSONB breakdown of load sources (bank vs internal ATM).
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

-- ============================================
-- STEP 4: CREATE HELPER VIEW FOR SOA
-- ============================================

-- Drop existing view if exists (for clean recreation)
DROP VIEW IF EXISTS v_atm_load_sources CASCADE;

-- Create view to separate bank-based vs internal ATM loads
CREATE OR REPLACE VIEW v_atm_load_sources AS
SELECT 
    ar.id,
    ar.assignment_id,
    ar.site_id,
    ar.custodian_id,
    ar.time_in,
    
    -- Total load (all denominations)
    COALESCE(ar.denom_100, 0) AS total_denom_100,
    COALESCE(ar.denom_200, 0) AS total_denom_200,
    COALESCE(ar.denom_500, 0) AS total_denom_500,
    COALESCE(ar.denom_2000, 0) AS total_denom_2000,
    
    -- Bank-sourced load (for SOA)
    COALESCE(
        (ar.source_breakdown->'bank_source'->>'denom_100')::int,
        ar.denom_100
    ) AS bank_denom_100,
    COALESCE(
        (ar.source_breakdown->'bank_source'->>'denom_200')::int,
        ar.denom_200
    ) AS bank_denom_200,
    COALESCE(
        (ar.source_breakdown->'bank_source'->>'denom_500')::int,
        ar.denom_500
    ) AS bank_denom_500,
    COALESCE(
        (ar.source_breakdown->'bank_source'->>'denom_2000')::int,
        ar.denom_2000
    ) AS bank_denom_2000,
    
    -- Internal ATM-sourced load (excluded from SOA)
    COALESCE(
        (ar.source_breakdown->'internal_source'->>'denom_100')::int,
        0
    ) AS internal_denom_100,
    COALESCE(
        (ar.source_breakdown->'internal_source'->>'denom_200')::int,
        0
    ) AS internal_denom_200,
    COALESCE(
        (ar.source_breakdown->'internal_source'->>'denom_500')::int,
        0
    ) AS internal_denom_500,
    COALESCE(
        (ar.source_breakdown->'internal_source'->>'denom_2000')::int,
        0
    ) AS internal_denom_2000,
    
    -- Calculated totals
    COALESCE(
        (ar.source_breakdown->'bank_source'->>'total_amount')::numeric,
        COALESCE(ar.denom_100, 0) * 100 +
        COALESCE(ar.denom_200, 0) * 200 +
        COALESCE(ar.denom_500, 0) * 500 +
        COALESCE(ar.denom_2000, 0) * 2000
    ) AS bank_total_amount,
    
    COALESCE(
        (ar.source_breakdown->'internal_source'->>'total_amount')::numeric,
        0
    ) AS internal_total_amount
    
FROM atm_replenishments ar;

COMMENT ON VIEW v_atm_load_sources IS 
'Helper view to separate bank-sourced vs internal ATM-sourced loads.
Use this view for SOA calculations to ensure:
- vendor SOA shows only bank_total_amount
- Internal transfers shown separately
- Backward compatible (NULL source_breakdown = all bank-sourced)
';

-- ============================================
-- STEP 5: CREATE INDEX FOR PERFORMANCE
-- ============================================

-- Index on cash_pickups for internal source queries
CREATE INDEX IF NOT EXISTS idx_cash_pickups_internal_source 
ON cash_pickups USING GIN (internal_source_metadata)
WHERE internal_source_metadata IS NOT NULL;

-- Index on atm_replenishments for source breakdown queries
CREATE INDEX IF NOT EXISTS idx_atm_replenishments_source_breakdown 
ON atm_replenishments USING GIN (source_breakdown)
WHERE source_breakdown IS NOT NULL;

-- ============================================
-- STEP 6: GRANT PERMISSIONS
-- ============================================

-- Ensure authenticated users can query the new view
GRANT SELECT ON v_atm_load_sources TO authenticated;

-- ============================================
-- COMPLETION SUMMARY
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '=== UNIFIED ATM LOADING MIGRATION COMPLETE ===';
    RAISE NOTICE 'Changes applied:';
    RAISE NOTICE '  ✓ Added internal_source_metadata to cash_pickups';
    RAISE NOTICE '  ✓ Added source_breakdown to atm_replenishments';
    RAISE NOTICE '  ✓ Created v_atm_load_sources view';
    RAISE NOTICE '  ✓ Added GIN indexes for JSON queries';
    RAISE NOTICE '  ✓ Backward compatible (existing records unaffected)';
    RAISE NOTICE 'Timestamp: %', NOW();
    RAISE NOTICE '===========================================';
END $$;

-- ============================================
-- ROLLBACK PROCEDURE (IF NEEDED)
-- ============================================
-- To rollback this migration, run:
-- 
-- DROP VIEW IF EXISTS v_atm_load_sources CASCADE;
-- DROP INDEX IF EXISTS idx_cash_pickups_internal_source;
-- DROP INDEX IF EXISTS idx_atm_replenishments_source_breakdown;
-- ALTER TABLE cash_pickups DROP COLUMN IF EXISTS internal_source_metadata;
-- ALTER TABLE atm_replenishments DROP COLUMN IF EXISTS source_breakdown;
