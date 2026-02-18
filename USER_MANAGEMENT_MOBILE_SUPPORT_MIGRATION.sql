-- =====================================================
-- User Management - Mobile Number Support
-- =====================================================
-- Purpose: Add mobile number as optional login identifier
-- Deploy: Run in Supabase SQL Editor before deploying frontend
-- =====================================================

-- 1. Add mobile_number column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mobile_number TEXT;

-- 2. Add unique index for mobile_number (allow NULL values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_mobile_number_unique 
ON public.profiles(mobile_number) 
WHERE mobile_number IS NOT NULL;

-- 3. Add index for faster mobile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_mobile_number 
ON public.profiles(mobile_number) 
WHERE mobile_number IS NOT NULL;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check migration success
SELECT 
  COUNT(*) as total_profiles,
  COUNT(email) as profiles_with_email,
  COUNT(mobile_number) as profiles_with_mobile,
  COUNT(CASE WHEN mobile_number IS NOT NULL THEN 1 END) as profiles_with_mobile_number
FROM public.profiles;

-- View sample data
SELECT id, full_name, email, mobile_number, role 
FROM public.profiles 
LIMIT 10;

-- =====================================================
-- Rollback (if needed)
-- =====================================================

-- CAUTION: Only run if you need to undo the migration
-- COMMENT OUT BEFORE RUNNING MIGRATION

-- DROP INDEX IF EXISTS idx_profiles_mobile_number_unique;
-- DROP INDEX IF EXISTS idx_profiles_mobile_number;
-- ALTER TABLE public.profiles DROP COLUMN IF NOT EXISTS mobile_number;

-- =====================================================
-- Expected Results
-- =====================================================

-- After migration:
-- ✅ mobile_number column added to profiles
-- ✅ Unique index ensures one profile per mobile number
-- ✅ Null values allowed for backward compatibility
-- ✅ No existing data affected
-- ✅ Ready for frontend user management updates

-- Next Steps:
-- 1. Review verification query results
-- 2. Deploy frontend code with mobile number support
-- 3. Test user creation with email
-- 4. Test user creation with mobile number
-- 5. Test duplicate mobile number validation
