-- Add soft delete tracking columns to profiles table for audit trail

-- Add columns if they don't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID,
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Add comment for clarity
COMMENT ON COLUMN profiles.deleted_at IS 'Timestamp when user was deleted (soft delete)';
COMMENT ON COLUMN profiles.deleted_by IS 'User ID of admin who deleted this user';
COMMENT ON COLUMN profiles.deletion_reason IS 'Reason for user deletion (provided by admin)';

-- Verification query - uncomment to verify after migration
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name='profiles' 
-- AND column_name IN ('deleted_at', 'deleted_by', 'deletion_reason')
-- ORDER BY column_name;
