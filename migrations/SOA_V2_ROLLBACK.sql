-- ============================================
-- SOA V2 ROLLBACK SCRIPT
-- Emergency rollback for SOA V2 migration
-- ============================================
-- Version: 2.0
-- Date: February 5, 2026
-- Use only if: Critical issues found within 24-48 hours
-- ============================================

-- WARNING: This will remove all EXCHANGE and INTER_SITE_TRANSFER records
-- Backup database before running this script

DO $$
BEGIN
    RAISE NOTICE '=== SOA V2 ROLLBACK START ===';
    RAISE NOTICE 'Timestamp: %', NOW();
    RAISE NOTICE 'WARNING: This will revert all SOA V2 changes';
END $$;

-- ============================================
-- STEP 1: BACKUP CHECK
-- ============================================

DO $$
DECLARE
  v_exchange_count INTEGER;
  v_transfer_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_exchange_count 
  FROM soa_adjustments WHERE adjustment_type = 'EXCHANGE';
  
  SELECT COUNT(*) INTO v_transfer_count 
  FROM soa_adjustments WHERE adjustment_type = 'INTER_SITE_TRANSFER';
  
  IF v_exchange_count > 0 OR v_transfer_count > 0 THEN
    RAISE NOTICE 'Found % EXCHANGE and % INTER_SITE_TRANSFER records', 
      v_exchange_count, v_transfer_count;
    RAISE NOTICE 'These will be DELETED during rollback';
    RAISE NOTICE 'Ensure you have a backup before proceeding';
    
    -- Uncomment to prevent accidental execution
    -- RAISE EXCEPTION 'Rollback aborted for safety. Remove this check to proceed.';
  END IF;
END $$;

-- ============================================
-- STEP 2: DROP NEW VIEWS
-- ============================================

DROP VIEW IF EXISTS v_soa_detailed CASCADE;
DROP FUNCTION IF EXISTS calculate_closing_balance(UUID);

RAISE NOTICE 'New views and functions dropped ✓';

-- ============================================
-- STEP 3: REMOVE NEW DATA
-- ============================================

-- Delete EXCHANGE adjustments
DELETE FROM soa_adjustments WHERE adjustment_type = 'EXCHANGE';

-- Delete INTER_SITE_TRANSFER adjustments
DELETE FROM soa_adjustments WHERE adjustment_type = 'INTER_SITE_TRANSFER';

RAISE NOTICE 'New adjustment types removed ✓';

-- ============================================
-- STEP 4: DROP NEW INDEXES
-- ============================================

DROP INDEX IF EXISTS idx_soa_adjustments_type;
DROP INDEX IF EXISTS idx_soa_adjustments_exchange_metadata;
DROP INDEX IF EXISTS idx_soa_adjustments_transfer_metadata;
DROP INDEX IF EXISTS idx_soa_adjustments_assignment_type;

RAISE NOTICE 'New indexes dropped ✓';

-- ============================================
-- STEP 5: REVERT CONSTRAINT
-- ============================================

ALTER TABLE soa_adjustments
DROP CONSTRAINT IF EXISTS soa_adjustments_adjustment_type_check;

ALTER TABLE soa_adjustments
ADD CONSTRAINT soa_adjustments_adjustment_type_check
CHECK (adjustment_type IN ('CREDIT', 'DEBIT'));

RAISE NOTICE 'Constraint reverted to original ✓';

-- ============================================
-- STEP 6: DROP NEW COLUMNS
-- ============================================

ALTER TABLE soa_adjustments
DROP COLUMN IF EXISTS exchange_metadata,
DROP COLUMN IF EXISTS transfer_metadata;

RAISE NOTICE 'New columns removed ✓';

-- ============================================
-- STEP 7: VERIFY ROLLBACK
-- ============================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verify v_soa_effective still works
  SELECT COUNT(*) INTO v_count FROM v_soa_effective LIMIT 1;
  RAISE NOTICE 'v_soa_effective verified ✓';
  
  -- Verify constraint
  SELECT COUNT(*) INTO v_count 
  FROM information_schema.check_constraints
  WHERE constraint_name = 'soa_adjustments_adjustment_type_check'
  AND check_clause LIKE '%CREDIT%DEBIT%'
  AND check_clause NOT LIKE '%EXCHANGE%';
  
  IF v_count > 0 THEN
    RAISE NOTICE 'Constraint rollback verified ✓';
  ELSE
    RAISE WARNING 'Constraint rollback verification failed';
  END IF;
END $$;

-- ============================================
-- ROLLBACK COMPLETE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== ROLLBACK SUMMARY ===';
  RAISE NOTICE 'Timestamp: %', NOW();
  RAISE NOTICE 'Status: SUCCESS ✓';
  RAISE NOTICE '';
  RAISE NOTICE 'Reverted:';
  RAISE NOTICE '  - Dropped v_soa_detailed view';
  RAISE NOTICE '  - Removed EXCHANGE records';
  RAISE NOTICE '  - Removed INTER_SITE_TRANSFER records';
  RAISE NOTICE '  - Dropped new indexes';
  RAISE NOTICE '  - Reverted adjustment_type constraint';
  RAISE NOTICE '  - Removed metadata columns';
  RAISE NOTICE '';
  RAISE NOTICE 'System restored to pre-migration state';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Redeploy previous application version';
  RAISE NOTICE '2. Verify existing functionality works';
  RAISE NOTICE '3. Investigate root cause of issues';
  RAISE NOTICE '4. Plan corrective migration';
  RAISE NOTICE '';
  RAISE NOTICE '=== SOA V2 ROLLBACK COMPLETE ===';
END $$;
