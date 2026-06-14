-- ============================================================================
-- Banking-Grade Cheque Capture Feature Migration
-- Non-breaking extension to cash_pickups table
-- ============================================================================

-- Add cheque-related columns to cash_pickups (safe ALTER TABLE)
ALTER TABLE public.cash_pickups
ADD COLUMN IF NOT EXISTS cheque_number text NULL,
ADD COLUMN IF NOT EXISTS cheque_image_url text NULL,
ADD COLUMN IF NOT EXISTS cheque_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cheque_verified_by uuid NULL,
ADD COLUMN IF NOT EXISTS cheque_verified_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS cheque_status text DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS cheque_metadata jsonb NULL;

-- Add constraint for cheque_status enum
ALTER TABLE public.cash_pickups
ADD CONSTRAINT cheque_status_check
CHECK (
  cheque_status IN ('PENDING','VERIFIED','REJECTED','CLEARED')
);

-- Create audit log table for cheque verification tracking
CREATE TABLE IF NOT EXISTS public.cheque_audit_log (
  id bigserial PRIMARY KEY,
  pickup_id bigint NOT NULL REFERENCES cash_pickups(id) ON DELETE CASCADE,
  old_status text DEFAULT 'PENDING',
  new_status text NOT NULL,
  old_verified_by uuid NULL,
  new_verified_by uuid NULL,
  change_reason text NULL,
  metadata jsonb NULL,
  updated_by uuid NOT NULL,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT audit_status_check CHECK (
    new_status IN ('PENDING','VERIFIED','REJECTED','CLEARED')
  )
);

-- Create index for cheque_audit_log queries
CREATE INDEX IF NOT EXISTS idx_cheque_audit_pickup 
  ON public.cheque_audit_log(pickup_id);
CREATE INDEX IF NOT EXISTS idx_cheque_audit_status 
  ON public.cheque_audit_log(new_status);
CREATE INDEX IF NOT EXISTS idx_cheque_audit_updated 
  ON public.cheque_audit_log(updated_at DESC);

-- Create trigger to auto-log cheque status changes
CREATE OR REPLACE FUNCTION public.log_cheque_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.cheque_status IS DISTINCT FROM NEW.cheque_status) OR 
     (OLD.cheque_verified IS DISTINCT FROM NEW.cheque_verified) THEN
    INSERT INTO public.cheque_audit_log (
      pickup_id,
      old_status,
      new_status,
      old_verified_by,
      new_verified_by,
      metadata,
      updated_by
    ) VALUES (
      NEW.id,
      COALESCE(OLD.cheque_status, 'PENDING'),
      NEW.cheque_status,
      OLD.cheque_verified_by,
      NEW.cheque_verified_by,
      NEW.cheque_metadata,
      COALESCE(NEW.cheque_verified_by, auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if present
DROP TRIGGER IF EXISTS trigger_log_cheque_status_change ON public.cash_pickups;

-- Create trigger
CREATE TRIGGER trigger_log_cheque_status_change
AFTER UPDATE ON public.cash_pickups
FOR EACH ROW
EXECUTE FUNCTION public.log_cheque_status_change();

CREATE OR REPLACE VIEW public.v_cheque_verifications AS
SELECT
  cp.id as pickup_id,
  cp.assignment_id,
  cp.bank_name,
  cp.branch as branch_name,
  DATE(cp.pickup_time) as pickup_date,
  cp.cheque_number,
  cp.cheque_image_url,
  cp.cheque_status,
  cp.cheque_verified,
  cp.cheque_verified_by,
  cp.cheque_verified_at,
  cp.cheque_metadata,
  cp.expected_amount,
  cp.total_amount as pickup_amount,
  (cp.total_amount - cp.expected_amount)::numeric as variance,
  cal.old_status as last_previous_status,
  cal.updated_at as last_status_change,
  cp.created_at
FROM
  public.cash_pickups cp
LEFT JOIN LATERAL (
  SELECT old_status, updated_at
  FROM public.cheque_audit_log cal_inner
  WHERE cal_inner.pickup_id = cp.id
  ORDER BY cal_inner.updated_at DESC
  LIMIT 1
) cal ON true
WHERE cp.pickup_source = 'BANK' AND cp.cheque_number IS NOT NULL
ORDER BY cp.created_at DESC;

-- Grant permissions (adjust as needed)
GRANT SELECT ON TABLE public.cheque_audit_log TO authenticated;
GRANT SELECT ON TABLE public.v_cheque_verifications TO authenticated;

-- ============================================================================
-- Test: Verify columns exist
-- ============================================================================
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'cash_pickups' 
-- AND column_name LIKE 'cheque%'
-- ORDER BY ordinal_position;
