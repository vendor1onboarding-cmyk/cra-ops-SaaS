-- =====================================================
-- User Management Feature - Database Migration
-- =====================================================
-- Purpose: Add email and first_login tracking to profiles
-- Deploy: Run in Supabase SQL Editor before deploying frontend
-- =====================================================

-- 1. Add first_login column (tracks if password reset needed)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_login BOOLEAN DEFAULT true;

-- 2. Add email column (duplicates auth.users.email for quick access)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. Backfill email for existing users
UPDATE public.profiles
SET email = (
  SELECT email 
  FROM auth.users 
  WHERE auth.users.id = profiles.id
)
WHERE email IS NULL;

-- 4. Make email required (after backfill)
ALTER TABLE public.profiles
ALTER COLUMN email SET NOT NULL;

-- 5. Set existing users as not first_login (they already have passwords)
UPDATE public.profiles
SET first_login = false
WHERE first_login IS NULL;

-- 6. Add index for faster first_login queries
CREATE INDEX IF NOT EXISTS idx_profiles_first_login 
ON public.profiles(first_login) 
WHERE first_login = true;

-- 7. Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email 
ON public.profiles(email);

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check migration success
SELECT 
  COUNT(*) as total_profiles,
  COUNT(email) as profiles_with_email,
  COUNT(CASE WHEN first_login = true THEN 1 END) as first_login_users,
  COUNT(CASE WHEN first_login = false THEN 1 END) as regular_users
FROM public.profiles;

-- View sample data
SELECT id, full_name, email, role, first_login 
FROM public.profiles 
LIMIT 5;

-- =====================================================
-- Rollback (if needed)
-- =====================================================

-- CAUTION: Only run if you need to undo the migration
-- COMMENT OUT BEFORE RUNNING MIGRATION

-- DROP INDEX IF EXISTS idx_profiles_first_login;
-- DROP INDEX IF EXISTS idx_profiles_email;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS first_login;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- =====================================================
-- Expected Results
-- =====================================================

-- After migration:
-- ✅ All profiles have email column populated
-- ✅ Existing users: first_login = false
-- ✅ New users (created via UI): first_login = true
-- ✅ Indexes created for performance
-- ✅ No NULL values in email column
-- ✅ No breaking changes to existing data

-- Next Steps:
-- 1. Review verification query results
-- 2. Deploy frontend code with user management components
-- 3. Test user creation flow
-- 4. Test first login password reset flow
-- 5. Test password change flow
