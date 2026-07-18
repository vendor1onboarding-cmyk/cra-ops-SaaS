-- ============================================================================
-- CRA OPS install kit
-- Database version guard and source metadata
-- ============================================================================

-- Source dump: install-kit/database/remote_schema_dump.sql
-- Dumped from PostgreSQL 17.6 and pg_dump 18.4.
-- The installer is intended for PostgreSQL 17-compatible Supabase projects.
DO $$
BEGIN
  IF current_setting('server_version_num')::int < 170000 THEN
    RAISE EXCEPTION 'CRA OPS requires PostgreSQL 17 or later';
  END IF;
END
$$;

