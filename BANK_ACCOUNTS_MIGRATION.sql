-- ============================================================================
-- Bank Accounts Master Data - Migration
-- ============================================================================
-- This migration creates the bank_accounts table to enable admin-driven bank
-- master data management and replaces manual bank details entry in Cash Pickup.
-- 
-- Backward Compatibility: Does NOT modify cash_pickups table.
-- Existing records continue to work as-is.
-- ============================================================================

-- Step 1: Create the bank_accounts table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  -- Primary Key
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Bank & Account Details
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  
  -- Branch Details
  branch_code TEXT,
  branch_name TEXT,
  
  -- Contact Information
  branch_phone TEXT,
  branch_email TEXT,
  branch_address TEXT,
  
  -- Status & Audit
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT bank_accounts_account_unique UNIQUE (account_number, ifsc_code),
  CONSTRAINT bank_accounts_bank_name_not_empty CHECK (length(trim(bank_name)) > 0),
  CONSTRAINT bank_accounts_account_not_empty CHECK (length(trim(account_number)) > 0),
  CONSTRAINT bank_accounts_ifsc_not_empty CHECK (length(trim(ifsc_code)) > 0),
  CONSTRAINT bank_accounts_ifsc_format CHECK (ifsc_code ~ '^[A-Z0-9]{11}$')
);

-- Step 2: Create Indexes for Performance
CREATE INDEX IF NOT EXISTS bank_accounts_bank_name_idx 
  ON public.bank_accounts(bank_name);

CREATE INDEX IF NOT EXISTS bank_accounts_account_number_idx 
  ON public.bank_accounts(account_number);

CREATE INDEX IF NOT EXISTS bank_accounts_is_active_idx 
  ON public.bank_accounts(is_active);

CREATE INDEX IF NOT EXISTS bank_accounts_created_by_idx 
  ON public.bank_accounts(created_by);

CREATE INDEX IF NOT EXISTS bank_accounts_created_at_idx 
  ON public.bank_accounts(created_at);

-- Step 3: Enable Row-Level Security
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Step 4: RLS Policies

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS bank_accounts_admin_view_all ON public.bank_accounts;
DROP POLICY IF EXISTS bank_accounts_user_view_active ON public.bank_accounts;
DROP POLICY IF EXISTS bank_accounts_admin_insert ON public.bank_accounts;
DROP POLICY IF EXISTS bank_accounts_admin_update ON public.bank_accounts;
DROP POLICY IF EXISTS bank_accounts_admin_delete ON public.bank_accounts;

-- Policy: Admins/Supervisors can view all banks (active or inactive)
CREATE POLICY bank_accounts_admin_view_all
  ON public.bank_accounts
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'supervisor')
  );

-- Policy: All authenticated users can view active banks (for dropdowns)
CREATE POLICY bank_accounts_user_view_active
  ON public.bank_accounts
  FOR SELECT
  USING (
    is_active = true
    OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'supervisor')
  );

-- Policy: Only admins/supervisors can insert banks
CREATE POLICY bank_accounts_admin_insert
  ON public.bank_accounts
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'supervisor')
  );

-- Policy: Only admins/supervisors can update banks
CREATE POLICY bank_accounts_admin_update
  ON public.bank_accounts
  FOR UPDATE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'supervisor')
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'supervisor')
  );

-- Policy: Only admins/supervisors can delete banks
CREATE POLICY bank_accounts_admin_delete
  ON public.bank_accounts
  FOR DELETE
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'supervisor')
  );

-- Step 5: Create function for auto-updating updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Trigger for auto-updating updated_at timestamp
DROP TRIGGER IF EXISTS update_bank_accounts_timestamp ON public.bank_accounts;

CREATE TRIGGER update_bank_accounts_timestamp
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- Sample Data (Optional - for development/testing)
-- ============================================================================
-- Uncomment and customize with real admin user ID before running:

/*
INSERT INTO public.bank_accounts (
  bank_name, account_number, ifsc_code, branch_code, branch_name, 
  branch_phone, branch_email, branch_address, created_by
) VALUES
(
  'CITY UNION BANK',
  '510909010242049',
  'CIUB0000085',
  '085',
  'Thoothukudi Main',
  '9363311438',
  'info@cityunion.com',
  'VOC Road, Thoothukudi – 628003',
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)
),
(
  'STATE BANK OF INDIA',
  '43251238405',
  'SBIN0000943',
  '943',
  'Beach Road Branch',
  '8925947320',
  'sbi.00943@sbi.co.in',
  '306 Beach Road, Thoothukudi – 628001',
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)
),
(
  'TAMILNAD MERCANTILE BANK',
  '106150050801354',
  'TMBL0000106',
  '106',
  'Thoothukudi South',
  '9876543210',
  'thoothukudi_south@tmbank.in',
  '283 W.G.C Road, Thoothukudi – 628003',
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)
)
ON CONFLICT (account_number, ifsc_code) DO NOTHING;
*/

-- ============================================================================
-- Notes:
-- ============================================================================
-- 1. IFSC Code Validation: Must be exactly 11 characters, uppercase alphanumeric
--    Example: CUB0000085, SBINO000943, TMBL0000106
--
-- 2. Unique Constraint: (account_number + ifsc_code) ensures no duplicates
--    Allows same account number with different IFSC (different branches)
--    Allows same IFSC code with different account numbers (different accounts)
--
-- 3. RLS Security:
--    - Custodians see only active banks (for dropdowns)
--    - Admins see all banks (including inactive for management)
--    - Only admins can insert/update/delete
--
-- 4. Backward Compatibility:
--    - cash_pickups table is NOT modified
--    - Existing bank_name and branch fields remain unchanged
--    - New bank_account_id column is OPTIONAL (future enhancement)
--
-- 5. Rollback:
--    If needed, simply DROP TABLE bank_accounts (will fail if FK constraints exist)
-- ============================================================================

