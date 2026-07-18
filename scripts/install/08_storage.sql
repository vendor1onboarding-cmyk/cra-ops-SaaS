-- ============================================================================
-- CRA OPS install kit
-- Storage bootstrap
-- ============================================================================

-- The source dump did not include storage schema objects because Supabase-managed storage
-- is not directly dumpable from the linked role in this environment.
-- These buckets are required by the application and are recreated here explicitly.

-- Issue photo evidence bucket used by operational workflows.
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-photos', 'issue-photos', false)
ON CONFLICT (id) DO NOTHING;

-- EOD signature bucket used for close-of-day approvals and attestations.
INSERT INTO storage.buckets (id, name, public)
VALUES ('eod-signatures', 'eod-signatures', false)
ON CONFLICT (id) DO NOTHING;

