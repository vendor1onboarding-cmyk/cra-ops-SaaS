-- ============================================================================
-- CRA OPS database upgrade
-- Target version: 1.0.1
-- ============================================================================
--
-- Purpose:
--   Example patch upgrade showing the expected structure for a production
--   release. This file is intentionally minimal and safe to rerun.
--
-- Upgrade strategy:
--   - keep the change additive
--   - preserve existing data
--   - use transaction-safe SQL
--   - document every new object
--
BEGIN;

-- Prevent concurrent upgrade execution within the same database.
SELECT pg_advisory_xact_lock(hashtext('cra_ops_upgrade_1_0_1'));

-- Example: record a release version if the version table exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'system_settings'
  ) THEN
    INSERT INTO public.system_settings ("key", "value", updated_at)
    VALUES ('database_version', '1.0.1', NOW())
    ON CONFLICT ("key") DO UPDATE
    SET "value" = EXCLUDED."value",
        updated_at = NOW();
  END IF;
END
$$;

-- Example: add a compatibility note to the release log if the table exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
  ) THEN
    INSERT INTO public.audit_logs (entity, entity_id, action, actor, created_at)
    VALUES (
      'database',
      NULL,
      'upgrade_1.0.1',
      NULL,
      NOW()
    );
  END IF;
END
$$;

COMMIT;
