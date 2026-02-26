-- Add custodian confirmation fields for admin correction overlay
ALTER TABLE soa_adjustments
ADD COLUMN IF NOT EXISTS requires_custodian_confirmation boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS custodian_confirmed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS custodian_confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS custodian_signature_url text,
ADD COLUMN IF NOT EXISTS original_reference_snapshot jsonb;

-- Backfill existing records to preserve behavior
UPDATE soa_adjustments
SET
  requires_custodian_confirmation = false,
  custodian_confirmed = true,
  custodian_confirmed_at = COALESCE(custodian_confirmed_at, created_at)
WHERE
  (exchange_metadata->>'type') IS DISTINCT FROM 'ADMIN_CORRECTION'
  AND requires_custodian_confirmation = true;
