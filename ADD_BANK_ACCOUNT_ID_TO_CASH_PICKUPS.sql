-- ============================================================================
-- Add bank_account_id column to cash_pickups table
-- ============================================================================
-- This migration adds the missing bank_account_id foreign key column to the
-- cash_pickups table, enabling integration with the bank_accounts master data.
--
-- ISSUE FIX: Resolves "Could not find the 'bank_account_id' column" error
-- when submitting bank pickup forms.
-- ============================================================================

-- Step 1: Add the bank_account_id column (nullable for backward compatibility)
ALTER TABLE public.cash_pickups
ADD COLUMN IF NOT EXISTS bank_account_id UUID NULL;

-- Step 2: Add foreign key constraint to bank_accounts table
ALTER TABLE public.cash_pickups
DROP CONSTRAINT IF EXISTS cash_pickups_bank_account_id_fkey;

ALTER TABLE public.cash_pickups
ADD CONSTRAINT cash_pickups_bank_account_id_fkey 
FOREIGN KEY (bank_account_id) 
REFERENCES public.bank_accounts(id) 
ON DELETE SET NULL;  -- If bank is deleted, set to NULL instead of cascading delete

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS cash_pickups_bank_account_id_idx 
ON public.cash_pickups(bank_account_id);

-- Step 4: Add unique constraint for upsert operation
-- Prevent duplicate pickups for same assignment + bank account
ALTER TABLE public.cash_pickups
DROP CONSTRAINT IF EXISTS cash_pickups_assignment_bank_unique;

ALTER TABLE public.cash_pickups
ADD CONSTRAINT cash_pickups_assignment_bank_unique 
UNIQUE (assignment_id, bank_account_id);

-- ============================================================================
-- Notes:
-- ============================================================================
-- 1. The column is nullable (NULL) because:
--    - Existing records don't have bank_account_id
--    - Allows gradual migration from manual entry to dropdown
--    - Maintains backward compatibility
--
-- 2. Foreign key uses ON DELETE SET NULL:
--    - If a bank account is deleted, pickups remain but lose the reference
--    - Alternative: ON DELETE RESTRICT would prevent bank deletion
--
-- 3. Unique constraint (assignment_id, bank_account_id):
--    - Enables upsert with onConflict in CashPickup.tsx
--    - One pickup per bank per assignment
--    - Allows multiple pickups from different banks in same assignment
--
-- 4. Index improves query performance when filtering by bank_account_id
--
-- 5. To verify the migration:
/*
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'cash_pickups' 
  AND column_name = 'bank_account_id';
*/

-- ============================================================================
-- Rollback (if needed):
-- ============================================================================
/*
ALTER TABLE public.cash_pickups DROP CONSTRAINT IF EXISTS cash_pickups_assignment_bank_unique;
ALTER TABLE public.cash_pickups DROP CONSTRAINT IF EXISTS cash_pickups_bank_account_id_fkey;
DROP INDEX IF EXISTS cash_pickups_bank_account_id_idx;
ALTER TABLE public.cash_pickups DROP COLUMN IF EXISTS bank_account_id;
*/
