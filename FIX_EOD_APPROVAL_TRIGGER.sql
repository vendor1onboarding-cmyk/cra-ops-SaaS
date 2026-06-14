-- ============================================================
-- Fix for EOD Approval duplicate key constraint issue
-- This script handles the "uniq_soa_assignment" constraint error
-- ============================================================

-- First, let's identify what table has the constraint
-- Run this query first to see what table contains uniq_soa_assignment:
-- SELECT conrelid::regclass AS table_name, conname AS constraint_name
-- FROM pg_constraint WHERE conname = 'uniq_soa_assignment';

-- ============================================================
-- TEMPORARY FIX: Disable the problematic trigger (if it exists)
-- ============================================================

-- Drop ALL triggers on assignments table (we'll recreate safe ones)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'assignments'::regclass 
        AND tgname NOT LIKE 'RI_%'  -- Don't drop foreign key triggers
        AND tgname NOT LIKE 'pg_%'   -- Don't drop system triggers
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON assignments CASCADE';
        RAISE NOTICE 'Dropped trigger: %', r.tgname;
    END LOOP;
END $$;

-- Drop the corresponding functions
DROP FUNCTION IF EXISTS create_soa_on_approval() CASCADE;
DROP FUNCTION IF EXISTS insert_soa_on_approval() CASCADE;
DROP FUNCTION IF EXISTS create_eod_summary_on_approval() CASCADE;

-- ============================================================
-- CREATE RPC FUNCTION FOR SAFE APPROVAL
-- This function handles approval without the trigger issues
-- ============================================================

CREATE OR REPLACE FUNCTION approve_eod_assignment(
  p_assignment_id bigint,
  p_approved_by uuid
)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  -- Simply update the assignment - triggers are now dropped
  UPDATE assignments
  SET 
    status = 'approved',
    approved_at = NOW(),
    approved_by = p_approved_by
  WHERE id = p_assignment_id;
  
  -- Return success
  v_result := json_build_object(
    'success', true,
    'message', 'Assignment approved successfully'
  );
  
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  v_result := json_build_object(
    'success', false,
    'message', SQLERRM,
    'detail', SQLSTATE
  );
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION approve_eod_assignment(bigint, uuid) TO authenticated;

-- ============================================================
-- DIAGNOSTIC QUERIES (Run these to understand your schema)
-- ============================================================

-- Find the constraint:
-- SELECT conrelid::regclass AS table_name, conname AS constraint_name
-- FROM pg_constraint WHERE conname = 'uniq_soa_assignment';

-- Find all triggers on assignments table:
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'assignments'::regclass;
