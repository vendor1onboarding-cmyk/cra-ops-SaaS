-- ============================================
-- UNIFIED ATM LOADING ROLLBACK
-- Reverts Multi-Source Cash Pickup Enhancement
-- ============================================
-- Version: 1.0
-- Date: February 8, 2026
-- Author: GitHub Copilot
-- WARNING: This will remove new columns and views
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '=== UNIFIED ATM LOADING ROLLBACK START ===';
    RAISE NOTICE 'Timestamp: %', NOW();
    RAISE NOTICE 'WARNING: This will remove enhancement features';
END $$;

-- Drop view
DROP VIEW IF EXISTS v_atm_load_sources CASCADE;

-- Drop indexes
DROP INDEX IF EXISTS idx_cash_pickups_internal_source;
DROP INDEX IF EXISTS idx_atm_replenishments_source_breakdown;

-- Remove columns (data will be lost!)
ALTER TABLE cash_pickups DROP COLUMN IF EXISTS internal_source_metadata;
ALTER TABLE atm_replenishments DROP COLUMN IF EXISTS source_breakdown;

DO $$
BEGIN
    RAISE NOTICE '=== UNIFIED ATM LOADING ROLLBACK COMPLETE ===';
    RAISE NOTICE 'All enhancement features removed';
    RAISE NOTICE 'System reverted to bank-only pickup mode';
    RAISE NOTICE 'Timestamp: %', NOW();
END $$;
