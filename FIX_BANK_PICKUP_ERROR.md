# Fix: Bank Pickup Form Error - Missing bank_account_id Column

## Problem
Bank Pickup form fails with error:
```
POST /rest/v1/cash_pickups?on_conflict=assignment_id%2Cbank_account_id 400 (Bad Request)
{code: 'PGRST204', message: "Could not find the 'bank_account_id' column of 'cash_pickups' in the schema cache"}
```

## Root Cause
The code in `src/pages/CashPickup.tsx` is trying to insert/upsert records with `bank_account_id` column, but this column doesn't exist in the `cash_pickups` table. The original `BANK_ACCOUNTS_MIGRATION.sql` created the `bank_accounts` table but didn't add the foreign key to `cash_pickups`.

## Solution
Run the migration file: `ADD_BANK_ACCOUNT_ID_TO_CASH_PICKUPS.sql`

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `ADD_BANK_ACCOUNT_ID_TO_CASH_PICKUPS.sql`
5. Click **Run** or press `Ctrl+Enter`
6. Verify success message

### Option 2: Via Supabase CLI
```powershell
# Execute the migration file
supabase db execute --file ADD_BANK_ACCOUNT_ID_TO_CASH_PICKUPS.sql

# OR run it directly against your remote database
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" -f ADD_BANK_ACCOUNT_ID_TO_CASH_PICKUPS.sql
```

## Verification
After running the migration, verify the column exists:

```sql
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'cash_pickups' 
  AND column_name = 'bank_account_id';
```

Expected result:
```
 column_name      | data_type | is_nullable 
------------------+-----------+-------------
 bank_account_id  | uuid      | YES
```

## Next Steps
1. Run the migration
2. **Restart your Supabase connection** or reload the schema cache:
   - In Supabase Dashboard: Settings → API → Click "Reload Schema Cache"
   - OR restart your local app (Vite will reconnect)
3. Test the Bank Pickup form again
4. The error should be resolved

## What This Migration Does
1. ✅ Adds `bank_account_id UUID NULL` column to `cash_pickups`
2. ✅ Creates foreign key constraint to `bank_accounts` table
3. ✅ Adds index for performance
4. ✅ Adds unique constraint `(assignment_id, bank_account_id)` for upsert operations
5. ✅ Maintains backward compatibility (column is nullable)

## Backward Compatibility
- Existing records without `bank_account_id` will continue to work
- New records will use the bank account dropdown and populate this field
- The column is nullable, so no data migration is required

## Rollback (if needed)
If you need to rollback, run:
```sql
ALTER TABLE public.cash_pickups DROP CONSTRAINT IF EXISTS cash_pickups_assignment_bank_unique;
ALTER TABLE public.cash_pickups DROP CONSTRAINT IF EXISTS cash_pickups_bank_account_id_fkey;
DROP INDEX IF EXISTS cash_pickups_bank_account_id_idx;
ALTER TABLE public.cash_pickups DROP COLUMN IF EXISTS bank_account_id;
```
