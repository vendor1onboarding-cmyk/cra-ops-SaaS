-- ============================================================================
-- CRA OPS install kit
-- Database permissions
-- ============================================================================

-- The source dump was exported with --no-privileges, so explicit grants are recreated here.
-- Keep access limited to the authenticated role; service-role access bypasses RLS in Supabase.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

